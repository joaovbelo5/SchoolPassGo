package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/joaob/schoolpassgo/internal/database"
	"github.com/joaob/schoolpassgo/internal/models"
)

// GetConfig retrieves the system configuration
func GetConfig() (models.Configuracao, error) {
	var c models.Configuracao
	err := database.DB.QueryRow("SELECT id, nome_instituicao, tempo_minimo_minutos, diretorio_imagens, COALESCE(logo_instituicao,''), COALESCE(assinatura_instituicao,''), COALESCE(endereco_instituicao,''), COALESCE(telefone_instituicao,''), COALESCE(telegram_bot_token,'') FROM configuracoes WHERE id = 1").
		Scan(&c.ID, &c.NomeInstituicao, &c.TempoMinimoMinutos, &c.DiretorioImagens, &c.LogoInstituicao, &c.AssinaturaInstituicao, &c.EnderecoInstituicao, &c.TelefoneInstituicao, &c.TelegramBotToken)
	return c, err
}

// UpdateConfig updates the system configuration
func UpdateConfig(c models.Configuracao) error {
	_, err := database.DB.Exec("UPDATE configuracoes SET nome_instituicao=?, tempo_minimo_minutos=?, diretorio_imagens=?, logo_instituicao=?, assinatura_instituicao=?, endereco_instituicao=?, telefone_instituicao=?, telegram_bot_token=? WHERE id = 1",
		c.NomeInstituicao, c.TempoMinimoMinutos, c.DiretorioImagens, c.LogoInstituicao, c.AssinaturaInstituicao, c.EnderecoInstituicao, c.TelefoneInstituicao, c.TelegramBotToken)
	return err
}

// CreateAluno inserts a new student
func CreateAluno(a models.Aluno) (int, error) {
	result, err := database.DB.Exec("INSERT INTO alunos (nome, turma, turno, foto, codigo_barras, telefone_responsavel, telegram_chat_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
		a.Nome, a.Turma, a.Turno, a.Foto, a.CodigoBarras, a.TelefoneResponsavel, a.TelegramChatID)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return int(id), err
}

// UpdateAluno updates an existing student
func UpdateAluno(a models.Aluno) error {
	_, err := database.DB.Exec("UPDATE alunos SET nome=?, turma=?, turno=?, foto=?, codigo_barras=?, telefone_responsavel=?, telegram_chat_id=? WHERE id=?",
		a.Nome, a.Turma, a.Turno, a.Foto, a.CodigoBarras, a.TelefoneResponsavel, a.TelegramChatID, a.ID)
	return err
}

// DeleteAluno deletes a student
func DeleteAluno(id int) error {
	_, err := database.DB.Exec("DELETE FROM alunos WHERE id=?", id)
	return err
}

// GetAlunos returns all students
func GetAlunos() ([]models.Aluno, error) {
	rows, err := database.DB.Query("SELECT id, nome, turma, turno, foto, codigo_barras, COALESCE(telefone_responsavel,''), COALESCE(telegram_chat_id,'') FROM alunos ORDER BY nome ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alunos []models.Aluno
	for rows.Next() {
		var a models.Aluno
		if err := rows.Scan(&a.ID, &a.Nome, &a.Turma, &a.Turno, &a.Foto, &a.CodigoBarras, &a.TelefoneResponsavel, &a.TelegramChatID); err != nil {
			return nil, err
		}
		alunos = append(alunos, a)
	}
	return alunos, nil
}

// GetAlunoByBarcode finds a student by their barcode
func GetAlunoByBarcode(barcode string) (models.Aluno, error) {
	var a models.Aluno
	err := database.DB.QueryRow("SELECT id, nome, turma, turno, foto, codigo_barras, COALESCE(telefone_responsavel,''), COALESCE(telegram_chat_id,'') FROM alunos WHERE codigo_barras = ?", barcode).
		Scan(&a.ID, &a.Nome, &a.Turma, &a.Turno, &a.Foto, &a.CodigoBarras, &a.TelefoneResponsavel, &a.TelegramChatID)
	if errors.Is(err, sql.ErrNoRows) {
		return a, errors.New("aluno não encontrado")
	}
	return a, err
}

// GetLastAcesso finds the most recent access log for a student
func GetLastAcesso(alunoID int) (models.Acesso, error) {
	var a models.Acesso
	var dataHoraStr string
	err := database.DB.QueryRow("SELECT id, aluno_id, data_hora, tipo FROM acessos WHERE aluno_id = ? ORDER BY data_hora DESC LIMIT 1", alunoID).
		Scan(&a.ID, &a.AlunoID, &dataHoraStr, &a.Tipo)
		
	if err == nil {
		a.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
	}

	return a, err
}

// RegisterAcesso logs a new entry/exit
func RegisterAcesso(alunoID int, tipo string) error {
	_, err := database.DB.Exec("INSERT INTO acessos (aluno_id, data_hora, tipo) VALUES (?, ?, ?)",
		alunoID, time.Now().Format(time.RFC3339Nano), tipo)
	return err
}

// GetRecentAcessos returns the latest access logs across all students
func GetRecentAcessos(limit int) ([]models.Acesso, error) {
	rows, err := database.DB.Query(`
		SELECT ac.id, ac.aluno_id, ac.data_hora, ac.tipo, al.nome, al.turma, al.turno 
		FROM acessos ac
		JOIN alunos al ON ac.aluno_id = al.id
		ORDER BY ac.data_hora DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acessos []models.Acesso
	for rows.Next() {
		var a models.Acesso
		var dataHoraStr string
		if err := rows.Scan(&a.ID, &a.AlunoID, &dataHoraStr, &a.Tipo, &a.AlunoNome, &a.AlunoTurma, &a.AlunoTurno); err != nil {
			return nil, err
		}
		a.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
		acessos = append(acessos, a)
	}
	return acessos, nil
}

// GetAcessosByAluno returns the access logs for a specific student
func GetAcessosByAluno(alunoID int) ([]models.Acesso, error) {
	rows, err := database.DB.Query(`
		SELECT id, aluno_id, data_hora, tipo
		FROM acessos 
		WHERE aluno_id = ?
		ORDER BY data_hora DESC`, alunoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acessos []models.Acesso
	for rows.Next() {
		var a models.Acesso
		var dataHoraStr string
		if err := rows.Scan(&a.ID, &a.AlunoID, &dataHoraStr, &a.Tipo); err != nil {
			return nil, err
		}
		a.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
		acessos = append(acessos, a)
	}
	return acessos, nil
}

// GetAcessosByDate returns the access logs for a specific date (YYYY-MM-DD)
func GetAcessosByDate(date string) ([]models.Acesso, error) {
	query := `SELECT ac.id, ac.aluno_id, ac.data_hora, ac.tipo, a.nome, a.turma, a.turno 
			  FROM acessos ac 
			  JOIN alunos a ON ac.aluno_id = a.id
			  WHERE ac.data_hora LIKE ?
			  ORDER BY ac.data_hora DESC`
	rows, err := database.DB.Query(query, date+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acessos []models.Acesso
	for rows.Next() {
		var a models.Acesso
		var dataHoraStr string
		if err := rows.Scan(&a.ID, &a.AlunoID, &dataHoraStr, &a.Tipo, &a.AlunoNome, &a.AlunoTurma, &a.AlunoTurno); err != nil {
			return nil, err
		}
		a.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
		acessos = append(acessos, a)
	}
	return acessos, nil
}

// UpdateTelegramChatID links a parent's chat ID to an existing phone number
func UpdateTelegramChatID(telefone, chatID string) (models.Aluno, error) {
	var a models.Aluno
	err := database.DB.QueryRow("SELECT id, nome FROM alunos WHERE telefone_responsavel = ?", telefone).Scan(&a.ID, &a.Nome)
	if err != nil {
		return a, err
	}
	_, err = database.DB.Exec("UPDATE alunos SET telegram_chat_id = ? WHERE id = ?", chatID, a.ID)
	return a, err
}

// GetAlunosByTurma returns all students in a specific class
func GetAlunosByTurma(turma string) ([]models.Aluno, error) {
	rows, err := database.DB.Query("SELECT id, nome, turma, turno, foto, codigo_barras, COALESCE(telefone_responsavel,''), COALESCE(telegram_chat_id,'') FROM alunos WHERE turma = ? ORDER BY nome ASC", turma)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alunos []models.Aluno
	for rows.Next() {
		var a models.Aluno
		if err := rows.Scan(&a.ID, &a.Nome, &a.Turma, &a.Turno, &a.Foto, &a.CodigoBarras, &a.TelefoneResponsavel, &a.TelegramChatID); err != nil {
			return nil, err
		}
		alunos = append(alunos, a)
	}
	return alunos, nil
}

// GetAluno returns a single student by ID
func GetAluno(id int) (models.Aluno, error) {
	var a models.Aluno
	err := database.DB.QueryRow("SELECT id, nome, turma, turno, foto, codigo_barras, COALESCE(telefone_responsavel,''), COALESCE(telegram_chat_id,'') FROM alunos WHERE id = ?", id).
		Scan(&a.ID, &a.Nome, &a.Turma, &a.Turno, &a.Foto, &a.CodigoBarras, &a.TelefoneResponsavel, &a.TelegramChatID)
	return a, err
}

// GetAcessosMesTurma returns all entry logs for a class in a specific month
func GetAcessosMesTurma(turma string, prefix string) ([]models.Acesso, error) {
	query := `SELECT ac.id, ac.aluno_id, ac.data_hora, ac.tipo 
			  FROM acessos ac 
			  JOIN alunos a ON ac.aluno_id = a.id
			  WHERE a.turma = ? AND ac.tipo = 'entrada' AND ac.data_hora LIKE ?`
	rows, err := database.DB.Query(query, turma, prefix+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acessos []models.Acesso
	for rows.Next() {
		var a models.Acesso
		var dataHoraStr string
		if err := rows.Scan(&a.ID, &a.AlunoID, &dataHoraStr, &a.Tipo); err != nil {
			return nil, err
		}
		a.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
		acessos = append(acessos, a)
	}
	return acessos, nil
}

// GetOcorrenciasByAluno returns active occurrences for a student
func GetOcorrenciasByAluno(alunoID int) ([]models.Ocorrencia, error) {
	rows, err := database.DB.Query(`
		SELECT id, aluno_id, data_hora, classificacao, descricao, registrado_por, historico_edicao, deletado_em 
		FROM ocorrencias 
		WHERE aluno_id = ? AND deletado_em IS NULL
		ORDER BY data_hora DESC`, alunoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ocorrencias []models.Ocorrencia
	for rows.Next() {
		var o models.Ocorrencia
		var dataHoraStr string
		var deletadoEmStr *string
		if err := rows.Scan(&o.ID, &o.AlunoID, &dataHoraStr, &o.Classificacao, &o.Descricao, &o.RegistradoPor, &o.HistoricoEdicao, &deletadoEmStr); err != nil {
			return nil, err
		}
		o.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
		if deletadoEmStr != nil && *deletadoEmStr != "" {
			t, _ := time.Parse(time.RFC3339Nano, *deletadoEmStr)
			o.DeletadoEm = &t
		}
		ocorrencias = append(ocorrencias, o)
	}
	return ocorrencias, nil
}

// CreateOcorrencia inserts a new occurence
func CreateOcorrencia(o models.Ocorrencia) (int, error) {
	result, err := database.DB.Exec(`
		INSERT INTO ocorrencias (aluno_id, data_hora, classificacao, descricao, registrado_por, historico_edicao)
		VALUES (?, ?, ?, ?, ?, ?)`,
		o.AlunoID, o.DataHora.Format(time.RFC3339Nano), o.Classificacao, o.Descricao, o.RegistradoPor, o.HistoricoEdicao)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return int(id), err
}

// UpdateOcorrencia modifies an occurrence and logs exactly what happened
func UpdateOcorrencia(o models.Ocorrencia) error {
	_, err := database.DB.Exec(`
		UPDATE ocorrencias 
		SET classificacao = ?, descricao = ?, historico_edicao = ?
		WHERE id = ?`,
		o.Classificacao, o.Descricao, o.HistoricoEdicao, o.ID)
	return err
}

// GetOcorrenciaByID gets a single occurrence strictly to read before updating
func GetOcorrenciaByID(id int) (models.Ocorrencia, error) {
	var o models.Ocorrencia
	var dataHoraStr string
	err := database.DB.QueryRow(`
		SELECT id, aluno_id, data_hora, classificacao, descricao, registrado_por, historico_edicao 
		FROM ocorrencias WHERE id = ?`, id).Scan(&o.ID, &o.AlunoID, &dataHoraStr, &o.Classificacao, &o.Descricao, &o.RegistradoPor, &o.HistoricoEdicao)
	
	if err == nil {
		o.DataHora, _ = time.Parse(time.RFC3339Nano, dataHoraStr)
	}
	return o, err
}

// SoftDeleteOcorrencia moves an occurrence to the 30-day trash bin
func SoftDeleteOcorrencia(id int) error {
	_, err := database.DB.Exec(`UPDATE ocorrencias SET deletado_em = ? WHERE id = ?`, time.Now().Format(time.RFC3339Nano), id)
	return err
}

// CleanLixeiraOcorrencias permanently deletes soft-deleted records older than 30 days
func CleanLixeiraOcorrencias() error {
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30).Format(time.RFC3339Nano)
	_, err := database.DB.Exec(`DELETE FROM ocorrencias WHERE deletado_em IS NOT NULL AND deletado_em < ?`, thirtyDaysAgo)
	return err
}

// ArchiveDatabase converts the current database into an archive snapshot and completely wipes active non-config data.
func ArchiveDatabase(ano string) error {
	// 1. Create uploads/arquivos directory
	archiveDir := "uploads/arquivos"
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return err
	}

	// 2. Clone SQLite database via file system
	// Using the actual database file name from database.go (assuming "escola.db")
	sourcePath := "escola.db"
	destPath := filepath.Join(archiveDir, fmt.Sprintf("arquivo_%s.db", ano))

	// Ensure destination doesn't exist
	if _, err := os.Stat(destPath); err == nil {
		return fmt.Errorf("Um arquivo para esse nome já existe. Tente outro nome.")
	}

	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return err
	}

	// Wait! We successfully copied the DB. Now completely wipe current DB tables.
	// Since we keep config table, we only delete from volatile ones.
	
	ctx := context.Background()
	tx, err := database.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	queries := []string{
		"DELETE FROM ocorrencias;",
		"DELETE FROM acessos;",
		"DELETE FROM alunos;",
	}

	for _, q := range queries {
		if _, err := tx.Exec(q); err != nil {
			tx.Rollback()
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// After wiping, vacuum db to reclaim storage space
	_, _ = database.DB.Exec("VACUUM;")

	return nil
}

// GetDashboardStats retrieves all aggregated statistics for the admin dashboard
func GetDashboardStats() (models.DashboardStats, error) {
	var stats models.DashboardStats

	// Total students
	database.DB.QueryRow("SELECT COUNT(*) FROM alunos").Scan(&stats.TotalAlunos)

	// Students without photo
	database.DB.QueryRow("SELECT COUNT(*) FROM alunos WHERE foto = '' OR foto IS NULL").Scan(&stats.SemFoto)

	// Students without Telegram
	database.DB.QueryRow("SELECT COUNT(*) FROM alunos WHERE telegram_chat_id = '' OR telegram_chat_id IS NULL").Scan(&stats.SemTelegram)

	// Total distinct classes
	database.DB.QueryRow("SELECT COUNT(DISTINCT turma) FROM alunos WHERE turma != '' AND turma IS NOT NULL").Scan(&stats.TotalTurmas)

	// Active occurrences (not in trash)
	database.DB.QueryRow("SELECT COUNT(*) FROM ocorrencias WHERE deletado_em IS NULL").Scan(&stats.TotalOcorrencias)

	// Entries and exits today
	rows, err := database.DB.Query("SELECT tipo, COUNT(*) FROM acessos WHERE DATE(data_hora) = DATE('now','localtime') GROUP BY tipo")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tipo string
			var count int
			if rows.Scan(&tipo, &count) == nil {
				if tipo == "entrada" {
					stats.EntradasHoje = count
				} else {
					stats.SaidasHoje = count
				}
			}
		}
	}

	// Presences by shift today (students who have an 'entrada' today)
	shiftRows, err := database.DB.Query(`
		SELECT a.turno, COUNT(DISTINCT ac.aluno_id) as presentes,
		       (SELECT COUNT(*) FROM alunos a2 WHERE a2.turno = a.turno) as total
		FROM acessos ac
		JOIN alunos a ON ac.aluno_id = a.id
		WHERE ac.tipo = 'entrada' AND DATE(ac.data_hora) = DATE('now','localtime')
		GROUP BY a.turno
		ORDER BY a.turno ASC
	`)
	if err == nil {
		defer shiftRows.Close()
		for shiftRows.Next() {
			var tc models.TurnoCounts
			if shiftRows.Scan(&tc.Turno, &tc.Presentes, &tc.Total) == nil {
				stats.PresencasPorTurno = append(stats.PresencasPorTurno, tc)
			}
		}
	}
	if stats.PresencasPorTurno == nil {
		stats.PresencasPorTurno = []models.TurnoCounts{}
	}

	// Last 5 accesses with student info
	recentRows, err := database.DB.Query(`
		SELECT ac.id, ac.aluno_id, ac.data_hora, ac.tipo, a.nome, a.turma, a.turno
		FROM acessos ac
		JOIN alunos a ON ac.aluno_id = a.id
		ORDER BY ac.data_hora DESC
		LIMIT 5
	`)
	if err == nil {
		defer recentRows.Close()
		for recentRows.Next() {
			var ac models.Acesso
			var dh string
			if recentRows.Scan(&ac.ID, &ac.AlunoID, &dh, &ac.Tipo, &ac.AlunoNome, &ac.AlunoTurma, &ac.AlunoTurno) == nil {
				ac.DataHora, _ = time.Parse(time.RFC3339Nano, dh)
				stats.UltimosAcessos = append(stats.UltimosAcessos, ac)
			}
		}
	}
	if stats.UltimosAcessos == nil {
		stats.UltimosAcessos = []models.Acesso{}
	}

	return stats, nil
}
