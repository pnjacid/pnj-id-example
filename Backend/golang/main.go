package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	port := env("PORT", "90")
	verify := verifier{
		issuer:       env("OIDC_ISSUER", "https://dev-id.pnj.ac.id/cas/oidc"),
		clientID:     env("OIDC_CLIENT_ID", "al-localhost5173testread-1012"),
		clientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writeJSON(response, http.StatusNotFound, map[string]any{"error": "Endpoint tidak ditemukan"})
			return
		}
		writeJSON(response, http.StatusOK, map[string]any{"status": "ok"})
	})
	mux.HandleFunc("/api/profile", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writeJSON(response, http.StatusNotFound, map[string]any{"error": "Endpoint tidak ditemukan"})
			return
		}
		parts := strings.Fields(request.Header.Get("authorization"))
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeJSON(response, http.StatusUnauthorized, map[string]any{"error": "Bearer token diperlukan"})
			return
		}
		claims, err := verify.verifyAccessToken(request.Context(), parts[1])
		if err != nil {
			writeJSON(response, http.StatusUnauthorized, map[string]any{"error": err.Error()})
			return
		}
		email := claims["email"]
		if email == nil {
			email = claims["mail"]
		}
		writeJSON(response, http.StatusOK, map[string]any{
			"message": "Access token valid untuk test.read",
			"subject": claims["sub"],
			"email":   email,
			"scope":   claims["scope"],
		})
	})
	mux.HandleFunc("/", func(response http.ResponseWriter, _ *http.Request) {
		writeJSON(response, http.StatusNotFound, map[string]any{"error": "Endpoint tidak ditemukan"})
	})

	log.Printf("Backend berjalan di http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func writeJSON(response http.ResponseWriter, status int, body any) {
	response.Header().Set("content-type", "application/json; charset=utf-8")
	response.Header().Set("cache-control", "no-store")
	response.WriteHeader(status)
	if err := json.NewEncoder(response).Encode(body); err != nil {
		log.Printf("Gagal menulis response: %v", err)
	}
}
