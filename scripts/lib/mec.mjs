import { UA, limpar, blocos, pegar, absoluta, extrairPeriodo, comRetry } from './util.mjs';

/**
 * Leitor para agendas feitas com o plugin WordPress "Modern Events Calendar".
 * A página pública costuma renderizar só o passado; os eventos futuros vêm
 * deste endpoint, o mesmo que o botão "Carregar Mais" usa.
 */
export function criarLeitorMec({ ajax, paginaPublica, espacoPadrao = 'Pavilhão' }) {
  return async function coletar() {
    const hoje = new Date();
    const desde = hoje.toISOString().slice(0, 10);
    const ate = new Date(hoje.getFullYear() + 2, 11, 31).toISOString().slice(0, 10);

    const p = new URLSearchParams();
    p.set('action', 'mec_list_load_more');
    p.set('mec_start_date', desde);
    p.set('mec_offset', '0');
    p.set('atts[skin]', 'full_calendar');
    p.set('atts[sk-options][list][style]', 'standard');
    p.set('atts[sk-options][list][start_date_type]', 'date');
    p.set('atts[sk-options][list][start_date]', desde);
    p.set('atts[sk-options][list][end_date_type]', 'date');
    p.set('atts[sk-options][list][maximum_date_range]', ate);
    p.set('atts[sk-options][list][order_method]', 'ASC');
    p.set('atts[sk-options][list][limit]', '200');

    let html = '';
    try {
      html = await comRetry(async () => {
        const r = await fetch(ajax, {
          method: 'POST',
          headers: {
            'user-agent': UA,
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest',
          },
          body: p.toString(),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()).html || '';
      });
    } catch {
      html = '';
    }

    // Se o AJAX falhar, cai para o que a página pública já traz renderizado.
    if (!html.includes('mec-event-article')) {
      const r = await fetch(paginaPublica, { headers: { 'user-agent': UA } });
      html = await r.text();
    }

    const eventos = [];
    for (const art of blocos(html, 'article', (b) => /mec-event-article/i.test(b))) {
      if (/mec-past-event/i.test(art.slice(0, 200))) continue;

      let nome = pegar(art, /<h3[^>]*mec-event-title[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
      if (!nome || nome.length < 2) continue;
      nome = nome.replace(/Acontecendo agora$/i, '').trim();

      const href = (art.match(/<h3[^>]*mec-event-title[^>]*>\s*<a[^>]*href="([^"]+)"/i) || [])[1];
      const textoData = pegar(art, /<span[^>]*mec-start-date-label[^>]*>([\s\S]*?)<\/span>/i);
      const { inicio, fim } = extrairPeriodo(textoData);
      const texto = limpar(art);

      eventos.push({
        nome,
        descricao: pegar(art, /<div[^>]*mec-event-description[^>]*>([\s\S]*?)<\/div>/i),
        dataInicio: inicio,
        dataFim: fim || inicio,
        textoData,
        espaco: pegar(art, /mec-venue-details[\s\S]{0,500}?<span[^>]*>([\s\S]*?)<\/span>/i) || espacoPadrao,
        link: absoluta(href, paginaPublica),
        categoria: /\bfeira\b/i.test(texto) ? 'Feira' : /congresso/i.test(texto) ? 'Congresso' : '',
      });
    }
    return eventos;
  };
}
