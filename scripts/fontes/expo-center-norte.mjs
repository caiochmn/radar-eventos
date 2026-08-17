import { buscarHtml, limpar, blocos, pegar, absoluta, extrairPeriodo, mesParaNumero } from '../lib/util.mjs';

export const meta = {
  id: 'expo-center-norte',
  nome: 'Expo Center Norte',
  cidade: 'São Paulo',
  uf: 'SP',
  url: 'https://www.expocenternorte.com.br/eventos',
};

export async function coletar() {
  const html = await buscarHtml(meta.url);
  const eventos = [];

  // A página agrupa por "<h2>...<span>agosto</span> <span>2026</span></h2>" seguido da <ul> daquele mês.
  const marcadores = [...html.matchAll(/<h2[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>(20\d{2})<\/span>\s*<\/h2>/gi)];

  for (let i = 0; i < marcadores.length; i++) {
    const mes = mesParaNumero(limpar(marcadores[i][1]));
    const ano = Number(marcadores[i][2]);
    const inicioTrecho = marcadores[i].index;
    const fimTrecho = i + 1 < marcadores.length ? marcadores[i + 1].index : html.length;
    const trecho = html.slice(inicioTrecho, fimTrecho);

    for (const li of blocos(trecho, 'li', (b) => /href="\/eventos\//i.test(b))) {
      const nome = pegar(li, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (!nome) continue;
      const href = (li.match(/href="([^"]+)"/i) || [])[1];
      const descricao = pegar(li, /<p[^>]*>([\s\S]*?)<\/p>/i);
      const spans = [...li.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => limpar(m[1])).filter(Boolean);
      const textoData = spans.find((s) => /\d/.test(s)) || '';
      const local = spans.find((s) => !/\d/.test(s) && s.length > 2) || 'Pavilhão';
      const { inicio, fim } = extrairPeriodo(textoData, ano);

      eventos.push({
        nome,
        descricao,
        dataInicio: inicio,
        dataFim: fim || inicio,
        textoData,
        espaco: local,
        link: absoluta(href, meta.url),
        _mesDica: mes,
      });
    }
  }

  return eventos;
}
