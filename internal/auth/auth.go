package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

// --- Password Hashing (Argon2id) ---

type argon2Params struct {
	memory      uint32
	iterations  uint32
	parallelism uint8
	saltLength  uint32
	keyLength   uint32
}

var defaultParams = &argon2Params{
	memory:      64 * 1024, // 64 MB
	iterations:  3,
	parallelism: 2,
	saltLength:  16,
	keyLength:   32,
}

// HashPassword hashes a password using Argon2id
func HashPassword(password string) (string, error) {
	salt := make([]byte, defaultParams.saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		defaultParams.iterations,
		defaultParams.memory,
		defaultParams.parallelism,
		defaultParams.keyLength,
	)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		defaultParams.memory,
		defaultParams.iterations,
		defaultParams.parallelism,
		b64Salt,
		b64Hash,
	)
	return encoded, nil
}

// VerifyPassword checks a password against an Argon2id hash
func VerifyPassword(encodedHash, password string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, errors.New("invalid hash format")
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, err
	}

	var p argon2Params
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.memory, &p.iterations, &p.parallelism); err != nil {
		return false, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}

	decodedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}
	p.keyLength = uint32(len(decodedHash))

	comparisonHash := argon2.IDKey([]byte(password), salt, p.iterations, p.memory, p.parallelism, p.keyLength)

	// Constant-time comparison to prevent timing attacks
	match := subtle.ConstantTimeCompare(decodedHash, comparisonHash) == 1
	return match, nil
}

// --- Session Management ---

// Usuario represents an authenticated user
type Usuario struct {
	ID          int
	Username    string
	Nome        string
	Papel       string
	CriadoEm    string
	UltimoLogin string
}

// CreateSession generates a persistent session token for a user
func CreateSession(userID int, ip string) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)

	_, err := AuthDB.Exec(
		"INSERT INTO sessoes (token, usuario_id, ip, criado_em) VALUES (?, ?, ?, ?)",
		token, userID, ip, time.Now().Format(time.RFC3339),
	)
	if err != nil {
		return "", err
	}

	// Update last login
	AuthDB.Exec("UPDATE usuarios SET ultimo_login = ? WHERE id = ?", time.Now().Format(time.RFC3339), userID)

	return token, nil
}

// GetSession retrieves the user associated with a session token (no expiry check)
func GetSession(token string) (*Usuario, error) {
	var u Usuario
	err := AuthDB.QueryRow(`
		SELECT u.id, u.username, u.nome, u.papel, u.criado_em, COALESCE(u.ultimo_login, '')
		FROM sessoes s
		JOIN usuarios u ON s.usuario_id = u.id
		WHERE s.token = ?
	`, token).Scan(&u.ID, &u.Username, &u.Nome, &u.Papel, &u.CriadoEm, &u.UltimoLogin)

	if err != nil {
		return nil, err
	}
	return &u, nil
}

// DeleteSession removes a session from the database (logout)
func DeleteSession(token string) error {
	_, err := AuthDB.Exec("DELETE FROM sessoes WHERE token = ?", token)
	return err
}

// --- User Management ---

// GetAllUsuarios returns all users (without password hashes)
func GetAllUsuarios() ([]Usuario, error) {
	rows, err := AuthDB.Query(
		"SELECT id, username, nome, papel, criado_em, COALESCE(ultimo_login,'') FROM usuarios ORDER BY criado_em ASC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []Usuario
	for rows.Next() {
		var u Usuario
		if err := rows.Scan(&u.ID, &u.Username, &u.Nome, &u.Papel, &u.CriadoEm, &u.UltimoLogin); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if users == nil {
		users = []Usuario{}
	}
	return users, nil
}

// CreateUsuario creates a new user with a hashed password
func CreateUsuario(username, nome, password, papel string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	_, err = AuthDB.Exec(
		"INSERT INTO usuarios (username, nome, hash_senha, papel, criado_em) VALUES (?, ?, ?, ?, ?)",
		username, nome, hash, papel, time.Now().Format(time.RFC3339),
	)
	return err
}

// UpdateUsuarioSenha changes a user's password
func UpdateUsuarioSenha(id int, newPassword string) error {
	hash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	_, err = AuthDB.Exec("UPDATE usuarios SET hash_senha = ? WHERE id = ?", hash, id)
	return err
}

// DeleteUsuario removes a user and all their sessions
func DeleteUsuario(id int) error {
	AuthDB.Exec("DELETE FROM sessoes WHERE usuario_id = ?", id)
	_, err := AuthDB.Exec("DELETE FROM usuarios WHERE id = ?", id)
	return err
}

// GetUsuarioByUsername finds a user by username (for login)
func GetUsuarioByUsername(username string) (*Usuario, string, error) {
	var u Usuario
	var hash string
	err := AuthDB.QueryRow(
		"SELECT id, username, nome, papel, criado_em, COALESCE(ultimo_login,''), hash_senha FROM usuarios WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &u.Nome, &u.Papel, &u.CriadoEm, &u.UltimoLogin, &hash)
	if err != nil {
		return nil, "", err
	}
	return &u, hash, nil
}
