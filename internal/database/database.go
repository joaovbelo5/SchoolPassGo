package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// InitDB initializes the SQLite database and creates tables if they don't exist
func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	err = createTables()
	if err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS alunos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nome TEXT NOT NULL,
			turma TEXT,
			turno TEXT,
			foto TEXT,
			codigo_barras TEXT UNIQUE NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS acessos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			aluno_id INTEGER NOT NULL,
			data_hora DATETIME NOT NULL,
			tipo TEXT NOT NULL,
			FOREIGN KEY(aluno_id) REFERENCES alunos(id)
		);`,
		`CREATE TABLE IF NOT EXISTS ocorrencias (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			aluno_id INTEGER NOT NULL,
			data_hora DATETIME NOT NULL,
			classificacao TEXT NOT NULL,
			descricao TEXT NOT NULL,
			registrado_por TEXT NOT NULL,
			historico_edicao TEXT DEFAULT '',
			deletado_em DATETIME,
			FOREIGN KEY(aluno_id) REFERENCES alunos(id)
		);`,
		`CREATE TABLE IF NOT EXISTS configuracoes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nome_instituicao TEXT,
			tempo_minimo_minutos INTEGER DEFAULT 5,
			diretorio_imagens TEXT DEFAULT 'uploads/fotos'
		);`,
		// Insert default configuration if it doesn't exist
		`INSERT INTO configuracoes (id, nome_instituicao, tempo_minimo_minutos, diretorio_imagens) 
		 SELECT 1, 'Minha Escola', 5, 'uploads/fotos' 
		 WHERE NOT EXISTS (SELECT 1 FROM configuracoes WHERE id = 1);`,
	}

	ctx := context.Background()
	tx, err := DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	for _, q := range queries {
		if _, err := tx.ExecContext(ctx, q); err != nil {
			tx.Rollback()
			log.Printf("Error creating table: %v for query: %s\n", err, q)
			return err
		}
	}

	migrations := []string{
		"ALTER TABLE configuracoes ADD COLUMN logo_instituicao TEXT DEFAULT '';",
		"ALTER TABLE configuracoes ADD COLUMN assinatura_instituicao TEXT DEFAULT '';",
		"ALTER TABLE configuracoes ADD COLUMN endereco_instituicao TEXT DEFAULT '';",
		"ALTER TABLE configuracoes ADD COLUMN telefone_instituicao TEXT DEFAULT '';",
		"ALTER TABLE configuracoes ADD COLUMN telegram_bot_token TEXT DEFAULT '';",
		"ALTER TABLE alunos ADD COLUMN telefone_responsavel TEXT DEFAULT '';",
		"ALTER TABLE alunos ADD COLUMN telegram_chat_id TEXT DEFAULT '';",
		"CREATE INDEX IF NOT EXISTS idx_alunos_turma ON alunos(turma);",
		"CREATE INDEX IF NOT EXISTS idx_acessos_data_hora ON acessos(data_hora);",
	}

	for _, m := range migrations {
		_, _ = tx.ExecContext(ctx, m) // ignore column already exists
	}

	return tx.Commit()
}
