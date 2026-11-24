import { limpar, absoluta, comRetry, UA } from '../lib/util.mjs';

/**
 * EventsEye — catálogo internacional de feiras de negócios.
 *
 * É a única fonte que publica datas com 6 a 12 meses de antecedência (as
 * casas de evento só mostram até o fim do ano corrente) e a única que cobre
 * cidades fora de São Paulo. Os textos vêm em inglês.
 *
 * Uma página por cidade, lida em sequência e com pausa entre as requisições
 * para não sobrecarregar o site.
 */
export const meta = {
  id: 'eventseye',
  nome: 'EventsEye (feiras no Brasil)',
  cidade: 'Brasil',
  uf: '',
  url: 'https://www.eventseye.com/fairs/c1_trade-shows_brazil.html',
  agregador: true,
};

// A página lista as cidades pelo nome; a UF não vem junto.
const UF = {
  'americana': 'SP', 'belo horizonte': 'MG', 'bento gonçalves': 'RS', 'blumenau': 'SC',
  'brasilia': 'DF', 'brasília': 'DF', 'cachoeiro de itapemirim': 'ES', 'caruaru': 'PE',
  'caxias do sul': 'RS', 'chapecó': 'SC', 'curitiba': 'PR', 'florianópolis': 'SC',
  'fortaleza': 'CE', 'itu': 'SP', 'joinville sc': 'SC', 'joinville': 'SC', 'lages': 'SC',
  'novo hamburgo': 'RS', 'olinda': 'PE', 'recife': 'PE', 'ribeirão preto': 'SP',
  'rio de janeiro': 'RJ', 'rio pardo': 'RS', 'salvador da bahia': 'BA', 'salvador': 'BA',
  'santa rosa': 'RS', 'são paulo': 'SP', 'serra, espírito santo': 'ES', 'sertãozinho': 'SP',
  'três passos': 'RS', 'porto alegre': 'RS', 'goiânia': 'GO', 'campinas': 'SP', 'manaus': 'AM',
  'belém': 'PA', 'natal': 'RN', 'maceió': 'AL', 'vitória': 'ES', 'foz do iguaçu': 'PR',
};
const NOME_CIDADE = { 'joinville sc': 'Joinville', 'salvador da bahia': 'Salvador', 'serra, espírito santo': 'Serra', 'brasilia': 'Brasília' };

const MESES_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const decodificador = new TextDecoder('windows-1252');

async function baixar(url) {
  return comRetry(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en,pt-BR;q=0.8' }, signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // O site declara latin-1 sem cabeçalho de charset; como UTF-8 os acentos quebram.
      return decodificador.decode(await r.arrayBuffer());
    } finally {
      clearTimeout(t);
    }
  });
}

const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** "09/08/2026<br><i>3 days</i>" (mês/dia/ano) ou "March 2027 (?)" (dia ainda não divulgado). */
function lerData(celula) {
  const t = limpar(celula.replace(/<br\s*\/?>/gi, ' '));
  let m = t.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
  if (m) {
    const inicio = iso(m[3], m[1], m[2]);
    const dias = Number((t.match(/(\d+)\s*days?/i) || [])[1] || 1);
    const fim = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2] + dias - 1)).toISOString().slice(0, 10);
    return { inicio, fim, texto: t, aproximada: false };
  }
  m = t.match(/([a-z]+)\s+(20\d{2})/i);
  const mes = m && MESES_EN[m[1].toLowerCase()];
  if (mes) {
    const inicio = iso(m[2], mes, 1);
    return { inicio, fim: inicio, texto: t, aproximada: true };
  }
  return { inicio: null, fim: null, texto: t, aproximada: false };
}

export async function coletar() {
  const indice = await baixar(meta.url);
  const cidades = [...new Map(
    [...indice.matchAll(/href="(cy1_trade-shows-[^"]+\.html)"[^>]*>([^<]+)</g)]
      .map((m) => [m[1], limpar(m[2])])
  )];
  if (!cidades.length) throw new Error('Lista de cidades não encontrada');

  const eventos = [];
  for (const [href, cidadeBruta] of cidades) {
    const chave = cidadeBruta.toLowerCase();
    const cidade = NOME_CIDADE[chave] || cidadeBruta.replace(/\s+[A-Z]{2}$/, '');
    const uf = UF[chave] || '';
    const pagina = absoluta(href, meta.url);
    let html;
    try {
      html = await baixar(pagina);
    } catch {
      continue; // uma cidade fora do ar não derruba as outras
    }

    for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (tds.length < 4) continue;
      const nome = limpar((tds[0].match(/<b>([\s\S]*?)<\/b>/i) || [])[1] || '');
      if (!nome) continue;
      const data = lerData(tds[3]);
      if (!data.inicio) continue;

      eventos.push({
        nome,
        descricao: limpar((tds[0].match(/<i>([\s\S]*?)<\/i>/i) || [])[1] || ''),
        dataInicio: data.inicio,
        dataFim: data.fim,
        dataAproximada: data.aproximada,
        textoData: data.texto,
        espaco: limpar(tds[2]) || cidade,
        link: absoluta((tds[0].match(/href="([^"]+)"/i) || [])[1], pagina),
        periodicidade: limpar(tds[1]),
        local: { nome: limpar(tds[2]) || cidade, cidade, uf },
      });
    }
    await espera(700);
  }
  return eventos;
}
