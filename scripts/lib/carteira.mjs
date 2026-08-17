import { readFile } from 'node:fs/promises';
import { extrairPeriodo } from './util.mjs';
import { pontuar } from './score.mjs';

/**
 * A carteira é a planilha de MICE da analista, convertida para CSV por
 * scripts/planilha-para-csv.ps1. Ela vive noutro horizonte do que as agendas
 * raspadas: as casas de evento publicam de 4 a 6 meses à frente, e a
 * prospecção trabalha de 12 a 18. Por isso a carteira não se mistura com a
 * agenda — são duas listas, com perguntas diferentes.
 *
 * O arquivo carrega nome, e-mail e telefone de pessoas de fora da Azul e está
 * no .gitignore. Quando ele não existe, a carteira simplesmente vem vazia.
 */

function lerCsv(texto) {
  const linhas = [];
  let campo = '', linha = [], dentroDeAspas = false;
  const t = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n');

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

const limpo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** "Não localizado", "Não divulgado publicamente" e afins são ausência, não conteúdo. */
function ouNada(v) {
  const t = limpo(v);
  if (!t) return '';
  if (/^n[ãa]o (localizad|divulgad|aplic|h[áa])/i.test(t)) return '';
  return t;
}

function chave(nome) {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
}

export async function lerCarteira(caminho, hoje = new Date()) {
  let bruto;
  try {
    bruto = await readFile(caminho, 'utf8');
  } catch {
    return { itens: [], arquivoPresente: false };
  }

  const linhas = lerCsv(bruto);
  if (linhas.length < 2) return { itens: [], arquivoPresente: true };

  const cab = linhas[0].map((c) => limpo(c).toLowerCase());
  const idx = (nome) => cab.indexOf(nome);
  const col = {
    aba: idx('aba'), evento: idx('evento'), data: idx('data'), onde: idx('onde'),
    objetivo: idx('objetivo'), contato: idx('contato'), email: idx('email'),
    telefone: idx('telefone'), valor: idx('valorestimado'), oportunidade: idx('oportunidade'),
  };

  const itens = [];
  for (const l of linhas.slice(1)) {
    const nome = limpo(l[col.evento]);
    if (!nome) continue;

    const textoData = limpo(l[col.data]);
    // "Data de 2027 ainda não divulgada" é informação, não erro: o evento
    // existe e vale prospectar, só não dá para colocar num calendário ainda.
    // Esses textos costumam citar a edição passada ("última edição: 5 a 9 de
    // maio de 2026"), e sem esta guarda a data antiga vira data futura.
    const semDataAinda = /ainda n[ãa]o divulg|n[ãa]o h[áa] edi[çc][ãa]o|n[ãa]o aplic|a confirmar|sem data/i.test(textoData);
    const { inicio, fim } = semDataAinda ? { inicio: null, fim: null } : extrairPeriodo(textoData);
    const dataIndefinida = !inicio;

    const objetivo = ouNada(l[col.objetivo]);
    const oportunidade = ouNada(l[col.oportunidade]);
    const item = {
      id: `carteira:${chave(nome)}`,
      nome,
      origem: limpo(l[col.aba]),
      textoData,
      dataInicio: inicio,
      dataFim: fim || inicio,
      dataIndefinida,
      onde: ouNada(l[col.onde]),
      objetivo,
      contato: ouNada(l[col.contato]),
      email: ouNada(l[col.email]),
      telefone: ouNada(l[col.telefone]),
      valorEstimado: ouNada(l[col.valor]),
      oportunidade,
      // Sem contato nenhum ela não consegue agir, e isso é o que trava a fila.
      temContato: Boolean(ouNada(l[col.contato]) || ouNada(l[col.email]) || ouNada(l[col.telefone])),
    };

    // Reaproveita o mesmo motor de potencial, alimentado pelo texto da planilha.
    const nota = pontuar(
      { nome, descricao: [objetivo, oportunidade].filter(Boolean).join('. '),
        dataInicio: inicio, dataFim: fim || inicio, espaco: item.onde },
      hoje
    );
    Object.assign(item, {
      score: nota.score, faixa: nota.faixa, tipo: nota.tipo,
      sinais: nota.sinais, componentes: nota.componentes,
      faltamDias: nota.faltamDias, diasDeEvento: nota.diasDeEvento,
    });
    itens.push(item);
  }

  // Datados primeiro, em ordem cronológica; sem data depois, por potencial.
  itens.sort((a, b) => {
    if (a.dataInicio && b.dataInicio) return a.dataInicio.localeCompare(b.dataInicio);
    if (a.dataInicio) return -1;
    if (b.dataInicio) return 1;
    return b.score - a.score;
  });

  return { itens, arquivoPresente: true };
}
