# SchoolPassGo 🎓

Sistema inteligente de gestão de acesso escolar e acompanhamento pedagógico/disciplinar.

O **SchoolPassGo** é uma solução completa para instituições de ensino que desejam modernizar o controle de entrada e saída de alunos, gerenciar ocorrências disciplinares de forma ágil e manter a comunicação com os responsáveis via Telegram.

---

## 📝 Descrição

Este projeto nasceu para resolver a carência de sistemas práticos de portaria em escolas. Ele substitui as planilhas manuais por um sistema de leitura de código de barras (Totem) que registra instantaneamente a presença, gera relatórios mensais de frequência e permite o registro detalhado de ocorrências disciplinares com histórico de edições.

**Para quem é:** Diretores, coordenadores e porteiros que buscam eficiência e dados precisos sobre o fluxo de alunos.

---

## ✨ Funcionalidades

- **🚀 Dashboard Dinâmico**: Estatísticas em tempo real sobre acessos diários, total de alunos e ocorrências recentes.
- **🆔 Gestão de Alunos**: Cadastro completo com foto (Base64), turma, turno e geração automática de códigos de barras.
- **📟 Totem de Acesso**: Interface dedicada para leitura rápida de carteirinhas com validação de tempo mínimo entre registros.
- **⚠️ Registro de Ocorrências**: Sistema disciplinar com categorização, histórico de alterações e notificações.
- **📅 Relatórios de Chamada**: Geração de mapas de frequência mensais por turma e ano.
- **📂 Arquivo Morto**: Processo anual de encerramento de ciclo, movendo dados para bases históricas e limpando o sistema para o novo ano letivo.
- **🤖 Integração com Telegram**: Notificações automáticas para os pais no momento da entrada/saída ou registro de ocorrência.
- **💾 Backup & Restauração**: Sistema de exportação e importação completa em arquivo ZIP para segurança dos dados.
- **👤 Gestão de Usuários**: Níveis de acesso e controle de autenticação seguro.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem**: [Go (Golang) 1.22+](https://go.dev/)
- **Banco de Dados**: [SQLite](https://www.sqlite.org/) (Utilizando a biblioteca `modernc.org/sqlite` - sem CGO)
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Modern UI)
- **Comunicação**: WhatsApp/Telegram (Bot API)

---

## 📁 Estrutura do Projeto

```bash
SchoolPassGo/
├── cmd/                # Pontos de entrada alternativos
├── internal/           # Lógica de negócio privada
│   ├── auth/           # Autenticação e Middleware
│   ├── database/       # Inicialização dos bancos SQLite
│   ├── handlers/       # Controladores da API e Rotas
│   ├── models/         # Definições de structs (Aluno, Acesso, etc)
│   ├── repository/     # Acesso a dados e lógica de persistência
│   └── telegram/       # Implementação do bot de notificações
├── static/             # Arquivos estáticos (CSS, JS, Imagens)
├── templates/          # Páginas HTML (Server-Side Rendering leve)
├── uploads/            # Fotos, logos e base de arquivos mortos
├── main.go             # Ponto de entrada principal da aplicação
└── go.mod              # Gerenciador de dependências Go
```

---

## ⚙️ Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina:
- [Go 1.22 ou superior](https://go.dev/dl/)
- Um navegador moderno (Chrome, Edge, Firefox)

---

## 🚀 Instalação e Configuração

### 1. Clonar o repositório
```bash
git clone https://github.com/joaovbelo5/schoolpassgo.git
cd schoolpassgo
```

### 2. Instalar dependências
```bash
go mod tidy
```

### 3. Executar o projeto
```bash
go run main.go
```
O servidor será iniciado em `http://localhost:8080`.

---

## 🐳 Implantação com Docker (Recomendado para Produção)

Para rodar o SchoolPassGo de forma isolada e segura em um servidor Linux, utilize o Docker e Docker Compose.

### 1. Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Configuração
Certifique-se de que os arquivos `Dockerfile` e `docker-compose.yml` estão na raiz do projeto.

### 3. Iniciar o Container
```bash
docker-compose up -d --build
```

### 4. Persistência de Dados
O Docker Compose está configurado para persistir automaticamente os dados no host:
- `auth.db` e `escola.db` (Bancos de dados SQLite)
- Pasta `uploads/` (Fotos dos alunos, logos e arquivos do "morto")

Isso garante que, mesmo apagando ou atualizando o container, você não perderá seus dados.

### 5. Parar o Sistema
```bash
docker-compose down
```


---

## 💡 Como Usar

1.  **Acesso Inicial**: Abra o navegador e acesse `http://localhost:8080/login`.
    -   **Usuário padrão**: `admin`
    -   **Senha padrão**: `admin123`
    -   *Recomendação: Altere a senha imediatamente na aba de Configurações.*
2.  **Configurações**: Vá até a página de configurações para enviar o Logo da sua escola e configurar o Token do Bot do Telegram.
3.  **Cadastro**: Cadastre as turmas e os alunos no painel Administrativo.
4.  **Totem**: Em um tablet ou computador na portaria, deixe aberta a página `/totem` com um leitor de código de barras conectado.
5.  **Acompanhamento**: Use o Dashboard para ver quem entrou ou saiu e a aba de Ocorrências para gerenciar o comportamento dos alunos.

---

## 🛠️ Gerenciamento de Usuários via CLI

Para maior segurança e praticidade, o SchoolPassGo inclui uma ferramenta de linha de comando para gerenciar usuários sem precisar abrir o navegador ou quando o servidor estiver offline.

**Comandos disponíveis:**
```bash
# Listar todos os usuários
go run ./cmd/admin list

# Criar um novo administrador
go run ./cmd/admin create <username> "<Nome Completo>"

# Alterar senha de um usuário
go run ./cmd/admin passwd <username>

# Remover um usuário
go run ./cmd/admin delete <username>
```

---

## 🚀 Possíveis Melhorias

- [ ] Implementação de leitura via QR Code.
- [ ] Exportação de relatórios em formato PDF/Excel.
- [ ] Aplicativo Mobile nativo para professores.
- [ ] Integração com APIs de reconhecimento facial.

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
Desenvolvido com ❤️ para transformar a gestão escolar.
