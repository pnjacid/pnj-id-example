package main

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestHasScope(t *testing.T) {
	for _, scope := range []any{"openid test.read", []any{"openid", "test.read"}} {
		if !hasScope(map[string]any{"scope": scope}, requiredScope) {
			t.Fatalf("scope %v should match", scope)
		}
	}
	for _, scope := range []any{nil, "", "test.read.extra", []any{"test.read.extra", 1, map[string]any{}}} {
		if hasScope(map[string]any{"scope": scope}, requiredScope) {
			t.Fatalf("scope %v should not match", scope)
		}
	}
}

func TestVerifyJWT(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	encode := base64.RawURLEncoding.EncodeToString
	jwks, err := json.Marshal(map[string]any{"keys": []any{map[string]any{
		"kty": "RSA", "kid": "test-key", "n": encode(key.N.Bytes()),
		"e": encode(big.NewInt(int64(key.E)).Bytes()),
	}}})
	if err != nil {
		t.Fatal(err)
	}
	v := verifier{issuer: "https://provider.example", httpClient: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/jwks" {
			t.Fatal("expected JWKS request")
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(string(jwks)))}, nil
	})}}
	for _, scope := range []string{"test.read", "test.read.extra"} {
		payload, err := json.Marshal(map[string]any{"iss": v.issuer, "exp": time.Now().Add(time.Hour).Unix(), "scope": scope})
		if err != nil {
			t.Fatal(err)
		}
		message := encode([]byte(`{"alg":"RS256","kid":"test-key"}`)) + "." + encode(payload)
		digest := sha256.Sum256([]byte(message))
		signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
		if err != nil {
			t.Fatal(err)
		}
		_, err = v.verifyAccessToken(context.Background(), message+"."+encode(signature))
		if scope == requiredScope && err != nil {
			t.Fatalf("valid JWT rejected: %v", err)
		}
		if scope != requiredScope && (err == nil || !strings.Contains(err.Error(), "scope test.read")) {
			t.Fatalf("expected missing scope error, got %v", err)
		}
		_, err = v.verifyAccessToken(context.Background(), message+"."+encode([]byte("invalid signature")))
		if err == nil || !strings.Contains(err.Error(), "Signature JWT tidak valid") {
			t.Fatalf("invalid signature accepted: %v", err)
		}
	}
}

func TestVerifyOpaqueToken(t *testing.T) {
	for _, tc := range []struct {
		name      string
		body      string
		errorText string
	}{
		{"valid", `{"active":true,"client_id":"test-client","scope":"test.read","sub":"test-subject"}`, ""},
		{"inactive", `{"active":false}`, "Token tidak aktif"},
		{"wrong client", `{"active":true,"client_id":"other"}`, "client lain"},
		{"wrong scope", `{"active":true,"client_id":"test-client","scope":"test.read.extra"}`, "scope test.read"},
		{"invalid response", `not json`, "Respons introspection tidak valid"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			v := verifier{issuer: "https://provider.example", clientID: "test-client", clientSecret: "test-secret"}
			v.httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				id, secret, ok := r.BasicAuth()
				if !ok || id != v.clientID || secret != v.clientSecret || r.Method != http.MethodPost || r.URL.Path != "/introspect" {
					t.Fatal("invalid introspection request")
				}
				if err := r.ParseForm(); err != nil || r.Form.Get("token") != "opaque-token" {
					t.Fatal("missing token")
				}
				return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
			})}
			claims, err := v.verifyAccessToken(context.Background(), "opaque-token")
			if tc.errorText != "" {
				if err == nil || !strings.Contains(err.Error(), tc.errorText) {
					t.Fatalf("expected %q, got %v", tc.errorText, err)
				}
			} else if err != nil || claims["sub"] != "test-subject" {
				t.Fatalf("expected verified claims, got %v, %v", claims, err)
			}
		})
	}
}
