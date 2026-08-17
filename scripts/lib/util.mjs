export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sites de centro de eventos caem com frequência; sem retry o coletor perde a fonte inteira. */
export async function comRetry(fn, { tentativas = 3, intervaloMs = 1500 } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      if (i < tentativas - 1) await espera(intervaloMs * (i + 1));
    }
  }
  throw ultimoErro;
}

export async function buscarHtml(url, { timeoutMs = 25000, tentativas = 3 } = {}) {
  return comRetry(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9', accept: 'text/html' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } finally {
      clearTimeout(t);
    }
  }, { tentativas });
}

const ENTIDADES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&aacute;': 'á',
  '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú', '&atilde;': 'ã',
  '&otilde;': 'õ', '&ccedil;': 'ç', '&acirc;': 'â', '&ecirc;': 'ê', '&ocirc;': 'ô',
  '&agrave;': 'à', '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó',
  '&Uacute;': 'Ú', '&Atilde;': 'Ã', '&Otilde;': 'Õ', '&Ccedil;': 'Ç', '&rsquo;': '’',
  '&#8211;': '–', '&#8212;': '—', '&#8217;': '’', '&#160;': ' ',
};

export function limpar(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-zA-Z#0-9]+;/g, (e) => ENTIDADES[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const MESES = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, 'março': 3, marco: 3, mar: 3,
  abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7,
  agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10,
  novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

export function mesParaNumero(nome = '') {
  const k = nome.toLowerCase().trim().replace(/\.$/, '');
  return MESES[k] ?? null;
}

/** Monta uma data ISO escolhendo o ano que mantém o evento no futuro próximo. */
export function montarIso(dia, mes, ano) {
  if (!dia || !mes) return null;
  let a = ano;
  if (!a) {
    const hoje = new Date();
    a = hoje.getFullYear();
    // se o mês já passou faz mais de 2 meses, assume o ano seguinte
    const candidata = new Date(Date.UTC(a, mes - 1, dia));
    const doisMesesAtras = new Date(hoje.getTime() - 60 * 864e5);
    if (candidata < doisMesesAtras) a += 1;
  }
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== mes - 1) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Interpreta os formatos de data que aparecem nas agendas brasileiras:
 * "12 a 15 agosto", "27 - 30 jan", "25-26/Agosto/2026", "30, Setembro -4, Outubro/2026",
 * "09 de março a 13 de março de 2026", "22/Agosto/2026"
 */
export function extrairPeriodo(texto, anoDica) {
  if (!texto) return { inicio: null, fim: null };
  const t = limpar(texto).toLowerCase().replace(/\s+/g, ' ');
  const M = '(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)';
  const anoRe = /(20\d{2})/;
  const ano = (t.match(anoRe) || [])[1];
  const anoFinal = ano ? Number(ano) : anoDica ?? null;

  // intervalo cruzando meses: "30 setembro a 4 outubro" / "30, setembro -4, outubro"
  let m = t.match(new RegExp(`(\\d{1,2})\\s*[,/ ]?\\s*(?:de\\s+)?${M}\\s*(?:a|à|até|-|–|e)\\s*(\\d{1,2})\\s*[,/ ]?\\s*(?:de\\s+)?${M}`, 'i'));
  if (m) {
    const [, d1, mes1, d2, mes2] = m;
    return {
      inicio: montarIso(+d1, mesParaNumero(mes1), anoFinal),
      fim: montarIso(+d2, mesParaNumero(mes2), anoFinal),
    };
  }

  // intervalo no mesmo mês: "12 a 15 agosto" / "27 - 30 jan" / "25-26/agosto/2026"
  m = t.match(new RegExp(`(\\d{1,2})\\s*(?:a|à|até|-|–|e)\\s*(\\d{1,2})\\s*(?:de\\s+)?[/ ]?\\s*${M}`, 'i'));
  if (m) {
    const [, d1, d2, mes] = m;
    const n = mesParaNumero(mes);
    return { inicio: montarIso(+d1, n, anoFinal), fim: montarIso(+d2, n, anoFinal) };
  }

  // data única: "22/agosto/2026" / "27 de setembro"
  m = t.match(new RegExp(`(\\d{1,2})\\s*(?:de\\s+)?[/ ]\\s*${M}`, 'i'));
  if (m) {
    const [, d, mes] = m;
    const iso = montarIso(+d, mesParaNumero(mes), anoFinal);
    return { inicio: iso, fim: iso };
  }

  // formato numérico: 12/08/2026
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (m) {
    const iso = montarIso(+m[1], +m[2], +m[3]);
    return { inicio: iso, fim: iso };
  }

  return { inicio: null, fim: null };
}

/** Fatia o HTML em blocos delimitados por uma tag de abertura, respeitando aninhamento simples. */
export function blocos(html, tag, filtro) {
  const out = [];
  const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  let m;
  while ((m = re.exec(html))) {
    const inicio = m.index;
    const abre = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    const fecha = new RegExp(`</${tag}>`, 'gi');
    abre.lastIndex = re.lastIndex;
    fecha.lastIndex = re.lastIndex;
    let profundidade = 1;
    let pos = re.lastIndex;
    while (profundidade > 0) {
      abre.lastIndex = pos;
      fecha.lastIndex = pos;
      const a = abre.exec(html);
      const f = fecha.exec(html);
      if (!f) break;
      if (a && a.index < f.index) {
        profundidade++;
        pos = a.index + a[0].length;
      } else {
        profundidade--;
        pos = f.index + f[0].length;
      }
    }
    const bloco = html.slice(inicio, pos);
    if (!filtro || filtro(bloco)) out.push(bloco);
  }
  return out;
}

export function pegar(html, re, grupo = 1) {
  const m = html.match(re);
  return m ? limpar(m[grupo]) : '';
}

export function absoluta(href, base) {
  if (!href) return '';
  try {
    return new URL(href, base).href;
  } catch {
    return '';
  }
}
