package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const (
	backupDir = "backup"
	dbPath    = "escola.db"
)

func main() {
	log.Println("==================================================")
	log.Println("INICIANDO MIGRAÇÃO DO BACKUP LEGADO PARA escola.db")
	log.Println("==================================================")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Erro ao abrir banco de dados: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("Erro de conexão com o banco: %v", err)
	}

	importarAlunos(db)
	importarOcorrencias(db)
	importarRegistros(db)

	imprimirResumo(db)
}

func getBase64Image(filename string) string {
	if filename == "" || filename == "semfoto.jpg" {
		return ""
	}

	path := filepath.Join(backupDir, "static", "fotos", filename)
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("  [AVISO] Não foi possível ler a imagem %s: %v", filename, err)
		return ""
	}

	ext := strings.ToLower(filepath.Ext(filename))
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded)
}

func parseDate(dateStr string) (time.Time, error) {
	// Try multiple layouts
	layouts := []string{
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
	}
	for _, layout := range layouts {
		t, err := time.Parse(layout, dateStr)
		if err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("formato de data desconhecido: %s", dateStr)
}

func importarAlunos(db *sql.DB) {
	log.Println("--- IMPORTANDO ALUNOS ---")
	file, err := os.Open(filepath.Join(backupDir, "database.csv"))
	if err != nil {
		log.Fatalf("Erro ao abrir database.csv: %v", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		log.Fatalf("Erro ao ler CSV: %v", err)
	}

	if len(records) < 2 {
		log.Println("CSV está vazio ou só tem cabeçalho.")
		return
	}

	// Prepare Statement
	stmt, err := db.Prepare(`
		INSERT INTO alunos (nome, codigo_barras, turma, turno, foto, telegram_chat_id, telefone_responsavel)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(codigo_barras) DO UPDATE SET
			nome=excluded.nome,
			turma=excluded.turma,
			turno=excluded.turno,
			foto=excluded.foto,
			telegram_chat_id=excluded.telegram_chat_id,
			telefone_responsavel=excluded.telefone_responsavel
	`)
	if err != nil {
		log.Fatalf("Erro ao preparar query de aluno: %v", err)
	}
	defer stmt.Close()

	headers := records[0]
	// Expected: Nome,Codigo,Turma,Turno,Permissao,Foto,TelegramID,TelefoneResponsavel
	count := 0
	for i, row := range records {
		if i == 0 {
			continue // Skip header
		}
		if len(row) < len(headers) {
			continue
		}

		nome := row[0]
		codigo := row[1]
		turma := row[2]
		turno := row[3]
		foto := row[5]
		telegramID := row[6]
		telefoneResp := row[7]

		if codigo == "" {
			continue // Pular linhas com código vazio
		}

		log.Printf("[ALUNO] Lendo %s (Código: %s)", nome, codigo)

		fotoBase64 := getBase64Image(foto)

		_, err := stmt.Exec(nome, codigo, turma, turno, fotoBase64, telegramID, telefoneResp)
		if err != nil {
			log.Printf("  [ERRO] Falha ao inserir aluno %s: %v", codigo, err)
		} else {
			count++
		}

		// Processar 5 por vez e limpar a memória (evitar Out Of Memory)
		if count > 0 && count%5 == 0 {
			log.Printf("  [MEMÓRIA] Lote de 5 atingido (%d processados). Limpando memória e aguardando...", count)
			runtime.GC()
			time.Sleep(2 * time.Second)
		}
	}
	log.Printf("Concluído: %d alunos processados.", count)
}

func getAlunoIDByCodigo(db *sql.DB, codigo string) (int, error) {
	var id int
	err := db.QueryRow("SELECT id FROM alunos WHERE codigo_barras = ?", codigo).Scan(&id)
	return id, err
}

func importarOcorrencias(db *sql.DB) {
	log.Println("--- IMPORTANDO OCORRÊNCIAS ---")
	ocorrenciasDir := filepath.Join(backupDir, "ocorrencias")

	files, err := os.ReadDir(ocorrenciasDir)
	if err != nil {
		log.Printf("[AVISO] Pasta ocorrencias não lida: %v", err)
		return
	}

	stmt, err := db.Prepare(`
		INSERT INTO ocorrencias (aluno_id, data_hora, classificacao, descricao, registrado_por, historico_edicao)
		VALUES (?, ?, ?, ?, ?, '')
	`)
	if err != nil {
		log.Fatalf("Erro query ocorrencia: %v", err)
	}
	defer stmt.Close()

	count := 0
	for _, f := range files {
		if f.IsDir() || !strings.HasSuffix(f.Name(), ".json") {
			continue
		}

		codigo := strings.TrimSuffix(f.Name(), ".json")
		alunoID, err := getAlunoIDByCodigo(db, codigo)
		if err != nil {
			log.Printf("[AVISO] Ocorrência: Aluno código %s não encontrado no banco.", codigo)
			continue
		}

		filePath := filepath.Join(ocorrenciasDir, f.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("[ERRO] Lendo %s: %v", f.Name(), err)
			continue
		}

		var items []struct {
			Texto         string `json:"texto"`
			Medida        string `json:"medida"`
			RegistradoPor string `json:"registrado_por"`
			Data          string `json:"data"`
		}
		if err := json.Unmarshal(data, &items); err != nil {
			log.Printf("[ERRO] Parse JSON %s: %v", f.Name(), err)
			continue
		}

		log.Printf("[OCORRENCIA] Processando arquivo %s (%d ocorrências)", f.Name(), len(items))
		for _, item := range items {
			dataParsed, err := parseDate(item.Data)
			if err != nil {
				log.Printf("  [AVISO] Data inválida na ocorrência '%s': %v", item.Data, err)
				dataParsed = time.Now()
			}

			descricao := item.Texto
			if item.Medida != "" {
				descricao += " (Medida: " + item.Medida + ")"
			}

			_, execErr := stmt.Exec(alunoID, dataParsed, item.Medida, descricao, item.RegistradoPor)
			if execErr != nil {
				log.Printf("  [ERRO] Inserindo ocorrência: %v", execErr)
			} else {
				count++
			}
		}
	}
	log.Printf("Concluído: %d ocorrências importadas.", count)
}

func importarRegistros(db *sql.DB) {
	log.Println("--- IMPORTANDO REGISTROS (ACESSOS) ---")
	registrosDir := filepath.Join(backupDir, "registros")

	turmasDirs, err := os.ReadDir(registrosDir)
	if err != nil {
		log.Printf("[AVISO] Pasta registros não lida: %v", err)
		return
	}

	stmt, err := db.Prepare(`
		INSERT INTO acessos (aluno_id, data_hora, tipo)
		VALUES (?, ?, "entrada")
	`)
	if err != nil {
		log.Fatalf("Erro query acessos: %v", err)
	}
	defer stmt.Close()

	count := 0
	for _, turmaDir := range turmasDirs {
		if !turmaDir.IsDir() {
			continue
		}

		turmaPath := filepath.Join(registrosDir, turmaDir.Name())
		jsonFiles, err := os.ReadDir(turmaPath)
		if err != nil {
			continue
		}

		for _, f := range jsonFiles {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".json") {
				continue
			}

			codigo := strings.TrimSuffix(f.Name(), ".json")
			alunoID, err := getAlunoIDByCodigo(db, codigo)
			if err != nil {
				log.Printf("[AVISO] Acesso: Aluno código %s não encontrado no banco.", codigo)
				continue
			}

			filePath := filepath.Join(turmaPath, f.Name())
			data, err := os.ReadFile(filePath)
			if err != nil {
				log.Printf("[ERRO] Lendo %s: %v", f.Name(), err)
				continue
			}

			var registro struct {
				Codigo    string `json:"codigo"`
				Historico []struct {
					DataHora string `json:"data_hora"`
					Tipo     string `json:"tipo"`
				} `json:"historico"`
			}
			if err := json.Unmarshal(data, &registro); err != nil {
				log.Printf("[ERRO] Parse JSON %s: %v", f.Name(), err)
				continue
			}

			log.Printf("[ACESSO] Turma %s | Código %s | Registros: %d", turmaDir.Name(), codigo, len(registro.Historico))
			for _, hist := range registro.Historico {
				dataParsed, err := parseDate(hist.DataHora)
				if err != nil {
					log.Printf("  [AVISO] Data inválida de acesso '%s': %v", hist.DataHora, err)
					continue
				}

				_, execErr := stmt.Exec(alunoID, dataParsed)
				if execErr != nil {
					log.Printf("  [ERRO] Inserindo acesso: %v", execErr)
				} else {
					count++
				}
			}
		}
	}
	log.Printf("Concluído: %d acessos importados.", count)
}

func imprimirResumo(db *sql.DB) {
	log.Println("==================================================")
	log.Println("RESUMO DO BANCO DE DADOS ATUAL")
	log.Println("==================================================")

	var totalAlunos int
	db.QueryRow("SELECT count(*) FROM alunos").Scan(&totalAlunos)

	var totalAcessos int
	db.QueryRow("SELECT count(*) FROM acessos").Scan(&totalAcessos)

	var totalOcorrencias int
	db.QueryRow("SELECT count(*) FROM ocorrencias").Scan(&totalOcorrencias)

	log.Printf("Total de Alunos: %d", totalAlunos)
	log.Printf("Total de Acessos: %d", totalAcessos)
	log.Printf("Total de Ocorrências: %d", totalOcorrencias)
	log.Println("==================================================")
	log.Println("MIGRAÇÃO FINALIZADA!")
}
