package main

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type casResponse struct {
	Success *struct {
		User string `xml:"user"`
	} `xml:"authenticationSuccess"`
	Failure *struct {
		Code    string `xml:"code,attr"`
		Message string `xml:",chardata"`
	} `xml:"authenticationFailure"`
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]string
}

func main() {
	casServer := env("CAS_SERVER", "https://anwar-dev.internal:8443/cas")
	serviceURL := env("SERVICE_URL", "http://localhost:3001")
	listenAddr := env("LISTEN_ADDR", ":3001")
	skipTLSVerify, err := strconv.ParseBool(env("CAS_INSECURE_SKIP_VERIFY", "true"))
	if err != nil {
		log.Fatalf("invalid CAS_INSECURE_SKIP_VERIFY: %v", err)
	}
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{
			InsecureSkipVerify: skipTLSVerify, // Development only; use a trusted CA in production.
		}},
	}
	store := &sessionStore{sessions: make(map[string]string)}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		if user, ok := store.user(r); ok {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = template.Must(template.New("home").Parse(
				`<h1>Hello {{.}}</h1><a href="/logout">Logout</a>`,
			)).Execute(w, user)
			return
		}

		ticket := r.URL.Query().Get("ticket")
		if ticket == "" {
			redirectToCAS(w, r, casServer+"/login", serviceURL)
			return
		}

		user, err := validateTicket(client, casServer, serviceURL, ticket)
		if err != nil {
			log.Printf("ticket validation failed: %v", err)
			http.Error(w, "SSO FAILED", http.StatusUnauthorized)
			return
		}

		if err := store.create(w, user); err != nil {
			log.Printf("session creation failed: %v", err)
			http.Error(w, "Could not create session", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/", http.StatusFound)
	})

	http.HandleFunc("/logout", func(w http.ResponseWriter, r *http.Request) {
		store.destroy(w, r)
		redirectToCAS(w, r, casServer+"/logout", serviceURL)
	})

	log.Printf("Go client running at %s (service: %s)", listenAddr, serviceURL)
	log.Fatal(http.ListenAndServe(listenAddr, nil))
}

func validateTicket(client *http.Client, casServer, serviceURL, ticket string) (string, error) {
	endpoint, err := url.Parse(casServer + "/p3/serviceValidate")
	if err != nil {
		return "", err
	}
	query := endpoint.Query()
	query.Set("service", serviceURL)
	query.Set("ticket", ticket)
	endpoint.RawQuery = query.Encode()

	response, err := client.Get(endpoint.String())
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("CAS returned HTTP %d", response.StatusCode)
	}

	var result casResponse
	if err := xml.NewDecoder(response.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("invalid CAS response: %w", err)
	}
	if result.Success == nil || strings.TrimSpace(result.Success.User) == "" {
		if result.Failure != nil {
			return "", fmt.Errorf("CAS %s: %s", result.Failure.Code, strings.TrimSpace(result.Failure.Message))
		}
		return "", fmt.Errorf("CAS authentication did not succeed")
	}
	return strings.TrimSpace(result.Success.User), nil
}

func redirectToCAS(w http.ResponseWriter, r *http.Request, endpoint, serviceURL string) {
	target, err := url.Parse(endpoint)
	if err != nil {
		http.Error(w, "Invalid CAS URL", http.StatusInternalServerError)
		return
	}
	query := target.Query()
	query.Set("service", serviceURL)
	target.RawQuery = query.Encode()
	http.Redirect(w, r, target.String(), http.StatusFound)
}

func (s *sessionStore) create(w http.ResponseWriter, user string) error {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return err
	}
	id := hex.EncodeToString(random)
	s.mu.Lock()
	s.sessions[id] = user
	s.mu.Unlock()
	http.SetCookie(w, &http.Cookie{
		Name:     "pnj_go_session",
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	return nil
}

func (s *sessionStore) user(r *http.Request) (string, bool) {
	cookie, err := r.Cookie("pnj_go_session")
	if err != nil {
		return "", false
	}
	s.mu.RLock()
	user, ok := s.sessions[cookie.Value]
	s.mu.RUnlock()
	return user, ok
}

func (s *sessionStore) destroy(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("pnj_go_session"); err == nil {
		s.mu.Lock()
		delete(s.sessions, cookie.Value)
		s.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "pnj_go_session",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
