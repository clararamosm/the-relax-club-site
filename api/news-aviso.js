// GET /api/news-aviso  -> confere o feed da the relax news no substack e, se saiu edição nova, avisa todo mundo que aceitou notificação.
// chamado de hora em hora pelo github actions (.github/workflows/avisos-news.yml). pode ser chamado à vontade:
// cada edição só é avisada uma vez (marca em enviados/ no blob) e só se tiver saído nas últimas 36 horas.
// GET /api/news-aviso?ver=1 -> só mostra o que mandaria, sem mandar.
import { configurado, enviarParaTodos, marcarEnvio } from './_push.js';

const FEED = 'https://therelaxclub.substack.com/feed';
const JANELA = 36 * 3600 * 1000;

const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() : ''; };
const limpar = t => t.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export default async function handler(req, res) {
  if (!configurado()) return res.status(501).json({ ok: false, error: 'sem_config' });
  const xml = await fetch(FEED, { headers: { 'user-agent': 'therelax.club avisos' } }).then(r => r.ok ? r.text() : '').catch(() => '');
  const item = (xml.match(/<item>([\s\S]*?)<\/item>/) || [])[1];
  if (!item) return res.status(502).json({ ok: false, error: 'feed' });

  const titulo = limpar(tag(item, 'title'));
  const link = tag(item, 'link');
  const data = new Date(tag(item, 'pubDate'));
  const recente = !isNaN(data) && Date.now() - data.getTime() < JANELA;
  const aviso = { titulo: '', texto: 'saiu news nova: ' + titulo, url: link || 'https://therelaxclub.substack.com', tag: 'news' };

  if (req.query && req.query.ver) return res.status(200).json({ ok: true, recente, data: isNaN(data) ? null : data.toISOString(), aviso });
  if (!recente || !link) return res.status(200).json({ ok: true, enviou: false, motivo: 'sem edição nova' });
  if (!(await marcarEnvio('news:' + link))) return res.status(200).json({ ok: true, enviou: false, motivo: 'já avisada' });

  const r = await enviarParaTodos(aviso);
  return res.status(200).json({ ok: true, enviou: true, titulo, ...r });
}
