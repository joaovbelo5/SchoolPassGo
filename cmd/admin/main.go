// cmd/admin/main.go — CLI tool for SchoolPassGo user management
// Usage: go run ./cmd/admin [list|create|passwd|delete] [args...]
//
// This tool connects directly to auth.db without needing the server to be running.

package main

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"syscall"
	"time"

	"golang.org/x/crypto/argon2"
	"golang.org/x/term"

	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"strings"

	_ "modernc.org/sqlite"
)

const dbPath = "auth.db"

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fatalf("Não foi possível abrir %s: %v\n", dbPath, err)
	}
	defer db.Close()

	if err := ensureSchema(db); err != nil {
		fatalf("Erro ao inicializar schema: %v\n", err)
	}

	switch os.Args[1] {
	case "list":
		cmdList(db)
	case "create":
		if len(os.Args) < 4 {
			fatalf("Uso: create <username> <nome completo>\n")
		}
		cmdCreate(db, os.Args[2], strings.Join(os.Args[3:], " "))
	case "passwd":
		if len(os.Args) < 3 {
			fatalf("Uso: passwd <username>\n")
		}
		cmdPasswd(db, os.Args[2])
	case "delete":
		if len(os.Args) < 3 {
			fatalf("Uso: delete <username>\n")
		}
		cmdDelete(db, os.Args[2])
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`SchoolPassGo — Ferramenta de Gerenciamento de Usuários

Uso: go run ./cmd/admin <comando> [args...]

Comandos:
  list                        Lista todos os usuários cadastrados
  create <user> <nome>        Cria um novo usuário (senha solicitada interativamente)
  passwd <user>               Altera a senha de um usuário existente
  delete <user>               Remove um usuário permanentemente
  
Este utilitário opera diretamente em auth.db e não requer o servidor em execução.`)
}

func cmdList(db *sql.DB) {
	rows, err := db.Query("SELECT id, username, nome, papel, criado_em, COALESCE(ultimo_login,'Nunca') FROM usuarios ORDER BY id ASC")
	if err != nil {
		fatalf("Erro ao listar: %v\n", err)
	}
	defer rows.Close()

	fmt.Printf("\n%-5s %-20s %-25s %-10s %-20s %-20s\n", "ID", "USUÁRIO", "NOME", "PAPEL", "CRIADO EM", "ÚLTIMO LOGIN")
	fmt.Println(strings.Repeat("─", 105))
	for rows.Next() {
		var id int
		var username, nome, papel, criado, ultimo string
		rows.Scan(&id, &username, &nome, &papel, &criado, &ultimo)
		fmt.Printf("%-5s %-20s %-25s %-10s %-20s %-20s\n",
			strconv.Itoa(id), username, nome, papel, criado[:10], ultimo)
	}
	fmt.Println()
}

func cmdCreate(db *sql.DB, username, nome string) {
	fmt.Printf("Criando usuário: %s (%s)\n", username, nome)
	password := readPassword("Digite a senha: ")
	confirm := readPassword("Confirme a senha: ")

	if password != confirm {
		fatalf("As senhas não coincidem.\n")
	}
	if len(password) < 6 {
		fatalf("A senha deve ter no mínimo 6 caracteres.\n")
	}

	hash, err := hashPassword(password)
	if err != nil {
		fatalf("Erro ao gerar hash: %v\n", err)
	}

	_, err = db.Exec(
		"INSERT INTO usuarios (username, nome, hash_senha, papel, criado_em) VALUES (?, ?, ?, 'admin', ?)",
		username, nome, hash, time.Now().Format(time.RFC3339),
	)
	if err != nil {
		fatalf("Erro ao criar usuário (username já existe?): %v\n", err)
	}
	fmt.Printf("✅ Usuário '%s' criado com sucesso.\n", username)
}

func cmdPasswd(db *sql.DB, username string) {
	var id int
	err := db.QueryRow("SELECT id FROM usuarios WHERE username = ?", username).Scan(&id)
	if err != nil {
		fatalf("Usuário '%s' não encontrado.\n", username)
	}

	password := readPassword("Nova senha: ")
	confirm := readPassword("Confirme a senha: ")
	if password != confirm {
		fatalf("As senhas não coincidem.\n")
	}
	if len(password) < 6 {
		fatalf("A senha deve ter no mínimo 6 caracteres.\n")
	}

	hash, err := hashPassword(password)
	if err != nil {
		fatalf("Erro ao gerar hash: %v\n", err)
	}

	db.Exec("UPDATE usuarios SET hash_senha = ? WHERE id = ?", hash, id)
	fmt.Printf("✅ Senha de '%s' atualizada com sucesso.\n", username)
}

func cmdDelete(db *sql.DB, username string) {
	var id int
	err := db.QueryRow("SELECT id FROM usuarios WHERE username = ?", username).Scan(&id)
	if err != nil {
		fatalf("Usuário '%s' não encontrado.\n", username)
	}

	fmt.Printf("⚠️  Remover o usuário '%s' permanentemente? [s/N]: ", username)
	var resp string
	fmt.Scanln(&resp)
	if strings.ToLower(resp) != "s" {
		fmt.Println("Operação cancelada.")
		return
	}

	db.Exec("DELETE FROM sessoes WHERE usuario_id = ?", id)
	db.Exec("DELETE FROM usuarios WHERE id = ?", id)
	fmt.Printf("✅ Usuário '%s' removido.\n", username)
}

// readPassword reads a password from the terminal without echoing
func readPassword(prompt string) string {
	fmt.Print(prompt)
	pw, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	if err != nil {
		fatalf("Erro ao ler senha: %v\n", err)
	}
	return string(pw)
}

func fatalf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "❌ "+format, args...)
	os.Exit(1)
}

// --- Schema Bootstrap ---

func ensureSchema(db *sql.DB) error {
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
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// --- Argon2id (copied to avoid circular imports) ---

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 2, 32)
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, 64*1024, 3, 2, b64Salt, b64Hash), nil
}

func verifyPassword(encodedHash, password string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, errors.New("invalid hash format")
	}
	var p struct{ memory, iterations uint32; parallelism uint8 }
	fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.memory, &p.iterations, &p.parallelism)
	salt, _ := base64.RawStdEncoding.DecodeString(parts[4])
	decodedHash, _ := base64.RawStdEncoding.DecodeString(parts[5])
	comp := argon2.IDKey([]byte(password), salt, p.iterations, p.memory, p.parallelism, uint32(len(decodedHash)))
	return subtle.ConstantTimeCompare(decodedHash, comp) == 1, nil
}

var _ = verifyPassword // suppress unused warning
