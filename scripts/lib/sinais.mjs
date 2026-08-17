/**
 * Sinais de conhecimento de mercado que o texto raspado não entrega sozinho.
 *
 * As agendas publicam descrições curtas e truncadas, então eventos enormes
 * como FEBRABAN TECH ou CONARH ficariam com nota baixa só por falta de texto.
 * Este arquivo existe para ser editado por quem conhece o mercado — acrescente
 * ou remova linhas conforme a realidade comercial, sem precisar mexer no motor.
 */

export const ORGANIZADOR_NACIONAL = [
  // Entidades nacionais: quem organiza reúne associado do país inteiro.
  [/\bfebraban|\bfenabrave|\bfenauto|\bfenasan|\babrh\b|\bconarh\b/i, 'Entidade nacional'],
  [/federa[çc][ãa]o|confedera[çc][ãa]o|associa[çc][ãa]o brasileira|sindicato nacional/i, 'Entidade nacional'],
  [/\babimad|\babav|\babrasel|\babinee|\babras\b|\babiquim|\banfavea/i, 'Entidade nacional'],
  [/\bsebrae|\bsenai|\bfiesp|\bcni\b/i, 'Entidade nacional'],
];

export const MARCA_GLOBAL = [
  // Summits de fornecedor global: cliente vem de todas as filiais do Brasil.
  // É exatamente o padrão "evento do Bradesco trouxe todas as filiais".
  [/\baws\b|amazon web services|\bgoogle cloud|\bmicrosoft\b|\bazure\b|\boracle\b|\bsap\b|\bsalesforce\b|\bhuawei\b|\bdell\b|\bsap\b/i, 'Multinacional de tecnologia'],
  [/\bbradesco|\bita[úu]\b|\bsantander|banco do brasil|\bcaixa\b|\bnubank|\bxp\b/i, 'Grande banco'],
  [/\bambev|\bvale\b|\bpetrobras|\bjbs\b|\bnatura\b|\bmagalu|\bvivo\b|\bclaro\b|\btim\b/i, 'Grande empresa nacional'],
  [/\bshopee|\bmercado livre|\bmagazine luiza|\bamericanas/i, 'Grande varejista'],
];

export const CONVENCAO_DE_REDE = [
  // Convenção de rede/franquia: o público É a filial de fora vindo para a matriz.
  [/encontro (farmarcas|de franqueados|nacional)|conven[çc][ãa]o (de vendas|nacional|anual)/i, 'Convenção de rede'],
  [/franqueados|\brede\b.*(nacional|brasil)|\bfranchis/i, 'Rede de franquias'],
];

/** Eventos que sabidamente não geram demanda aérea, por mais que o nome soe grande. */
export const IGNORAR = [
  /social privado/i,
  /formatura/i,
  /^teste\b/i,
];

export function aplicarSinais(texto) {
  const achados = [];
  let bonus = 0;

  for (const [re, rotulo] of ORGANIZADOR_NACIONAL) {
    if (re.test(texto)) { bonus += 26; achados.push(rotulo); break; }
  }
  for (const [re, rotulo] of MARCA_GLOBAL) {
    if (re.test(texto)) { bonus += 24; achados.push(rotulo); break; }
  }
  for (const [re, rotulo] of CONVENCAO_DE_REDE) {
    if (re.test(texto)) { bonus += 22; achados.push(rotulo); break; }
  }

  return { bonus, achados };
}
