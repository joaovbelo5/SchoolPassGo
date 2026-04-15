package handlers

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/joaob/schoolpassgo/internal/database"
	"github.com/joaob/schoolpassgo/internal/models"
	"github.com/joaob/schoolpassgo/internal/repository"
	"github.com/joaob/schoolpassgo/internal/telegram"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// API Error Response
type ErrorResponse struct {
	Error string `json:"error"`
}

func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func sendError(w http.ResponseWriter, status int, message string) {
	sendJSON(w, status, ErrorResponse{Error: message})
}

func GetDashboardStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := repository.GetDashboardStats()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar estatísticas: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, stats)
}

func GetConfigHandler(w http.ResponseWriter, r *http.Request) {
	config, err := repository.GetConfig()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar configurações")
		return
	}
	sendJSON(w, http.StatusOK, config)
}

func UpdateConfigHandler(w http.ResponseWriter, r *http.Request) {
	var c models.Configuracao
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		sendError(w, http.StatusBadRequest, "Dados inválidos")
		return
	}

	saveImage := func(base64Data, filename string) string {
		if strings.HasPrefix(base64Data, "data:image/") {
			parts := strings.SplitN(base64Data, ",", 2)
			if len(parts) == 2 {
				data, err := base64.StdEncoding.DecodeString(parts[1])
				if err == nil {
					fullPath := filepath.Join("uploads", filename)
					os.WriteFile(fullPath, data, 0644)
					return "/" + filepath.ToSlash(fullPath) + "?t=" + strconv.FormatInt(time.Now().Unix(), 10)
				}
			}
		}
		return base64Data
	}

	c.LogoInstituicao = saveImage(c.LogoInstituicao, "logo.png")
	c.AssinaturaInstituicao = saveImage(c.AssinaturaInstituicao, "assinatura.png")

	if err := repository.UpdateConfig(c); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao atualizar opções")
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Configurações atualizadas"})
}

func GetTurmasHandler(w http.ResponseWriter, r *http.Request) {
	turmas, err := repository.GetTurmas()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao listar turmas")
		return
	}
	if turmas == nil {
		turmas = []string{}
	}
	sendJSON(w, http.StatusOK, turmas)
}

func GetAlunosHandler(w http.ResponseWriter, r *http.Request) {
	alunos, err := repository.GetAlunos()
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao listar alunos")
		return
	}
	if alunos == nil {
		alunos = []models.Aluno{}
	}
	sendJSON(w, http.StatusOK, alunos)
}

func GetAlunoFotoHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	foto, err := repository.GetAlunoFoto(id)
	if err != nil || foto == "" || len(foto) < 10 {
		http.Error(w, "Sem foto", http.StatusNotFound)
		return
	}

	parts := strings.SplitN(foto, ",", 2)
	var rawData string
	mimeType := "image/jpeg"

	if len(parts) == 2 {
		rawData = parts[1]
		if strings.HasPrefix(parts[0], "data:") && strings.HasSuffix(parts[0], ";base64") {
			mimeType = strings.TrimSuffix(strings.TrimPrefix(parts[0], "data:"), ";base64")
		}
	} else {
		rawData = foto
	}

	data, err := base64.StdEncoding.DecodeString(rawData)
	if err != nil {
		http.Error(w, "Erro ao decodificar", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Cache-Control", "public, max-age=86400") // Cache por 1 dia no front
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func CreateAlunoHandler(w http.ResponseWriter, r *http.Request) {
	var a models.Aluno
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		sendError(w, http.StatusBadRequest, "Dados inválidos")
		return
	}

	if a.CodigoBarras == "" {
		bg := repository.NewBarcodeGenerator()
		a.CodigoBarras = bg.Generate(a.Turma, a.Turno)
	}

	// O sistema de Banco de Dados agora armazena explicitamente o Base64 na coluna Foto (SQLite Blob-String)
	// Eliminando dependências locais que prejudicam a criação de snapshots limpos e portáteis.

	id, err := repository.CreateAluno(a)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao criar aluno: "+err.Error())
		return
	}
	a.ID = id
	sendJSON(w, http.StatusCreated, a)
}

func UpdateAlunoHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	var a models.Aluno
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		sendError(w, http.StatusBadRequest, "Dados inválidos")
		return
	}
	a.ID = id

	if a.CodigoBarras == "" {
		bg := repository.NewBarcodeGenerator()
		a.CodigoBarras = bg.Generate(a.Turma, a.Turno)
	}

	if a.Foto == "" {
		// Mantém a foto atual
		velho, _ := repository.GetAlunoFoto(id)
		a.Foto = velho
	} else if a.Foto == "__EXCLUIR__" {
		a.Foto = ""
	}
	if err := repository.UpdateAluno(a); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao atualizar aluno: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, a)
}

func DeleteAlunoHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}
	if err := repository.DeleteAluno(id); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao excluir aluno")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func GetAcessosHandler(w http.ResponseWriter, r *http.Request) {
	dataFiltro := r.URL.Query().Get("data")

	var acessos []models.Acesso
	var err error

	if dataFiltro != "" {
		acessos, err = repository.GetAcessosByDate(dataFiltro)
	} else {
		acessos, err = repository.GetRecentAcessos(50)
	}

	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar histórico")
		return
	}
	if acessos == nil {
		acessos = []models.Acesso{}
	}
	sendJSON(w, http.StatusOK, acessos)
}

// TotemRegistroHandler handles the core logic of the Totem Registration
func TotemRegistroHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CodigoBarras string `json:"codigo_barras"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.CodigoBarras == "" {
		sendError(w, http.StatusBadRequest, "Código de barras inválido")
		return
	}

	aluno, err := repository.GetAlunoByBarcode(req.CodigoBarras)
	if err != nil {
		sendError(w, http.StatusNotFound, "Aluno não encontrado")
		return
	}

	config, _ := repository.GetConfig()
	delay := config.TempoMinimoMinutos
	if delay <= 0 {
		delay = 5
	}

	lastAcesso, err := repository.GetLastAcesso(aluno.ID)
	tipoNovo := "entrada"

	if err == nil && lastAcesso.ID > 0 {
		now := time.Now()
		isSameDay := lastAcesso.DataHora.Year() == now.Year() &&
			lastAcesso.DataHora.YearDay() == now.YearDay()

		elapsed := time.Since(lastAcesso.DataHora)
		if elapsed.Minutes() < float64(delay) {
			sendError(w, http.StatusTooManyRequests, "Aguarde o tempo mínimo para registrar novamente.")
			return
		}

		// Apenas alterna para "saida" se for "entrada" NO MESMO DIA
		if isSameDay && lastAcesso.Tipo == "entrada" {
			tipoNovo = "saida"
		}
	}

	if err := repository.RegisterAcesso(aluno.ID, tipoNovo); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao salvar o registro")
		return
	}

	if aluno.TelegramChatID != "" {
		horaFormatada := time.Now().Format("15:04")
		texto := "*" + aluno.Nome + "* realizou a *" + strings.ToUpper(tipoNovo) + "* às *" + horaFormatada + "*."
		telegram.SendMessage(aluno.TelegramChatID, texto)
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Registro efetuado",
		"aluno":   aluno,
		"tipo":    tipoNovo,
	})
}

func GetAcessosAlunoHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	acessos, err := repository.GetAcessosByAluno(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar histórico do aluno")
		return
	}
	if acessos == nil {
		acessos = []models.Acesso{}
	}
	sendJSON(w, http.StatusOK, acessos)
}

type ChamadaAlunoResult struct {
	ID   int    `json:"id"`
	Nome string `json:"nome"`
	Dias []int  `json:"dias"`
}

func GerarChamadaHandler(w http.ResponseWriter, r *http.Request) {
	turma := r.URL.Query().Get("turma")
	mesStr := r.URL.Query().Get("mes")
	anoStr := r.URL.Query().Get("ano")

	if turma == "" || mesStr == "" || anoStr == "" {
		sendError(w, http.StatusBadRequest, "Parâmetros 'turma', 'mes' e 'ano' são obrigatórios")
		return
	}

	mes, _ := strconv.Atoi(mesStr)
	ano, _ := strconv.Atoi(anoStr)

	prefix := fmt.Sprintf("%04d-%02d-", ano, mes)

	alunos, err := repository.GetAlunosByTurma(turma)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar alunos")
		return
	}

	acessos, err := repository.GetAcessosMesTurma(turma, prefix)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar acessos")
		return
	}

	acessoMap := make(map[int]map[int]bool)
	for _, a := range acessos {
		if acessoMap[a.AlunoID] == nil {
			acessoMap[a.AlunoID] = make(map[int]bool)
		}
		acessoMap[a.AlunoID][a.DataHora.Day()] = true
	}

	var resultado []ChamadaAlunoResult
	for _, a := range alunos {
		var dias []int
		if mapDias, ok := acessoMap[a.ID]; ok {
			for dia := range mapDias {
				dias = append(dias, dia)
			}
		}
		if dias == nil {
			dias = []int{}
		}
		resultado = append(resultado, ChamadaAlunoResult{
			ID:   a.ID,
			Nome: a.Nome,
			Dias: dias,
		})
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"turma":  turma,
		"mes":    mes,
		"ano":    ano,
		"alunos": resultado,
	})
}

// Struct for creating/updating occurrences
type NovaOcorrenciaReq struct {
	Classificacao  string `json:"classificacao"`
	Descricao      string `json:"descricao"`
	RegistradoPor  string `json:"registrado_por"`
	EnviarTelegram bool   `json:"enviar_telegram"`
}

func GetOcorrenciasHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}
	ocorrencias, err := repository.GetOcorrenciasByAluno(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao buscar ocorrências")
		return
	}
	if ocorrencias == nil {
		ocorrencias = []models.Ocorrencia{}
	}
	sendJSON(w, http.StatusOK, ocorrencias)
}

func CreateOcorrenciaHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	alunoID, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	var req NovaOcorrenciaReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Parâmetros inválidos")
		return
	}

	o := models.Ocorrencia{
		AlunoID:         alunoID,
		DataHora:        time.Now(),
		Classificacao:   req.Classificacao,
		Descricao:       req.Descricao,
		RegistradoPor:   req.RegistradoPor,
		HistoricoEdicao: "[]",
	}

	id, err := repository.CreateOcorrencia(o)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao salvar ocorrência")
		return
	}
	o.ID = id

	if req.EnviarTelegram {
		aluno, _ := repository.GetAluno(alunoID)
		if aluno.TelegramChatID != "" {
			texto := fmt.Sprintf("⚠️ *Aviso Disciplinar*\nAluno: %s\nMedida: %s\nMotivo: %s", aluno.Nome, req.Classificacao, req.Descricao)
			telegram.SendMessage(aluno.TelegramChatID, texto)
		}
	}

	sendJSON(w, http.StatusCreated, o)
}

func UpdateOcorrenciaHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	oID, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	var req NovaOcorrenciaReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Parâmetros inválidos")
		return
	}

	velha, err := repository.GetOcorrenciaByID(oID)
	if err != nil {
		sendError(w, http.StatusNotFound, "Ocorrência não encontrada")
		return
	}

	type EditItem struct {
		Data          string `json:"data"`
		Classificacao string `json:"classificacao"`
		Descricao     string `json:"descricao"`
	}

	var hist []EditItem
	if velha.HistoricoEdicao != "" {
		json.Unmarshal([]byte(velha.HistoricoEdicao), &hist)
	}

	hist = append(hist, EditItem{
		Data:          time.Now().Format("02/01/2006 15:04"),
		Classificacao: velha.Classificacao,
		Descricao:     velha.Descricao,
	})

	bytesHist, _ := json.Marshal(hist)

	velha.Classificacao = req.Classificacao
	velha.Descricao = req.Descricao
	velha.HistoricoEdicao = string(bytesHist)

	err = repository.UpdateOcorrencia(velha)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao atualizar")
		return
	}

	if req.EnviarTelegram {
		aluno, _ := repository.GetAluno(velha.AlunoID)
		if aluno.TelegramChatID != "" {
			texto := fmt.Sprintf("⚠️ *Atualização Disciplinar*\nAluno: %s\nMedida Atual: %s\nMotivo: %s", aluno.Nome, req.Classificacao, req.Descricao)
			telegram.SendMessage(aluno.TelegramChatID, texto)
		}
	}

	sendJSON(w, http.StatusOK, velha)
}

func DeleteOcorrenciaHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	err = repository.SoftDeleteOcorrencia(id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao mover para lixeira")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ARQUIVO MORTO HANDLERS
func GerarArquivoHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Ano         string `json:"ano"`
		Confirmacao string `json:"confirmacao"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Parâmetros inválidos")
		return
	}
	if req.Confirmacao != "CONFIRMAR DELEÇÃO" {
		sendError(w, http.StatusForbidden, "Frase de segurança incorreta")
		return
	}
	if req.Ano == "" {
		sendError(w, http.StatusBadRequest, "Nome do ano é obrigatório")
		return
	}

	if err := repository.ArchiveDatabase(req.Ano); err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao gerar arquivo: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Arquivo gerado e sistema limpo."})
}

func ListArquivosHandler(w http.ResponseWriter, r *http.Request) {
	dir := "uploads/arquivos"
	files, err := os.ReadDir(dir)
	var anos []string
	if err == nil {
		for _, f := range files {
			if !f.IsDir() && strings.HasPrefix(f.Name(), "arquivo_") && strings.HasSuffix(f.Name(), ".db") {
				name := f.Name()
				ano := strings.TrimSuffix(strings.TrimPrefix(name, "arquivo_"), ".db")
				anos = append(anos, ano)
			}
		}
	}
	sendJSON(w, http.StatusOK, anos)
}

func GetArquivoAlunosHandler(w http.ResponseWriter, r *http.Request) {
	ano := r.PathValue("ano")
	dbPath := filepath.Join("uploads/arquivos", "arquivo_"+ano+".db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		sendError(w, http.StatusNotFound, "Arquivo não encontrado")
		return
	}

	archDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao abrir base: "+err.Error())
		return
	}
	defer archDB.Close()

	rows, err := archDB.Query("SELECT id, nome, turma, turno, foto, codigo_barras, COALESCE(telefone_responsavel,''), COALESCE(telegram_chat_id,'') FROM alunos ORDER BY nome ASC")
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao ler base")
		return
	}
	defer rows.Close()

	var alunos []models.Aluno
	for rows.Next() {
		var a models.Aluno
		if err := rows.Scan(&a.ID, &a.Nome, &a.Turma, &a.Turno, &a.Foto, &a.CodigoBarras, &a.TelefoneResponsavel, &a.TelegramChatID); err == nil {
			alunos = append(alunos, a)
		}
	}
	if alunos == nil {
		alunos = []models.Aluno{}
	}
	sendJSON(w, http.StatusOK, alunos)
}

func GetArquivoDossieHandler(w http.ResponseWriter, r *http.Request) {
	ano := r.PathValue("ano")
	idStr := r.PathValue("id")

	dbPath := filepath.Join("uploads/arquivos", "arquivo_"+ano+".db")
	archDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Erro ao abrir base: "+err.Error())
		return
	}
	defer archDB.Close()

	// Get Acessos
	acRows, _ := archDB.Query("SELECT id, aluno_id, data_hora, tipo FROM acessos WHERE aluno_id = ? ORDER BY data_hora DESC", idStr)
	var acessos []models.Acesso
	if acRows != nil {
		for acRows.Next() {
			var a models.Acesso
			var dh string
			if err := acRows.Scan(&a.ID, &a.AlunoID, &dh, &a.Tipo); err == nil {
				a.DataHora, _ = time.Parse(time.RFC3339Nano, dh)
				acessos = append(acessos, a)
			}
		}
		acRows.Close()
	}

	// Get Ocorrencias
	ocRows, _ := archDB.Query("SELECT id, aluno_id, data_hora, classificacao, descricao, registrado_por, historico_edicao FROM ocorrencias WHERE aluno_id = ? AND deletado_em IS NULL ORDER BY data_hora DESC", idStr)
	var ocorrencias []models.Ocorrencia
	if ocRows != nil {
		for ocRows.Next() {
			var o models.Ocorrencia
			var dh string
			if err := ocRows.Scan(&o.ID, &o.AlunoID, &dh, &o.Classificacao, &o.Descricao, &o.RegistradoPor, &o.HistoricoEdicao); err == nil {
				o.DataHora, _ = time.Parse(time.RFC3339Nano, dh)
				ocorrencias = append(ocorrencias, o)
			}
		}
		ocRows.Close()
	}

	if acessos == nil {
		acessos = []models.Acesso{}
	}
	if ocorrencias == nil {
		ocorrencias = []models.Ocorrencia{}
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"acessos":     acessos,
		"ocorrencias": ocorrencias,
	})
}

// BackupHandler creates a ZIP file containing escola.db and all archive DBs, served for download.
func BackupHandler(w http.ResponseWriter, r *http.Request) {
	// Checkpoint WAL to ensure all data is in the main db file
	_, _ = database.DB.Exec("PRAGMA wal_checkpoint(FULL)")

	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Add main database
	addFileToZip(zw, "escola.db", "escola.db")

	// Add archive databases
	archiveDir := "uploads/arquivos"
	if entries, err := os.ReadDir(archiveDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".db") {
				src := filepath.Join(archiveDir, e.Name())
				addFileToZip(zw, src, "arquivos/"+e.Name())
			}
		}
	}

	zw.Close()

	filename := "backup_schoolpassgo_" + time.Now().Format("20060102_150405") + ".zip"
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	w.WriteHeader(http.StatusOK)
	io.Copy(w, buf)
}

func addFileToZip(zw *zip.Writer, srcPath, destName string) {
	f, err := os.Open(srcPath)
	if err != nil {
		return
	}
	defer f.Close()

	fw, err := zw.Create(destName)
	if err != nil {
		return
	}
	io.Copy(fw, f)
}

// RestaurarHandler receives a ZIP backup file and restores the database(s).
func RestaurarHandler(w http.ResponseWriter, r *http.Request) {
	// Limit upload size to 500MB
	r.Body = http.MaxBytesReader(w, r.Body, 500<<20)

	file, _, err := r.FormFile("backup")
	if err != nil {
		sendError(w, http.StatusBadRequest, "Arquivo de backup não encontrado na requisição: "+err.Error())
		return
	}
	defer file.Close()

	// Read the zip into memory
	data, err := io.ReadAll(file)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Erro ao ler arquivo: "+err.Error())
		return
	}

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Arquivo ZIP inválido: "+err.Error())
		return
	}

	// Validate that escola.db is present
	hasMain := false
	for _, f := range zr.File {
		if f.Name == "escola.db" {
			hasMain = true
			break
		}
	}
	if !hasMain {
		sendError(w, http.StatusBadRequest, "ZIP inválido: escola.db não encontrado no backup")
		return
	}

	// Close active DB connection
	database.DB.Close()

	// Extract files
	var restoreErr error
	for _, f := range zr.File {
		var destPath string
		switch {
		case f.Name == "escola.db":
			destPath = "escola.db"
		case strings.HasPrefix(f.Name, "arquivos/") && strings.HasSuffix(f.Name, ".db"):
			os.MkdirAll("uploads/arquivos", 0755)
			destPath = filepath.Join("uploads", f.Name)
		default:
			continue
		}

		rc, err := f.Open()
		if err != nil {
			restoreErr = err
			break
		}

		// Write to temp file first, then rename atomically
		tmpPath := destPath + ".restore_tmp"
		out, err := os.Create(tmpPath)
		if err != nil {
			rc.Close()
			restoreErr = err
			break
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			os.Remove(tmpPath)
			restoreErr = err
			break
		}
		if err := os.Rename(tmpPath, destPath); err != nil {
			os.Remove(tmpPath)
			restoreErr = err
			break
		}
	}

	// Reconnect regardless of error
	if initErr := database.InitDB("escola.db"); initErr != nil {
		// Critical: could not reconnect
		sendError(w, http.StatusInternalServerError, "Banco restaurado mas falhou ao reconectar: "+initErr.Error())
		return
	}

	if restoreErr != nil {
		sendError(w, http.StatusInternalServerError, "Erro durante a extração: "+restoreErr.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Sistema restaurado com sucesso!"})
}

// ──── IMPORTAÇÃO DE ALUNOS (CSV/XLSX) ────

// normalizeHeader removes accents and lowercases a string for fuzzy column matching
func normalizeHeader(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)
	return strings.ToLower(strings.TrimSpace(result))
}

// findColumnIndex finds the index of a column matching any of the given normalized names
func findColumnIndex(headers []string, names ...string) int {
	for i, h := range headers {
		normalized := normalizeHeader(h)
		for _, name := range names {
			if normalized == name {
				return i
			}
		}
	}
	return -1
}

// ImportPreviewItem represents a single student parsed from the file, with duplicate info
type ImportPreviewItem struct {
	Nome      string `json:"nome"`
	Turma     string `json:"turma"`
	Turno     string `json:"turno"`
	Duplicado bool   `json:"duplicado"`
	Linha     int    `json:"linha"`
}

// ImportAlunosHandler parses a CSV or XLSX file and returns a preview of students found
func ImportAlunosHandler(w http.ResponseWriter, r *http.Request) {
	// Limit upload size to 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	file, header, err := r.FormFile("arquivo")
	if err != nil {
		sendError(w, http.StatusBadRequest, "Arquivo não encontrado na requisição: "+err.Error())
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Erro ao ler arquivo: "+err.Error())
		return
	}

	var rows [][]string
	filename := strings.ToLower(header.Filename)

	if strings.HasSuffix(filename, ".xlsx") || strings.HasSuffix(filename, ".xls") {
		// Parse Excel
		f, err := excelize.OpenReader(bytes.NewReader(data))
		if err != nil {
			sendError(w, http.StatusBadRequest, "Erro ao abrir arquivo Excel: "+err.Error())
			return
		}
		defer f.Close()

		// Use first sheet
		sheetName := f.GetSheetName(0)
		if sheetName == "" {
			sendError(w, http.StatusBadRequest, "Arquivo Excel sem planilhas")
			return
		}

		xlRows, err := f.GetRows(sheetName)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Erro ao ler planilha: "+err.Error())
			return
		}
		rows = xlRows

	} else if strings.HasSuffix(filename, ".csv") {
		// Parse CSV — try semicolon first (common in BR), then comma
		reader := csv.NewReader(bytes.NewReader(data))
		reader.Comma = ';'
		reader.LazyQuotes = true
		reader.FieldsPerRecord = -1

		csvRows, err := reader.ReadAll()
		if err != nil || len(csvRows) == 0 {
			// Retry with comma
			reader2 := csv.NewReader(bytes.NewReader(data))
			reader2.Comma = ','
			reader2.LazyQuotes = true
			reader2.FieldsPerRecord = -1
			csvRows, err = reader2.ReadAll()
			if err != nil {
				sendError(w, http.StatusBadRequest, "Erro ao ler CSV: "+err.Error())
				return
			}
		}

		// Heuristic: if semicolon parse gave 1 column but data contains commas, retry with comma
		if len(csvRows) > 0 && len(csvRows[0]) <= 1 && strings.Contains(string(data), ",") {
			reader2 := csv.NewReader(bytes.NewReader(data))
			reader2.Comma = ','
			reader2.LazyQuotes = true
			reader2.FieldsPerRecord = -1
			if csvRows2, err2 := reader2.ReadAll(); err2 == nil && len(csvRows2) > 0 && len(csvRows2[0]) > 1 {
				csvRows = csvRows2
			}
		}

		rows = csvRows
	} else {
		sendError(w, http.StatusBadRequest, "Formato de arquivo não suportado. Use .csv ou .xlsx")
		return
	}

	if len(rows) < 2 {
		sendError(w, http.StatusBadRequest, "Arquivo vazio ou sem dados suficientes (apenas cabeçalho)")
		return
	}

	// Find column indices from header row
	headerRow := rows[0]
	colNome := findColumnIndex(headerRow, "aluno", "nome", "nome do aluno", "nome completo", "estudante")
	colTurma := findColumnIndex(headerRow, "turma", "classe", "sala")
	colTurno := findColumnIndex(headerRow, "turno", "periodo", "horario")

	if colNome == -1 {
		sendError(w, http.StatusBadRequest, "Coluna 'Aluno' ou 'Nome' não encontrada no cabeçalho. Colunas detectadas: "+strings.Join(headerRow, ", "))
		return
	}

	// Load existing students for duplicate detection
	existingStudents, _ := repository.GetAlunos()
	existingSet := make(map[string]bool)
	for _, s := range existingStudents {
		key := strings.ToLower(strings.TrimSpace(s.Nome)) + "|" + strings.ToLower(strings.TrimSpace(s.Turma))
		existingSet[key] = true
	}

	var result []ImportPreviewItem

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if colNome >= len(row) {
			continue
		}

		nome := strings.TrimSpace(row[colNome])
		if nome == "" {
			continue
		}

		turma := ""
		if colTurma >= 0 && colTurma < len(row) {
			turma = strings.TrimSpace(row[colTurma])
		}

		turno := ""
		if colTurno >= 0 && colTurno < len(row) {
			turno = strings.TrimSpace(row[colTurno])
		}

		// Check if duplicate
		key := strings.ToLower(nome) + "|" + strings.ToLower(turma)
		duplicado := existingSet[key]

		result = append(result, ImportPreviewItem{
			Nome:      nome,
			Turma:     turma,
			Turno:     turno,
			Duplicado: duplicado,
			Linha:     i + 1, // 1-indexed, accounting for header
		})
	}

	if len(result) == 0 {
		sendError(w, http.StatusBadRequest, "Nenhum aluno encontrado no arquivo. Verifique se a coluna 'Aluno' ou 'Nome' contém dados.")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"alunos": result,
		"colunas": map[string]interface{}{
			"nome":  colNome >= 0,
			"turma": colTurma >= 0,
			"turno": colTurno >= 0,
		},
	})
}

// ConfirmImportRequest is the request body for confirming student import
type ConfirmImportRequest struct {
	Alunos []struct {
		Nome  string `json:"nome"`
		Turma string `json:"turma"`
		Turno string `json:"turno"`
	} `json:"alunos"`
}

// ConfirmImportAlunosHandler inserts confirmed students into the database
func ConfirmImportAlunosHandler(w http.ResponseWriter, r *http.Request) {
	var req ConfirmImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Dados inválidos: "+err.Error())
		return
	}

	if len(req.Alunos) == 0 {
		sendError(w, http.StatusBadRequest, "Nenhum aluno para importar")
		return
	}

	importados := 0
	erros := 0

	bg := repository.NewBarcodeGenerator()

	for _, a := range req.Alunos {
		if strings.TrimSpace(a.Nome) == "" {
			erros++
			continue
		}

		turmaLimpa := strings.TrimSpace(a.Turma)
		turnoLimpo := strings.TrimSpace(a.Turno)

		aluno := models.Aluno{
			Nome:         strings.TrimSpace(a.Nome),
			Turma:        turmaLimpa,
			Turno:        turnoLimpo,
			CodigoBarras: bg.Generate(turmaLimpa, turnoLimpo),
		}

		if _, err := repository.CreateAluno(aluno); err != nil {
			erros++
			continue
		}
		importados++
	}

	msg := fmt.Sprintf("%d aluno(s) importado(s) com sucesso!", importados)
	if erros > 0 {
		msg += fmt.Sprintf(" (%d erro(s) durante a importação)", erros)
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"message":    msg,
		"importados": importados,
		"erros":      erros,
	})
}
