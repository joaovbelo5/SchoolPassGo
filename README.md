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

Para rodar o **SchoolPassGo** localmente, você precisa ter:
- **Go 1.22+** (Recomendado 1.26+)
- **Git** (Para clonar o repositório)
- **Navegador Moderno** (Chrome, Firefox, Edge, Brave)

---

## 🚀 Instalação e Configuração (Passo a Passo)

Escolha o seu sistema operacional abaixo para seguir as instruções de instalação de forma simples e direta.

### 🪟 No Windows

1.  **Instalar o Go**:
    -   Acesse [go.dev/dl](https://go.dev/dl/) e baixe o instalador para Windows (arquivo `.msi`).
    -   Execute o arquivo baixado e siga os passos do instalador até o final ("Next", "Finish").
2.  **Verificar a Instalação**:
    -   Abra o **PowerShell** ou o **Prompt de Comando (CMD)** e digite: `go version`.
    -   Se aparecer a versão do Go, a instalação foi um sucesso! (ex: `go1.26.1`).
3.  **Instalar o Git** (Caso não tenha):
    -   Acesse [git-scm.com](https://git-scm.com/), baixe o instalador para Windows e instale-o.
4.  **Clonar e Executar**:
    -   Abra o terminal em uma pasta de sua escolha e execute os comandos abaixo:
    ```powershell
    # Clonar o repositório
    git clone https://github.com/joaovbelo5/schoolpassgo.git

    # Entrar na pasta do projeto
    cd schoolpassgo

    # Instalar as dependências do projeto
    go mod tidy

    # Rodar a aplicação
    go run main.go
    ```

### 🐧 No Linux (Ubuntu/Debian)

1.  **Instalar o Go**:
    ```bash
    # 1. Baixar a versão mais recente do Go (substitua o link se houver uma nova versão)
    wget https://go.dev/dl/go1.26.1.linux-amd64.tar.gz
    
    # 2. Remover versões antigas e extrair na pasta /usr/local
    sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.26.1.linux-amd64.tar.gz
    
    # 3. Configurar a variável de ambiente (Adiciona ao final do arquivo ~/.bashrc)
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    
    # 4. Atualizar o terminal atual para reconhecer o Go
    source ~/.bashrc
    ```
2.  **Instalar Git**:
    ```bash
    sudo apt update && sudo apt install git -y
    ```
3.  **Verificar a Instalação**:
    ```bash
    go version
    ```
4.  **Clonar e Executar**:
    ```bash
    git clone https://github.com/joaovbelo5/schoolpassgo.git
    cd schoolpassgo
    go mod tidy
    go run main.go
    ```

---

Após executar `go run main.go`, o servidor será iniciado em `http://localhost:8080`.


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
