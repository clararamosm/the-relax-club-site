// GET  /api/notificar  -> quantas pessoas recebem notificação
// POST /api/notificar  { titulo, texto, url }  -> manda pra todo mundo
// só a clara logada no clube (token do firebase no cabeçalho Authorization: Bearer <token>). usado pela página /avisos/.
import { configurado, enviarParaTodos, contar, ehAdmin, corpo } from './_push.js';

export default async function handler(req, res) {
  if (!configurado()) return res.status(501).json({ ok: false, error: 'sem_config' });
  if (!(await ehAdmin(req))) return res.status(403).json({ ok: false, error: 'sem_permissao' });
  if (req.method === 'GET') return res.status(200).json({ ok: true, inscritos: await contar() });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const b = corpo(req);
  const titulo = String(b.titulo || '').trim().slice(0, 80);
  const texto = String(b.texto || '').trim().slice(0, 240);
  let url = String(b.url || '/').trim();
  if (!texto) return res.status(400).json({ ok: false, error: 'texto' });
  if (!url.startsWith('/') && !/^https:\/\//.test(url)) url = '/';
  const r = await enviarParaTodos({ titulo: titulo || 'clara, da the relax club', texto, url: url.slice(0, 500), tag: 'aviso-' + Date.now() });
  return res.status(200).json({ ok: true, ...r });
}
