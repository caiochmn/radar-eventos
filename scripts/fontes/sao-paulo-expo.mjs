import { criarLeitorMec } from '../lib/mec.mjs';

export const meta = {
  id: 'sao-paulo-expo',
  nome: 'São Paulo Expo',
  cidade: 'São Paulo',
  uf: 'SP',
  url: 'https://www.saopauloexpo.com.br/pt/agenda-de-eventos/',
};

export const coletar = criarLeitorMec({
  ajax: 'https://www.saopauloexpo.com.br/pt/wp-admin/admin-ajax.php',
  paginaPublica: meta.url,
  espacoPadrao: 'Pavilhões',
});
