package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joaob/schoolpassgo/internal/auth"
	"github.com/joaob/schoolpassgo/internal/database"
	"github.com/joaob/schoolpassgo/internal/handlers"
	"github.com/joaob/schoolpassgo/internal/repository"
	"github.com/joaob/schoolpassgo/internal/telegram"
)

func main() {
	// Ensure uploads directory exists
	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Fatal(err)
	}

	// Initialize Authentication Database
	if err := auth.InitAuthDB("auth.db"); err != nil {
		log.Fatalf("Could not initialize auth database: %v", err)
	}
	defer auth.AuthDB.Close()

	// Initialize Main Database
	err := database.InitDB("escola.db")
	if err != nil {
		log.Fatalf("Could not initialize database: %v", err)
	}
	defer database.DB.Close()

	// Start background cleanup
	go func() {
		if err := repository.CleanLixeiraOcorrencias(); err != nil {
			log.Printf("Clean Lixeira Ocorrencias Error: %v", err)
		}
	}()

	// Start Telegram Bot
	config, err := repository.GetConfig()
	if err == nil && config.TelegramBotToken != "" {
		go telegram.StartBot(config.TelegramBotToken)
	}

	mux := http.NewServeMux()

	// Auth Routes (public — checked by middleware whitelist)
	mux.HandleFunc("GET /login", handlers.LoginPageHandler)
	mux.HandleFunc("POST /api/auth/login", handlers.LoginHandler)
	mux.HandleFunc("POST /api/auth/logout", handlers.LogoutHandler)
	mux.HandleFunc("GET /api/auth/me", handlers.GetCurrentUserHandler)

	// User Management Routes
	mux.HandleFunc("GET /api/usuarios", handlers.GetUsuariosHandler)
	mux.HandleFunc("POST /api/usuarios", handlers.CreateUsuarioHandler)
	mux.HandleFunc("PUT /api/usuarios/{id}/senha", handlers.UpdateUsuarioSenhaHandler)
	mux.HandleFunc("DELETE /api/usuarios/{id}", handlers.DeleteUsuarioHandler)

	// API Routes
	mux.HandleFunc("GET /api/config", handlers.GetConfigHandler)
	mux.HandleFunc("PUT /api/config", handlers.UpdateConfigHandler)

	mux.HandleFunc("GET /api/alunos", handlers.GetAlunosHandler)
	mux.HandleFunc("POST /api/alunos", handlers.CreateAlunoHandler)
	mux.HandleFunc("PUT /api/alunos/{id}", handlers.UpdateAlunoHandler)
	mux.HandleFunc("DELETE /api/alunos/{id}", handlers.DeleteAlunoHandler)
	mux.HandleFunc("GET /api/alunos/{id}/acessos", handlers.GetAcessosAlunoHandler)
	
	mux.HandleFunc("GET /api/alunos/{id}/ocorrencias", handlers.GetOcorrenciasHandler)
	mux.HandleFunc("POST /api/alunos/{id}/ocorrencias", handlers.CreateOcorrenciaHandler)
	mux.HandleFunc("PUT /api/ocorrencias/{id}", handlers.UpdateOcorrenciaHandler)
	mux.HandleFunc("DELETE /api/ocorrencias/{id}", handlers.DeleteOcorrenciaHandler)
	
	mux.HandleFunc("POST /api/arquivo/gerar", handlers.GerarArquivoHandler)
	mux.HandleFunc("GET /api/arquivos/list", handlers.ListArquivosHandler)
	mux.HandleFunc("GET /api/arquivos/{ano}/alunos", handlers.GetArquivoAlunosHandler)
	mux.HandleFunc("GET /api/arquivos/{ano}/aluno/{id}", handlers.GetArquivoDossieHandler)

	mux.HandleFunc("GET /api/acessos", handlers.GetAcessosHandler)
	mux.HandleFunc("POST /api/totem/registrar", handlers.TotemRegistroHandler)
	mux.HandleFunc("GET /api/relatorio/frequencia", handlers.GerarChamadaHandler)

	mux.HandleFunc("GET /api/backup", handlers.BackupHandler)
	mux.HandleFunc("POST /api/restaurar", handlers.RestaurarHandler)
	mux.HandleFunc("GET /api/dashboard", handlers.GetDashboardStatsHandler)

	// Static Files - serve the frontend
	fileServer := http.FileServer(http.Dir("./static"))
	mux.Handle("GET /static/", http.StripPrefix("/static/", fileServer))
	
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Frontend Route Handling (Templates)
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "templates/dashboard.html")
			return
		}
		if r.URL.Path == "/totem" {
			http.ServeFile(w, r, "templates/totem.html")
			return
		}
		if r.URL.Path == "/admin" {
			http.ServeFile(w, r, "templates/admin.html")
			return
		}
		if r.URL.Path == "/settings" {
			http.ServeFile(w, r, "templates/settings.html")
			return
		}
		if r.URL.Path == "/chamada" {
			http.ServeFile(w, r, "templates/chamada.html")
			return
		}
		if r.URL.Path == "/carometro" {
			http.ServeFile(w, r, "templates/carometro.html")
			return
		}
		if r.URL.Path == "/arquivo" {
			http.ServeFile(w, r, "templates/arquivo.html")
			return
		}
		http.NotFound(w, r)
	})

	log.Println("Server started on http://localhost:8080")
	if err := http.ListenAndServe(":8080", auth.RequireAuth(mux)); err != nil {
		log.Fatal(err)
	}
}
