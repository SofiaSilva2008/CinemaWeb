const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

//BUSCAR FILMES POPULARES
async function buscarFilmesPopulares() {
  try {
    const response = await axios.get(`${BASE_URL}/discover/movie`, {
      params: {
        api_key: API_KEY,
        language: 'pt-BR',
        sort_by: 'popularity.desc', 
        page: 1
      }
    });

    return response.data.results;

  } catch (error) {
    console.error('❌ ERRO NA API DA TMDB:', error.response ? error.response.data : error.message);
    return [];
  }
}

//BUSCAR FILMES POR NOME
async function FilmesNome(query) {
  try {
    const response = await axios.get(`${BASE_URL}/search/movie`, {
      params: {
        api_key: API_KEY,
        query: query,
        language: 'pt-BR'
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('❌ Não possui filme com este nome:', error.message);
    return [];
  }
}

//BUSCAR LISTA DE GÊNEROS 
async function genero() {
  try {
    const response = await axios.get(`${BASE_URL}/genre/movie/list`, {
      params: { 
        api_key: API_KEY, 
        language: 'pt-BR'
      }
    });
    return response.data.genres;
  } catch (error) {
    console.error('❌ Não possui gêneros de filmes:', error.message);
    return [];
  }
}

//BUSCAR FILMES FILTRADOS POR GÊNERO
async function FilmesGenero(idGenero) {
  try {
    const response = await axios.get(`${BASE_URL}/discover/movie`, { 
      params: {
        api_key: API_KEY,
        with_genres: idGenero, 
        language: 'pt-BR',
        sort_by: 'vote_average.desc', 'vote_count.gte': 300,
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('❌ Erro ao buscar filmes deste gênero:', error.message);
    return [];
  }
}

// MOSTRAR DETALHES DO FILME ESCOLHIDO
async function FilmesDetalhes(id) {
    try {
        const response = await axios.get(`${BASE_URL}/movie/${id}`, {
            params: {
                api_key: API_KEY,
                language: 'pt-BR'
            }
        });

        return response.data;

    } catch (error) {
        console.error(
            '❌ Não foi possível encontrar o filme selecionado:',
            error.message
        );

        return null;
    }
}

async function OndeAssistir(id) {
  try {
    const response = await axios.get(`${BASE_URL}/movie/${id}/watch/providers`, {
      params: {
        api_key: API_KEY,
        language: 'pt-BR'
      }
    });

    const provedoresBR = response.data.results?.BR;

    if (!provedoresBR) {
      return null;
    }

    return {
      linkOficial: provedoresBR.link,
      flatrate: provedoresBR.flatrate || [], // Streaming
      rent: provedoresBR.rent || [],         // Aluguel
      buy: provedoresBR.buy || []            // Compra
    };

  } catch (error) {
    console.error('Não foi possível encontrar onde assistir', error.message);
    return null;
  }
}

module.exports = {
  buscarFilmesPopulares,
  FilmesNome,
  genero,
  FilmesGenero, 
  FilmesDetalhes,
  OndeAssistir
};