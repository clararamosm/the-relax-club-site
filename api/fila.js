// GET /api/fila  -> manda as notificações da fila (api/_fila.js) que já chegaram no horário e ainda não foram enviadas.
// pode ser chamado à vontade: cada item só sai uma vez (marca em enviados/ no blob).
// GET /api/fila?ver=1 -> só mostra o que mandaria agora, sem mandar.
import { configurado, enviarParaTodos, marcarEnvio, contar } from './_push.js';
import FILA from './_fila.js';

export default async function handler(req, res) {
  if (!configurado()) return res.status(501).json({ ok: false, error: 'sem_config' });
  const agora = Date.now();
  const prontos = FILA.filter(i => i && i.id && i.texto && (!i.quando || new Date(i.quando).getTime() <= agora));
  if (req.query && req.query.ver) return res.status(200).json({ ok: true, inscritos: await contar(), prontos: prontos.map(i => i.id), na_fila: FILA.length });
  const enviados = [];
  for (const i of prontos) {
    if (!(await marcarEnvio('fila:' + i.id))) continue;
    const r = await enviarParaTodos({ titulo: String(i.titulo || 'clara').slice(0, 80), texto: String(i.texto).slice(0, 240), url: i.url || '/', tag: 'fila-' + i.id });
    enviados.push({ id: i.id, ...r });
  }
  return res.status(200).json({ ok: true, enviados });
}
