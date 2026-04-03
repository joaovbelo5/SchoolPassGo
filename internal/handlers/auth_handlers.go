package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/joaob/schoolpassgo/internal/auth"
)

// LoginPageHandler serves the login HTML page
func LoginPageHandler(w http.ResponseWriter, r *http.Request) {
	// If already logged in, redirect to dashboard
	if cookie, err := r.Cookie("spg_session"); err == nil {
		if _, err := auth.GetSession(cookie.Value); err == nil {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}
	}
	http.ServeFile(w, r, "templates/login.html")
}

// LoginHandler processes login form submissions
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		sendError(w, http.StatusBadRequest, "Dados inválidos")
		return
	}

	user, hash, err := auth.GetUsuarioByUsername(creds.Username)
	if err != nil {
		// Deliberately vague error to avoid user enumeration
		sendError(w, http.StatusUnauthorized, "Usuário ou senha incorretos")
		return
	}

	ok, err := auth.VerifyPassword(hash, creds.Password)
	if err != nil || !ok {
		sendError(w, http.StatusUnauthorized, "Usuário ou senha incorretos")
		return
	}

	ip := r.RemoteAddr
	token, err := auth.CreateSession(user.ID, ip)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao criar sessão")
		return
	}

	// Persistent cookie — 10 years
	http.SetCookie(w, &http.Cookie{
		Name:     "spg_session",
		Value:    token,
		Path:     "/",
		MaxAge:   315360000,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	sendJSON(w, http.StatusOK, map[string]string{"redirect": "/"})
}

// LogoutHandler invalidates the current session
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("spg_session")
	if err == nil {
		auth.DeleteSession(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:   "spg_session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	http.Redirect(w, r, "/login", http.StatusFound)
}

// GetCurrentUserHandler returns info about the authenticated user
func GetCurrentUserHandler(w http.ResponseWriter, r *http.Request) {
	user := auth.GetCurrentUser(r)
	if user == nil {
		sendError(w, http.StatusUnauthorized, "não autenticado")
		return
	}
	sendJSON(w, http.StatusOK, user)
}

// --- User Management (admin only) ---

func GetUsuariosHandler(w http.ResponseWriter, r *http.Request) {
	users, err := auth.GetAllUsuarios()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao listar usuários: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, users)
}

func CreateUsuarioHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Username string `json:"username"`
		Nome     string `json:"nome"`
		Password string `json:"password"`
		Papel    string `json:"papel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendError(w, http.StatusBadRequest, "Dados inválidos")
		return
	}
	if payload.Username == "" || payload.Password == "" || payload.Nome == "" {
		sendError(w, http.StatusBadRequest, "Campos obrigatórios: username, nome, password")
		return
	}
	if payload.Papel == "" {
		payload.Papel = "admin"
	}

	if err := auth.CreateUsuario(payload.Username, payload.Nome, payload.Password, payload.Papel); err != nil {
		sendError(w, http.StatusConflict, "Erro ao criar usuário (username já existe?): "+err.Error())
		return
	}
	sendJSON(w, http.StatusCreated, map[string]string{"message": "Usuário criado com sucesso"})
}

func UpdateUsuarioSenhaHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	var payload struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Password == "" {
		sendError(w, http.StatusBadRequest, "Nova senha obrigatória")
		return
	}

	if err := auth.UpdateUsuarioSenha(id, payload.Password); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao atualizar senha: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Senha atualizada com sucesso"})
}

func DeleteUsuarioHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	// Prevent self-deletion
	current := auth.GetCurrentUser(r)
	if current != nil && current.ID == id {
		sendError(w, http.StatusForbidden, "Você não pode remover sua própria conta")
		return
	}

	if err := auth.DeleteUsuario(id); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao remover usuário: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Usuário removido"})
}
