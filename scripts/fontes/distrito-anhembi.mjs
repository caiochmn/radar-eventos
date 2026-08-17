import { criarLeitorMec } from '../lib/mec.mjs';

export const meta = {
  id: 'distrito-anhembi',
  nome: 'Distrito Anhembi',
  cidade: 'São Paulo',
  uf: 'SP',
  url: 'https://distritoanhembi.com.br/agenda/',
};

export const coletar = criarLeitorMec({
  ajax: 'https://distritoanhembi.com.br/wp-admin/admin-ajax.php',
  paginaPublica: meta.url,
  espacoPadrao: 'Distrito Anhembi',
});
