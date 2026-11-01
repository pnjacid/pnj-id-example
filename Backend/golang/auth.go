package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const requiredScope = "test.read"

type verifier struct {
	issuer       string
	clientID     string
	clientSecret string
	httpClient   *http.Client
}

func hasScope(claims map[string]any, required string) bool {
	var scopes []string
	switch value := claims["scope"].(type) {
	case string:
		scopes = strings.Fields(value)
	case []any:
		for _, scope := range value {
			if text, ok := scope.(string); ok {
				scopes = append(scopes, text)
			}
		}
	}
	for _, scope := range scopes {
		if scope == required {
			return true
		}
	}
	return false
}

func (v verifier) verifyAccessToken(ctx context.Context, token string) (map[string]any, error) {
	if strings.Count(token, ".") == 2 {
		return v.verifyJWT(ctx, token)
	}
	return v.introspect(ctx, token)
}

func (v verifier) verifyJWT(ctx context.Context, token string) (map[string]any, error) {
	parts := strings.Split(token, ".")
	var header struct {
		Algorithm string `json:"alg"`
		KeyID     string `json:"kid"`
	}
	if err := decodePart(parts[0], &header); err != nil {
		return nil, errors.New("Header JWT tidak valid")
	}

	hash, digest, ok := jwtDigest(header.Algorithm, parts[0]+"."+parts[1])
	if !ok {
		return nil, fmt.Errorf("Algoritma JWT %s tidak didukung", header.Algorithm)
	}
	key, err := v.loadRSAKey(ctx, header.KeyID)
	if err != nil {
		return nil, err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("Signature JWT tidak valid")
	}
	if err := rsa.VerifyPKCS1v15(key, hash, digest, signature); err != nil {
		return nil, errors.New("Signature JWT tidak valid")
	}

	claims := map[string]any{}
	if err := decodePart(parts[1], &claims); err != nil {
		return nil, errors.New("Payload JWT tidak valid")
	}
	if claims["iss"] != v.issuer {
		return nil, errors.New("Issuer token tidak valid")
	}
	now := float64(time.Now().Unix())
	if expires, ok := claims["exp"].(float64); !ok || expires <= now {
		return nil, errors.New("Token sudah kedaluwarsa")
	}
	if notBefore, ok := claims["nbf"].(float64); ok && notBefore > now {
		return nil, errors.New("Token belum aktif")
	}
	if !hasScope(claims, requiredScope) {
		return nil, fmt.Errorf("Token tidak memiliki scope %s", requiredScope)
	}
	return claims, nil
}

func jwtDigest(algorithm, message string) (crypto.Hash, []byte, bool) {
	switch algorithm {
	case "RS256":
		digest := sha256.Sum256([]byte(message))
		return crypto.SHA256, digest[:], true
	case "RS384":
		digest := sha512.Sum384([]byte(message))
		return crypto.SHA384, digest[:], true
	case "RS512":
		digest := sha512.Sum512([]byte(message))
		return crypto.SHA512, digest[:], true
	default:
		return 0, nil, false
	}
}

func decodePart(part string, target any) error {
	data, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func (v verifier) loadRSAKey(ctx context.Context, keyID string) (*rsa.PublicKey, error) {
	// shortcut: JWKS diambil untuk setiap request JWT, tambahkan cache saat dipakai pada traffic tinggi.
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, v.issuer+"/jwks", nil)
	if err != nil {
		return nil, err
	}
	response, err := v.client().Do(request)
	if err != nil {
		return nil, fmt.Errorf("JWKS gagal diambil: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS gagal diambil (%d)", response.StatusCode)
	}
	var document struct {
		Keys []struct {
			KeyType string `json:"kty"`
			KeyID   string `json:"kid"`
			N       string `json:"n"`
			E       string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&document); err != nil {
		return nil, errors.New("Respons JWKS tidak valid")
	}
	for _, key := range document.Keys {
		if key.KeyType != "RSA" || key.KeyID != keyID {
			continue
		}
		modulus, nErr := base64.RawURLEncoding.DecodeString(key.N)
		exponent, eErr := base64.RawURLEncoding.DecodeString(key.E)
		if nErr != nil || eErr != nil || len(exponent) == 0 || len(exponent) > 4 {
			return nil, errors.New("RSA key pada JWKS tidak valid")
		}
		e := 0
		for _, value := range exponent {
			e = e<<8 + int(value)
		}
		return &rsa.PublicKey{N: new(big.Int).SetBytes(modulus), E: e}, nil
	}
	return nil, errors.New("Signing key tidak ditemukan pada JWKS")
}

func (v verifier) introspect(ctx context.Context, token string) (map[string]any, error) {
	if v.clientSecret == "" {
		return nil, errors.New("OIDC_CLIENT_SECRET belum dikonfigurasi")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, v.issuer+"/introspect", strings.NewReader(url.Values{"token": {token}}.Encode()))
	if err != nil {
		return nil, err
	}
	request.SetBasicAuth(v.clientID, v.clientSecret)
	request.Header.Set("content-type", "application/x-www-form-urlencoded")
	response, err := v.client().Do(request)
	if err != nil {
		return nil, fmt.Errorf("Introspection token gagal: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Introspection token gagal (%d)", response.StatusCode)
	}
	claims := map[string]any{}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&claims); err != nil {
		return nil, errors.New("Respons introspection tidak valid")
	}
	if active, _ := claims["active"].(bool); !active {
		return nil, errors.New("Token tidak aktif")
	}
	if claims["client_id"] != v.clientID {
		return nil, errors.New("Token diterbitkan untuk client lain")
	}
	if !hasScope(claims, requiredScope) {
		return nil, fmt.Errorf("Token tidak memiliki scope %s", requiredScope)
	}
	return claims, nil
}

func (v verifier) client() *http.Client {
	if v.httpClient != nil {
		return v.httpClient
	}
	return http.DefaultClient
}
