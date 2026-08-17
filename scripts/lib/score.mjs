/**
 * Traduz um evento em potencial comercial para a Azul.
 *
 * Premissa: o que vale é evento que puxa público de fora da cidade-sede.
 * Uma feira nacional em São Paulo enche voos vindos do Brasil inteiro;
 * uma formatura no mesmo pavilhão não gera uma passagem sequer.
 *
 * O "potencial" mede o tamanho da oportunidade e NÃO leva a data em conta.
 * O prazo é reportado à parte, porque são decisões diferentes: um evento
 * gigante daqui a 5 dias continua sendo gigante — só não dá mais para vendê-lo.
 */

import { aplicarSinais } from './sinais.mjs';

const ALCANCE = [
  [/am[ée]rica latina|latin[- ]?america|sul[- ]?americ/i, 30, 'América Latina'],
  [/\bnacional\b|todo o (pa[íi]s|brasil)|de todo o brasil|brasileir[oa]\b/i, 26, 'Nacional'],
  [/\binternacional\b|\bmundial\b|\bglobal\b|do exterior/i, 24, 'Internacional'],
  [/\bbrasil\b/i, 14, 'Brasil'],
];

// "Show" em nome de evento brasileiro quase sempre quer dizer trade show
// (Concrete Show, Auto Show). Só é entretenimento com contexto musical.
const ENTRETENIMENTO = /\b(banda|turn[êe]|cantor|ac[úu]stico|festival de m[úu]sica|stand[- ]?up|espet[áa]culo|orquestra|sinf[ôo]nic)/i;
const SOCIAL = /social privado|formatura|casamento|anivers[áa]rio|baile|confraterniza/i;

const TIPOS = [
  [/conven[çc][ãa]o|kick[- ]?off|encontro (nacional|anual|de|farmarcas)|convention/i, 'Encontro corporativo', 25],
  [/congresso|summit|conference|conferencia|confer[êe]ncia|simp[óo]sio|f[óo]rum/i, 'Congresso', 24],
  [/\bfeira\b|\bexpo\b|exposi[çc][ãa]o|\bfair\b|\bshow\b|sal[ãa]o/i, 'Feira', 22],
  [/semana|week/i, 'Semana setorial', 20],
  [/\bcopa\b|campeonato|torneio/i, 'Esportivo', 10],
];

/** Números como "58.000 visitantes", "mais de 680 expositores", "3 mil participantes". */
export function extrairPublico(texto = '') {
  if (!texto) return null;
  const re =
    /(?:mais de\s+)?([\d]{1,3}(?:[.\s]\d{3})+|\d{1,3}(?:[,.]\d)?\s*mil|\d{4,})\s*(visitantes|participantes|congressistas|profissionais|pessoas|expositores|marcas|empresas)/gi;
  let melhor = null;
  let m;
  while ((m = re.exec(texto))) {
    const n = m[1].toLowerCase().trim();
    let valor = n.includes('mil')
      ? Math.round(parseFloat(n.replace(',', '.')) * 1000)
      : Number(n.replace(/[.\s]/g, ''));
    if (!Number.isFinite(valor)) continue;
    const tipo = m[2].toLowerCase();
    // expositores e marcas indicam porte, mas o público visitante é bem maior
    const publico = /expositores|marcas|empresas/.test(tipo) ? valor * 40 : valor;
    if (!melhor || publico > melhor.publico) melhor = { publico, bruto: m[0].trim(), tipo };
  }
  return melhor;
}

export function classificarTipo(nome = '', descricao = '') {
  const texto = `${nome} ${descricao}`;
  if (SOCIAL.test(nome)) return { tipo: 'Social/privado', peso: 0 };
  if (ENTRETENIMENTO.test(texto)) return { tipo: 'Show', peso: 4 };
  for (const [re, rotulo, peso] of TIPOS) {
    if (re.test(texto)) return { tipo: rotulo, peso };
  }
  return { tipo: 'Evento', peso: 10 };
}

export function diasAte(dataIso, hoje = new Date()) {
  if (!dataIso) return null;
  const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  return Math.round((new Date(dataIso + 'T00:00:00Z') - base) / 864e5);
}

export function pontuar(evento, hoje = new Date()) {
  const nome = evento.nome || '';
  const descricao = evento.descricao || '';
  const texto = `${nome} ${descricao}`;
  const sinais = [];

  const { tipo, peso: pontosTipo } = classificarTipo(nome, descricao);
  const social = tipo === 'Social/privado';

  // --- PORTE (0-45) ---
  let porte = 0;
  const publico = extrairPublico(texto);
  if (publico) {
    sinais.push(publico.bruto);
    porte = publico.publico >= 50000 ? 45
      : publico.publico >= 20000 ? 38
      : publico.publico >= 5000 ? 28
      : publico.publico >= 1000 ? 16
      : 8;
  } else {
    // Sem número declarado, infere porte por indícios indiretos.
    if (/maior (feira|evento|encontro|congresso|exposi)/i.test(texto)) { porte += 24; sinais.push('Maior do segmento'); }
    else if (/principal (evento|encontro|feira|congresso)/i.test(texto)) { porte += 20; sinais.push('Principal do setor'); }

    // Evento com muitas edições é consolidado, logo grande e recorrente.
    const ed = texto.match(/\b(\d{1,3})\s*[°ºªa]\s*(edi[çc][ãa]o|congresso|feira|encontro)?/i)
      || nome.match(/\b(\d{1,3})\s*[°ºª]/);
    if (ed) {
      const n = Number(ed[1]);
      if (n >= 20) { porte += 18; sinais.push(`${n}ª edição`); }
      else if (n >= 8) { porte += 12; sinais.push(`${n}ª edição`); }
      else if (n >= 3) { porte += 6; }
    }

    // Site próprio (fora do domínio da casa de eventos) indica evento de peso.
    if (evento.link && evento.fonteDominio && !evento.link.includes(evento.fonteDominio)) {
      porte += 10;
      sinais.push('Site próprio');
    }

    // Ocupa mais de um pavilhão / o centro de convenções inteiro.
    if (/pavilh[õo]es|pavilh[ãa]o\s*&|1 a \d|centro de conven/i.test(evento.espaco || '')) porte += 6;
  }
  porte = Math.min(45, porte);

  // --- ALCANCE declarado no texto (0-25) ---
  let alcance = 0;
  for (const [re, valor, rotulo] of ALCANCE) {
    if (re.test(texto)) {
      if (valor > alcance) alcance = Math.min(25, valor);
      if (!sinais.includes(rotulo)) sinais.push(rotulo);
    }
  }

  // --- CONHECIMENTO DE MERCADO (0-28) ---
  // Componente próprio, porque é justamente o que o texto raspado não entrega.
  const { bonus, achados } = aplicarSinais(texto);
  const mercado = Math.min(28, bonus);
  for (const a of achados) if (!sinais.includes(a)) sinais.push(a);

  // --- DURAÇÃO (0-8) ---
  const dias = evento.dataInicio && evento.dataFim
    ? Math.max(1, Math.round((new Date(evento.dataFim) - new Date(evento.dataInicio)) / 864e5) + 1)
    : 1;
  const bonusDuracao = dias >= 4 ? 8 : dias >= 2 ? 5 : 0;

  let score = social ? 0 : Math.min(100, porte + alcance + mercado + pontosTipo + bonusDuracao);

  // Sem descrição, o texto disponível é só o nome — o score subestima.
  // Marca a confiança para a interface poder dizer "falta informação"
  // em vez de "pouco potencial", que são coisas diferentes.
  const confianca = social ? 'alta' : descricao.length > 80 ? 'alta' : descricao ? 'media' : 'baixa';

  // --- PRAZO (dimensão separada) ---
  const faltam = diasAte(evento.dataInicio, hoje);
  let janela = 'sem data';
  if (faltam !== null) {
    janela = faltam < 0 ? 'passou'
      : faltam <= 7 ? 'esta semana'
      : faltam <= 21 ? 'em cima da hora'
      : faltam <= 60 ? 'agir agora'
      : faltam <= 180 ? 'ideal'
      : 'planejamento';
  }

  return {
    score,
    faixa: score >= 60 ? 'alto' : score >= 38 ? 'medio' : 'baixo',
    confianca,
    tipo,
    sinais,
    // Componentes abertos para a ficha poder mostrar de onde veio a nota:
    // um número sem explicação não sustenta uma ligação comercial.
    componentes: social
      ? []
      : [
          { rotulo: 'Porte', valor: porte, teto: 45 },
          { rotulo: 'Alcance', valor: alcance, teto: 25 },
          { rotulo: 'Organizador', valor: mercado, teto: 28 },
          { rotulo: 'Tipo de evento', valor: pontosTipo, teto: 25 },
          { rotulo: 'Duração', valor: bonusDuracao, teto: 8 },
        ],
    porte,
    alcance,
    mercado,
    publicoEstimado: publico?.publico ?? null,
    diasDeEvento: dias,
    faltamDias: faltam,
    janela,
    acionavel: faltam !== null && faltam > 21 && !social,
  };
}
