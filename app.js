const express = require('express');
const { engine } = require('express-handlebars');
require('dotenv').config();

const { buscarFilmesPopulares, FilmesNome, FilmesGenero, FilmesDetalhes, genero, OndeAssistir } = require('./services/tmdb');

const app = express();
const PORT = process.env.PORT || 3000;

const sequelize = require('./database');
const session = require('express-session');
const bcrypt = require('bcrypt');

const Usuario = require('./models/Usuario');

// Sincroniza o banco de dados
sequelize.sync() 
    .then(() => console.log('✅ Tabelas e banco de dados sincronizados com sucesso!'))
    .catch((err) => console.error('❌ Erro ao sincronizar com o banco:', err));

// CONFIGURAÇÃO DE SESSÃO
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// MIDDLEWARES DE FORMULÁRIO E ESTÁTICOS
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware para disponibilizar o usuário logado nas views do Handlebars
app.use((req, res, next) => {
    res.locals.usuarioLogado = req.session.usuario || null;
    res.locals.eAdmin = req.session.usuario?.isAdmin || false;
    next();
});

// Configuração do Handlebars
app.engine('handlebars', engine({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.set('views', './views');

//MIDDLEWARES DE PROTEÇÃO
function eAdmin(req, res, next) {
    if (req.session && req.session.usuario && req.session.usuario.isAdmin) {
        return next();
    }
    res.redirect('/login');
}

function eLogado(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    res.redirect('/login');
}


//ROTAS DE FILMES
app.get('/', async (req, res) => {
    const filmes = await buscarFilmesPopulares();
    const destaque = filmes[0];
    res.render('home', { filmes, destaque });
});

app.get('/buscar', async (req, res) => {
    const busca = req.query.q;
    if (!busca){
        return res.redirect("/");
    }
    const filmes = await FilmesNome(busca);
    const destaque = filmes[0];
    res.render('home', { filmes, busca, destaque });
});

app.get('/filmes', async (req, res) => {
    const generoSelecionado = req.query.genero; 
    const generos = await genero(); 
    let filmes = [];

    if (generoSelecionado) {
        filmes = await FilmesGenero(generoSelecionado);
    } else {
        filmes = await buscarFilmesPopulares();
    }

    res.render('filmes', { 
        filmes, 
        generos, 
        generoSelecionado 
    });
});

app.get('/filme/:id', async(req, res) => {
    const filme = await FilmesDetalhes(req.params.id)
    const assistir = await OndeAssistir(req.params.id)
    if (!filme) {
        return res.redirect('/filmes')
    }

    if (filme.release_date) {
        const data = new Date(filme.release_date);

        filme.dataFormatada = data.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    if (filme.runtime) {
        const horas = Math.floor(filme.runtime / 60);
        const minutos = filme.runtime % 60;

        if (horas > 0 && minutos > 0) {
            filme.duracaoFormatada = `${horas}h ${minutos}min`;
        } else if (horas > 0) {
            filme.duracaoFormatada = `${horas}h`;
        } else {
            filme.duracaoFormatada = `${minutos}min`;
        }
    }

    res.render('detalhesFilmes', {filme, assistir: assistir || { flatrate: [], rent: [], buy: [], linkOficial: null}});
});


//ROTAS DE AUTENTICAÇÃO E CONTA 
const EMAILS_ADMIN = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',')
    : [];

app.get('/cadastrar', (req, res) => {
    res.render('cadastrar');
});

app.post('/cadastrar', async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const emailNormalizado = email.trim().toLowerCase();
        const eAdmin = EMAILS_ADMIN.includes(emailNormalizado);

        await Usuario.create({
            nome,
            email: emailNormalizado,
            senha: senhaHash,
            isAdmin: eAdmin
        });

        res.redirect('/login');
    } catch (error) {
        console.error('Erro ao cadastrar:', error.message);
        res.render('cadastrar', { erro: 'Erro ao cadastrar usuário ou e-mail já existente.' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario) {
        return res.render('login', { erro: 'Usuário não encontrado!' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
        return res.render('login', { erro: 'Senha incorreta!' });
    }

    req.session.usuario = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        isAdmin: usuario.isAdmin
    };

    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});



//ROTAS DO PRÓPRIO USUÁRIO (PERFIL) 
app.get('/perfil', eLogado, async (req, res) => {
    const usuario = await Usuario.findByPk(req.session.usuario.id, { raw: true });
    res.render('perfil', { usuario });
});

app.post('/perfil/editar', eLogado, async (req, res) => {
    const { nome, email } = req.body;
    const usuarioId = req.session.usuario.id;

    try {
        await Usuario.update({ nome, email }, { where: { id: usuarioId } });
        
        // Atualiza a sessão
        req.session.usuario.nome = nome;
        req.session.usuario.email = email;

        res.render('perfil', { 
            usuario: { id: usuarioId, nome, email }, 
            sucesso: 'Perfil atualizado com sucesso!' 
        });
    } catch (error) {
        res.render('perfil', { usuario: req.session.usuario, erro: 'Erro ao atualizar o perfil.' });
    }
});

app.post('/perfil/deletar', eLogado, async (req, res) => {
    const usuarioId = req.session.usuario.id;
    await Usuario.destroy({ where: { id: usuarioId } });
    req.session.destroy(() => {
        res.redirect('/');
    });
});



//ROTAS DE GESTÃO DO ADMIN 
app.get('/admin/usuarios', eAdmin, async (req, res) => {
    const usuarios = await Usuario.findAll({ raw: true });
    res.render('adminUsuarios', { usuarios });
});

app.get('/admin/usuarios/editar/:id', eAdmin, async (req, res) => {
    const usuario = await Usuario.findByPk(req.params.id, { raw: true });
    res.render('editUsuario', { usuario });
});

app.post('/admin/usuarios/editar/:id', eAdmin, async (req, res) => {
    const { nome, email, isAdmin } = req.body;
    await Usuario.update({
        nome,
        email,
        isAdmin: isAdmin === 'on' || isAdmin === 'true'
    }, { where: { id: req.params.id } });

    res.redirect('/admin/usuarios');
});

app.post('/admin/usuarios/deletar/:id', eAdmin, async (req, res) => {
    await Usuario.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/usuarios');
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});