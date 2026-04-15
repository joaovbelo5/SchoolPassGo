package models

import "time"

// Aluno represents a student in the database
type Aluno struct {
	ID                  int    `json:"id"`
	Nome                string `json:"nome"`
	Turma               string `json:"turma"`
	Turno               string `json:"turno"`
	Foto                string `json:"foto"`
	CodigoBarras        string `json:"codigo_barras"`
	TelefoneResponsavel string `json:"telefone_responsavel"`
	TelegramChatID      string `json:"telegram_chat_id"`
}

// Acesso represents a single entry/exit event log
type Acesso struct {
	ID       int       `json:"id"`
	AlunoID  int       `json:"aluno_id"`
	DataHora time.Time `json:"data_hora"`
	Tipo     string    `json:"tipo"` // 'entrada' ou 'saida'

	// Optional fields to include student data when joining tables
	AlunoNome  string `json:"aluno_nome,omitempty"`
	AlunoTurma string `json:"aluno_turma,omitempty"`
	AlunoTurno string `json:"aluno_turno,omitempty"`
}

// Configuracao represents the system configuration
type Configuracao struct {
	ID                    int    `json:"id"`
	NomeInstituicao       string `json:"nome_instituicao"`
	TempoMinimoMinutos    int    `json:"tempo_minimo_minutos"`
	DiretorioImagens      string `json:"diretorio_imagens"`
	LogoInstituicao       string `json:"logo_instituicao"`
	AssinaturaInstituicao string `json:"assinatura_instituicao"`
	EnderecoInstituicao   string `json:"endereco_instituicao"`
	TelefoneInstituicao   string `json:"telefone_instituicao"`
	TelegramBotToken      string `json:"telegram_bot_token"`
}

// Ocorrencia represents a disciplinary incident or warning
type Ocorrencia struct {
	ID              int        `json:"id"`
	AlunoID         int        `json:"aluno_id"`
	DataHora        time.Time  `json:"data_hora"`
	Classificacao   string     `json:"classificacao"`
	Descricao       string     `json:"descricao"`
	RegistradoPor   string     `json:"registrado_por"`
	HistoricoEdicao string     `json:"historico_edicao"` // JSON log of changes
	DeletadoEm      *time.Time `json:"deletado_em,omitempty"`
}

// TurnoCounts holds entry counts for a specific school shift
type TurnoCounts struct {
	Turno     string `json:"turno"`
	Presentes int    `json:"presentes"`
	Total     int    `json:"total"`
}

// DashboardStats holds all aggregated data for the admin dashboard
type DashboardStats struct {
	TotalAlunos       int           `json:"total_alunos"`
	SemFoto           int           `json:"sem_foto"`
	SemTelegram       int           `json:"sem_telegram"`
	TotalTurmas       int           `json:"total_turmas"`
	TotalOcorrencias  int           `json:"total_ocorrencias"`
	EntradasHoje      int           `json:"entradas_hoje"`
	SaidasHoje        int           `json:"saidas_hoje"`
	PresencasPorTurno []TurnoCounts `json:"presencas_por_turno"`
	UltimosAcessos    []Acesso      `json:"ultimos_acessos"`
}
