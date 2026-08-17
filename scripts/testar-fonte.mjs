const id = process.argv[2];
const mod = await import(`./fontes/${id}.mjs`);
const t0 = Date.now();
const eventos = await mod.coletar();
console.log(`\n${mod.meta.nome} — ${eventos.length} eventos em ${Date.now() - t0}ms\n`);
for (const e of eventos.slice(0, Number(process.argv[3] || 8))) {
  console.log(`• ${e.nome}`);
  console.log(`  data: ${e.dataInicio || '??'} → ${e.dataFim || '??'}   (bruto: "${e.textoData}")`);
  console.log(`  local: ${e.espaco}  |  link: ${e.link || '-'}`);
  if (e.descricao) console.log(`  desc: ${e.descricao.slice(0, 110)}...`);
  console.log('');
}
const semData = eventos.filter((e) => !e.dataInicio).length;
console.log(`Sem data reconhecida: ${semData}/${eventos.length}`);
