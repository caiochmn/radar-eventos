import { buscarHtml, limpar, blocos, pegar, absoluta, extrairPeriodo } from '../lib/util.mjs';

export const meta = {
  id: 'pro-magno',
  nome: 'Pro Magno Centro de Eventos',
  cidade: 'São Paulo',
  uf: 'SP',
  url: 'https://www.promagno.com.br/',
};

export async function coletar() {
  const html = await buscarHtml(meta.url);
  const eventos = [];

  for (const li of blocos(html, 'li', (b) => /href="[^"]*\/evento\//i.test(b) && /<strong>/i.test(b))) {
    const nome = pegar(li, /<strong[^>]*>([\s\S]*?)<\/strong>/i);
    const textoData = pegar(li, /<small[^>]*>([\s\S]*?)<\/small>/i);
    if (!nome || !textoData) continue;

    const href = (li.match(/href="([^"]+)"/i) || [])[1];
    if (!/\/evento\//i.test(href || '')) continue;
    const { inicio, fim } = extrairPeriodo(textoData);

    eventos.push({
      nome,
      descricao: '',
      dataInicio: inicio,
      dataFim: fim || inicio,
      textoData,
      espaco: 'Pro Magno',
      link: absoluta(href, meta.url),
    });
  }

  // A home repete a lista em carrosséis; remove duplicatas por nome + data.
  const vistos = new Set();
  return eventos.filter((e) => {
    const chave = `${e.nome}|${e.dataInicio}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}
