import { buscarHtml, limpar, blocos, pegar, absoluta, extrairPeriodo } from '../lib/util.mjs';

export const meta = {
  id: 'transamerica-expo',
  nome: 'Transamerica Expo Center',
  cidade: 'São Paulo',
  uf: 'SP',
  url: 'https://www.transamericaexpo.com.br/agenda',
};

export async function coletar() {
  const html = await buscarHtml(meta.url);
  const eventos = [];

  // A agenda agrupa por "<h1 ...>NOVEMBRO 2026</h1>" seguido dos cartões daquele mês.
  const marcadores = [...html.matchAll(/<h1[^>]*>\s*([A-ZÇÃÉa-zçãé]+)\s+(20\d{2})\s*<\/h1>/g)];

  for (let i = 0; i < marcadores.length; i++) {
    const ano = Number(marcadores[i][2]);
    const fimTrecho = i + 1 < marcadores.length ? marcadores[i + 1].index : html.length;
    const trecho = html.slice(marcadores[i].index, fimTrecho);

    for (const item of blocos(trecho, 'div', (b) => /class="servico-item/.test(b.slice(0, 80)))) {
      const nome = pegar(item, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (!nome) continue;
      const textoData = pegar(item, /dia-do-evento[\s\S]*?<b>([\s\S]*?)<\/b>/i);
      const { inicio, fim } = extrairPeriodo(textoData, ano);
      const href = (item.match(/<a[^>]*href="([^"]+)"[^>]*>\s*<span>\s*Saiba/i) || [])[1];

      eventos.push({
        nome: limpar(nome),
        descricao: pegar(item, /<p>([\s\S]*?)<\/p>/i),
        dataInicio: inicio,
        dataFim: fim || inicio,
        textoData,
        espaco: 'Transamerica Expo Center',
        link: absoluta(href, meta.url) || meta.url,
      });
    }
  }
  return eventos;
}
