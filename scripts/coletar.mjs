import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pontuar } from './lib/score.mjs';
import { lerCarteira } from './lib/carteira.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

function chaveEvento(nome, dataInicio) {
  const n = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(20\d{2}|\d+[ªa]?\s*edicao)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
  return `${n}|${dataInicio || ''}`;
}

const arquivos = (await readdir(join(aqui, 'fontes'))).filter((f) => f.endsWith('.mjs'));

// A coleta anterior serve de reserva: quando uma casa bloqueia o servidor do
// GitHub (o Distrito Anhembi fica atrás do Cloudflare e devolve vazio para IP
// de datacenter), a fonte não some da agenda — fica com os eventos da última
// coleta boa e o rodapé avisa desde quando ela não atualiza.
let anterior = null;
try {
  anterior = JSON.parse(await readFile(join(raiz, 'dados', 'eventos.json'), 'utf8'));
} catch {}

const todos = [];
const relatorio = [];

function reaproveitar(meta, motivo, t0) {
  const velhos = (anterior?.eventos || []).filter((e) => e.fonte?.id === meta.id);
  const antes = (anterior?.fontes || []).find((f) => f.id === meta.id || f.fonte === meta.nome);
  const desde = antes?.desatualizadaDesde || (antes && !antes.erro && antes.eventos > 0 ? anterior.atualizadoEm : null);
  todos.push(...velhos.map(({ score, faixa, confianca, tipo, sinais, componentes, porte, alcance, mercado,
    publicoEstimado, diasDeEvento, faltamDias, janela, acionavel, ...bruto }) => bruto));
  relatorio.push({
    id: meta.id, fonte: meta.nome, eventos: velhos.length, ms: Date.now() - t0,
    erro: motivo, reaproveitados: velhos.length, desatualizadaDesde: velhos.length ? desde : null,
  });
  console.error(`✗ ${meta.nome}: ${motivo}${velhos.length ? ` — mantidos ${velhos.length} da coleta anterior` : ''}`);
}

for (const arquivo of arquivos) {
  const mod = await import(`./fontes/${arquivo}`);
  const t0 = Date.now();
  try {
    const brutos = await mod.coletar();
    const normalizados = brutos
      .filter((e) => e.nome && e.dataInicio)
      .map((e) => ({
        id: `${mod.meta.id}:${chaveEvento(e.nome, e.dataInicio)}`,
        nome: e.nome,
        descricao: e.descricao || '',
        dataInicio: e.dataInicio,
        dataFim: e.dataFim || e.dataInicio,
        textoData: e.textoData || '',
        espaco: e.espaco || '',
        link: e.link || mod.meta.url,
        local: { nome: mod.meta.nome, cidade: mod.meta.cidade, uf: mod.meta.uf },
        fonte: { id: mod.meta.id, nome: mod.meta.nome, url: mod.meta.url },
        fonteDominio: new URL(mod.meta.url).hostname.replace(/^www\./, ''),
      }));
    // Nenhuma das casas fica um mês inteiro sem evento futuro: zero é sinal de
    // bloqueio ou de layout novo, não de agenda vazia.
    if (!normalizados.length) {
      reaproveitar(mod.meta, 'Nenhum evento lido (site bloqueou a coleta ou mudou de layout)', t0);
      continue;
    }
    todos.push(...normalizados);
    relatorio.push({ id: mod.meta.id, fonte: mod.meta.nome, eventos: normalizados.length, ms: Date.now() - t0, erro: null });
    console.log(`✓ ${mod.meta.nome}: ${normalizados.length} eventos (${Date.now() - t0}ms)`);
  } catch (e) {
    reaproveitar(mod.meta, String(e.message || e), t0);
  }
}

const hoje = new Date();
const limite = new Date(hoje.getTime() - 864e5).toISOString().slice(0, 10);

// Deduplica: o mesmo evento pode aparecer em mais de uma casa de eventos.
const porChave = new Map();
for (const e of todos) {
  const k = chaveEvento(e.nome, e.dataInicio);
  const existente = porChave.get(k);
  if (!existente || (e.descricao?.length || 0) > (existente.descricao?.length || 0)) {
    porChave.set(k, e);
  }
}

const eventos = [...porChave.values()]
  .filter((e) => e.dataFim >= limite)
  .map((e) => ({ ...e, ...pontuar(e, hoje) }))
  .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

const carteira = await lerCarteira(join(raiz, 'dados', 'carteira.csv'), hoje);

// Dois arquivos, e não um: eventos.json é versionado e vai para o GitHub
// Pages; carteira.json fica no .gitignore porque carrega nome, e-mail e
// telefone de pessoas de fora da Azul. Misturar os dois num arquivo só
// publicaria os contatos no primeiro `git push`.
const saida = {
  atualizadoEm: new Date().toISOString(),
  totalEventos: eventos.length,
  fontes: relatorio,
  eventos,
};

await mkdir(join(raiz, 'dados'), { recursive: true });
await writeFile(join(raiz, 'dados', 'eventos.json'), JSON.stringify(saida, null, 2), 'utf8');

if (carteira.arquivoPresente) {
  await writeFile(
    join(raiz, 'dados', 'carteira.json'),
    JSON.stringify({ atualizadoEm: saida.atualizadoEm, itens: carteira.itens }, null, 2),
    'utf8'
  );
}

// Rede de segurança: se um contato escapar para o arquivo versionado, o
// coletor falha aqui em vez de deixar isso chegar ao repositório público.
const publico = JSON.stringify(saida);
const email = publico.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
if (email) {
  console.error(`\nABORTADO: e-mail encontrado em dados/eventos.json (${email[0]}).`);
  console.error('Esse arquivo é versionado e vai para o GitHub Pages público.');
  process.exit(1);
}

const porFaixa = eventos.reduce((acc, e) => ((acc[e.faixa] = (acc[e.faixa] || 0) + 1), acc), {});
console.log(`\n${eventos.length} eventos futuros gravados em dados/eventos.json`);
console.log(carteira.arquivoPresente
  ? `Carteira: ${carteira.itens.length} oportunidades da planilha (${carteira.itens.filter((i) => i.dataIndefinida).length} sem data definida)`
  : 'Carteira: dados/carteira.csv ausente — rode scripts/planilha-para-csv.ps1 para gerá-lo');
console.log(`Potencial: alto=${porFaixa.alto || 0}  médio=${porFaixa.medio || 0}  baixo=${porFaixa.baixo || 0}`);
console.log('\nTop 8 por potencial:');
[...eventos]
  .sort((a, b) => b.score - a.score)
  .slice(0, 8)
  .forEach((e) => console.log(`  ${String(e.score).padStart(3)} | ${e.dataInicio} | ${e.nome.slice(0, 48)}`));
