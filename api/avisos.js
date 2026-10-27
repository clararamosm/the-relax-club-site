// POST   /api/avisos  { sub, plataforma }  -> guarda a inscrição de quem aceitou receber notificações e manda a de boas-vindas
// DELETE /api/avisos  { endpoint }         -> tira a inscrição
// (o resto fica em api/_push.js)
import { configurado, validar, guardar, remover, enviarPara, corpo } from './_push.js';

const recentes = new Map(); // freio simples por instância

export default async function handler(req, res) {
  if (!configurado()) return res.status(501).json({ ok: false, error: 'sem_config' });
  const b = corpo(req);

  if (req.method === 'DELETE') {
    if (typeof b.endpoint !== 'string') return res.status(400).json({ ok: false });
    await remover(b.endpoint);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const sub = validar(b.sub);
  if (!sub) return res.status(400).json({ ok: false, error: 'inscricao' });
  const plataforma = ['ios', 'android', 'computador', 'outro'].includes(b.plataforma) ? b.plataforma : 'outro';
  const novo = !b.renovar;

  const ultimo = recentes.get(sub.endpoint); if (ultimo && Date.now() - ultimo < 10000) return res.status(429).json({ ok: false });
  recentes.set(sub.endpoint, Date.now());

  await guardar(sub, { plataforma });
  if (novo) {
    await enviarPara(sub, { titulo: 'clara', texto: 'pronto, a gente te avisa por aqui quando sair news nova.', url: '/', tag: 'boas-vindas' });
  }
  return res.status(200).json({ ok: true });
}
