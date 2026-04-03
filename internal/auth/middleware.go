package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const UserContextKey contextKey = "usuario"

// publicPrefixes lists paths that bypass authentication
var publicPrefixes = []string{
	"/login",
	"/api/auth/login",
	"/static/",
	"/uploads/",
}

func isPublic(path string) bool {
	for _, prefix := range publicPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// RequireAuth wraps the mux and enforces session authentication on all non-public routes
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublic(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie("spg_session")
		if err != nil {
			redirectOrUnauthorized(w, r)
			return
		}

		user, err := GetSession(cookie.Value)
		if err != nil {
			// Invalid/deleted session — clear the stale cookie
			http.SetCookie(w, &http.Cookie{
				Name:   "spg_session",
				Value:  "",
				MaxAge: -1,
				Path:   "/",
			})
			redirectOrUnauthorized(w, r)
			return
		}

		// Inject user into request context
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func redirectOrUnauthorized(w http.ResponseWriter, r *http.Request) {
	// API requests get 401 JSON; page requests get redirect to /login
	if strings.HasPrefix(r.URL.Path, "/api/") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"não autenticado"}`))
		return
	}
	http.Redirect(w, r, "/login?next="+r.URL.Path, http.StatusFound)
}

// GetCurrentUser retrieves the authenticated user from the request context
func GetCurrentUser(r *http.Request) *Usuario {
	u, _ := r.Context().Value(UserContextKey).(*Usuario)
	return u
}
