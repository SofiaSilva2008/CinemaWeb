const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const {
  buscarFilmesPopulares,
  FilmesNome,
  FilmesGenero,
  FilmesDetalhes,
  genero,
  OndeAssistir,
} = require('./services/tmdb');

const sequelize = require('./database');
const Usuario = require('./models/Usuario');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Não inicie a aplicação com uma chave de sessão ausente ou insegura.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 10) {
  throw new Error('Defina SESSION_SECRET no .env com pelo menos 10 caracteres.');
}

if (isProduction) {
  // Necessário quando a aplicação está atrás de um proxy HTTPS.
  app.set('trust proxy', 1);
}

const EMAILS_ADMIN = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    name: 'cinema.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// Disponibiliza dados mínimos do usuário às views.
app.use((req, res, next) => {
  res.locals.usuarioLogado = req.session.usuario || null;
  res.locals.eAdmin = Boolean(req.session.usuario?.isAdmin);
  next();
});

app.engine('handlebars', engine({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

function eAdmin(req, res, next) {
  if (req.session?.usuario?.isAdmin) return next();
  return res.redirect('/login');
}

function eLogado(req, res, next) {
  if (req.session?.usuario) return next();
  return res.redirect('/login');
}

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarNome(nome) {
  return typeof nome === 'string' && nome.trim().length >= 2 && nome.trim().length <= 100;
}

function validarSenha(senha) {
  return typeof senha === 'string' && senha.length >= 8 && senha.length <= 128;
}


//ROTAS DE FILMES
app.get('/', async (req, res) => {
  const filmes = await buscarFilmesPopulares();
  res.render('home', { filmes, destaque: filmes[0] || null });
});

app.get('/buscar', async (req, res) => {
  const busca = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!busca) return res.redirect('/');

  const filmes = await FilmesNome(busca);
  res.render('home', { filmes, busca, destaque: filmes[0] || null });
});

app.get('/filmes', async (req, res) => {
  const generoSelecionado = typeof req.query.genero === 'string' ? req.query.genero : '';
  const generos = await genero();
  const filmes = generoSelecionado
    ? await FilmesGenero(generoSelecionado)
    : await buscarFilmesPopulares();

  res.render('filmes', { filmes, generos, generoSelecionado });
});

app.get('/filme/:id', async (req, res) => {
  const filme = await FilmesDetalhes(req.params.id);
  if (!filme) return res.redirect('/filmes');

  const assistir = await OndeAssistir(req.params.id);

  if (filme.release_date) {
    const data = new Date(filme.release_date);
    if (!Number.isNaN(data.getTime())) {
      filme.dataFormatada = data.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  }

  if (Number.isFinite(filme.runtime) && filme.runtime > 0) {
    const horas = Math.floor(filme.runtime / 60);
    const minutos = filme.runtime % 60;
    filme.duracaoFormatada = horas && minutos
      ? `${horas}h ${minutos}min`
      : horas
        ? `${horas}h`
        : `${minutos}min`;
  }

  res.render('detalhesFilmes', {
    filme,
    assistir: assistir || { flatrate: [], rent: [], buy: [], linkOficial: null },
  });
});


//ROTAS DE AUTENTICAÇÃO E CONTA
app.get('/cadastrar', (req, res) => res.render('cadastrar'));

app.post('/cadastrar', async (req, res) => {
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = normalizarEmail(req.body.email);
  const senha = req.body.senha;

  if (!validarNome(nome) || !validarEmail(email) || !validarSenha(senha)) {
    return res.status(400).render('cadastrar', {
      erro: 'Informe um nome válido, um e-mail válido e uma senha com pelo menos 8 caracteres.',
    });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 12);
    await Usuario.create({
      nome,
      email,
      senha: senhaHash,
      isAdmin: EMAILS_ADMIN.includes(email),
    });
    return res.redirect('/login');
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error.message);
    const mensagem = error.name === 'SequelizeUniqueConstraintError'
      ? 'Este e-mail já está cadastrado.'
      : 'Não foi possível concluir o cadastro. Tente novamente.';
    return res.status(400).render('cadastrar', { erro: mensagem });
  }
});

app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
  const email = normalizarEmail(req.body.email);
  const senha = req.body.senha;

  if (!validarEmail(email) || typeof senha !== 'string' || senha.length === 0) {
    return res.status(400).render('login', { erro: 'E-mail ou senha inválidos.' });
  }

  try {
    const usuario = await Usuario.findOne({ where: { email } });
    const senhaValida = usuario && await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).render('login', { erro: 'E-mail ou senha incorretos.' });
    }

    // Regenera o identificador da sessão após autenticação.
    return req.session.regenerate((error) => {
      if (error) {
        console.error('Erro ao renovar sessão:', error);
        return res.status(500).render('login', { erro: 'Não foi possível iniciar sua sessão.' });
      }

      req.session.usuario = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        isAdmin: Boolean(usuario.isAdmin),
      };

      return req.session.save((saveError) => {
        if (saveError) {
          console.error('Erro ao salvar sessão:', saveError);
          return res.status(500).render('login', { erro: 'Não foi possível iniciar sua sessão.' });
        }
        return res.redirect('/');
      });
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return res.status(500).render('login', { erro: 'Ocorreu um erro. Tente novamente.' });
  }
});

app.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('cinema.sid');
    return res.redirect('/');
  });
});



//ROTAS DO USUÁRIO
app.get('/perfil', eLogado, async (req, res) => {
  const usuario = await Usuario.findByPk(req.session.usuario.id, {
    attributes: ['id', 'nome', 'email', 'isAdmin'],
    raw: true,
  });

  if (!usuario) {
    req.session.destroy(() => {});
    return res.redirect('/login');
  }

  return res.render('perfil', { usuario });
});

app.post('/perfil/editar', eLogado, async (req, res) => {
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = normalizarEmail(req.body.email);
  const usuarioId = req.session.usuario.id;

  if (!validarNome(nome) || !validarEmail(email)) {
    return res.status(400).render('perfil', {
      usuario: { ...req.session.usuario, nome, email },
      erro: 'Informe um nome e um e-mail válidos.',
    });
  }

  try {
    await Usuario.update({ nome, email }, { where: { id: usuarioId } });
    req.session.usuario.nome = nome;
    req.session.usuario.email = email;
    return res.render('perfil', {
      usuario: { ...req.session.usuario },
      sucesso: 'Perfil atualizado com sucesso!',
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    const mensagem = error.name === 'SequelizeUniqueConstraintError'
      ? 'Este e-mail já está sendo usado.'
      : 'Não foi possível atualizar o perfil.';
    return res.status(400).render('perfil', {
      usuario: { ...req.session.usuario, nome, email },
      erro: mensagem,
    });
  }
});

app.post('/perfil/deletar', eLogado, async (req, res, next) => {
  try {
    await Usuario.destroy({ where: { id: req.session.usuario.id } });
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('cinema.sid');
      return res.redirect('/');
    });
  } catch (error) {
    return next(error);
  }
});




//ROTAS DE ADMINISTRADOR
app.get('/admin/usuarios', eAdmin, async (req, res) => {
  const usuarios = await Usuario.findAll({
    attributes: ['id', 'nome', 'email', 'isAdmin'],
    raw: true,
  });
  res.render('adminUsuarios', { usuarios });
});

app.get('/admin/usuarios/editar/:id', eAdmin, async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id, {
    attributes: ['id', 'nome', 'email', 'isAdmin'],
    raw: true,
  });
  if (!usuario) return res.status(404).redirect('/admin/usuarios');
  return res.render('editUsuario', { usuario });
});

app.post('/admin/usuarios/editar/:id', eAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = normalizarEmail(req.body.email);
  const isAdmin = req.body.isAdmin === 'on' || req.body.isAdmin === 'true';

  if (!Number.isInteger(id) || !validarNome(nome) || !validarEmail(email)) {
    return res.status(400).redirect('/admin/usuarios');
  }

  try {
    const [quantidadeAtualizada] = await Usuario.update(
      { nome, email, isAdmin },
      { where: { id } }
    );
    if (!quantidadeAtualizada) return res.status(404).redirect('/admin/usuarios');
    return res.redirect('/admin/usuarios');
  } catch (error) {
    console.error('Erro ao editar usuário:', error);
    return res.status(400).redirect('/admin/usuarios');
  }
});

// A view adminUsuarios.handlebars deve enviar um formulário POST para esta rota.
app.post('/admin/usuarios/deletar/:id', eAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).redirect('/admin/usuarios');
  if (id === req.session.usuario.id) {
    return res.status(400).redirect('/admin/usuarios');
  }

  await Usuario.destroy({ where: { id } });
  return res.redirect('/admin/usuarios');
});

app.use((error, req, res, next) => {
  console.error('Erro não tratado na aplicação:', error);
  if (res.headersSent) return next(error);
  return res.status(500).send('Ocorreu um erro interno. Tente novamente mais tarde.');
});

async function iniciarServidor() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    app.listen(PORT, () => {
      console.log(`CinemaWeb executando na porta ${PORT}`);
      if (!process.env.TMDB_API_KEY) {
        console.warn('Aviso: TMDB_API_KEY não está definida; buscas de filmes podem falhar.');
      }
      if (isProduction) {
        console.warn('Atenção: configure um armazenamento de sessão persistente para produção.');
      }
    });
  } catch (error) {
    console.error('Não foi possível iniciar o CinemaWeb:', error);
    process.exit(1);
  }
}

iniciarServidor();
