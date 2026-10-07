# 🎬 CinemaWeb

Aplicação web para descoberta e consulta de filmes, desenvolvida com **Node.js e Express** e integrada à API do **TMDB**.

O CinemaWeb permite pesquisar filmes, filtrar por gênero, consultar informações detalhadas e verificar onde os títulos estão disponíveis para assistir. A aplicação também possui sistema de autenticação, gerenciamento de perfis e área administrativa.

---

## Demonstração

### Página inicial
![Página inicial](docs/screenshots/home.png)

### Catálogo de filmes
![Catálogo dos filmes de acordo com o gênero escolhido](docs/screenshots/catalogo.png)

### Detalhes do filme
![Detalhe do filme escolhido](docs/screenshots/detalhes.png)

### Login e cadastro
![Página de login](docs/screenshots/login.png)
![Página de cadastro](docs/screenshots/cadastro.png)

---

## Funcionalidades

### Filmes

- Listagem de filmes populares
- Busca de filmes por nome
- Filtro de filmes por gênero
- Página de detalhes dos filmes
- Informações sobre:
  - título
  - sinopse
  - data de lançamento
  - duração
  - gêneros
  - avaliação
- Consulta de onde assistir, alugar ou comprar

### Usuários

- Cadastro de usuários
- Login e logout
- Autenticação por sessão
- Criptografia de senhas com `bcrypt`
- Visualização do perfil
- Edição de nome e e-mail
- Exclusão da conta

### Administração

- Controle de acesso por nível de usuário
- Área administrativa protegida
- Listagem de usuários
- Exclusão de usuários
- Definição de permissões administrativas

---

## Tecnologias utilizadas

### Back-end

- **Node.js**
- **Express**
- **Sequelize**
- **SQLite**
- **bcrypt**
- **express-session**

### Front-end

- **HTML5**
- **CSS3**
- **JavaScript**
- **Handlebars**

### Integrações

- **TMDB API**

### Ferramentas

- **Git**
- **GitHub**
- **VS Code**

### Instalação
Clone o repositório e instale as dependências:

```bash
git clone https://github.com/SofiaSilva2008/CinemaWeb.git
cd CinemaWeb
npm install
