package auth

import (
	"database/sql"
	"log"
	"time"

	_ "modernc.org/sqlite"
)

var AuthDB *sql.DB

// InitAuthDB initializes the separate authentication database
func InitAuthDB(path string) error {
	var err error
	AuthDB, err = sql.Open("sqlite", path)
	if err != nil {
		return err
	}

	if err = AuthDB.Ping(); err != nil {
		return err
	}

	return createAuthTables()
}

func createAuthTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS usuarios (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			username     TEXT UNIQUE NOT NULL,
			nome         TEXT NOT NULL,
			hash_senha   TEXT NOT NULL,
			papel        TEXT NOT NULL DEFAULT 'admin',
			criado_em    DATETIME NOT NULL,
			ultimo_login DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS sessoes (
			token       TEXT PRIMARY KEY,
			usuario_id  INTEGER NOT NULL,
			ip          TEXT,
			criado_em   DATETIME NOT NULL,
			FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
		);`,
	}

	for _, q := range queries {
		if _, err := AuthDB.Exec(q); err != nil {
			return err
		}
	}

	// Create default admin user if no users exist
	var count int
	AuthDB.QueryRow("SELECT COUNT(*) FROM usuarios").Scan(&count)
	if count == 0 {
		hash, err := HashPassword("admin123")
		if err != nil {
			return err
		}
		_, err = AuthDB.Exec(
			"INSERT INTO usuarios (username, nome, hash_senha, papel, criado_em) VALUES (?, ?, ?, 'admin', ?)",
			"admin", "Administrador", hash, time.Now().Format(time.RFC3339),
		)
		if err != nil {
			return err
		}
		log.Println("========================================================")
		log.Println("  USUÁRIO PADRÃO CRIADO: admin / admin123")
		log.Println("  ALTERE A SENHA IMEDIATAMENTE nas Configurações!")
		log.Println("========================================================")
	}

	return nil
}
