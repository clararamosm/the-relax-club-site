// GET /api/cadencia -> manda os emails da cadência que já chegaram no dia (sons e app), um por pessoa por vez.
// chamado de hora em hora pelo workflow "avisos"; cada email sai uma vez só (marca CAD_SONS_AT / CAD_APP_AT no contato).
// GET /api/cadencia?ver=1 -> só mostra quantas pessoas receberiam agora, sem mandar nada e sem mostrar emails.
// só manda entre 9h e 20h de brasília, e só com LIGADA = true em _cadencia.js.
import { LIGADA, TEMPLATE_SONS, TEMPLATE_APP, proximo, paramsSons, paramsApp } from './_cadencia.js';

async function brevo(path, method = 'GET', body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, status: r.status, json, text };
}

async function contatosDaLista(listId) {
  const todos = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const r = await brevo(`/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`);
    if (!r.ok) throw new Error('brevo ' + r.status);
    const lote = (r.json && r.json.contacts) || [];
    todos.push(...lote);
    if (lote.length < 500) break;
  }
  return todos;
}

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const horaBrasilia = () => new Date(Date.now() - 3 * 3600e3).getUTCHours();

export default async function handler(req, res) {
  if (!process.env.BREVO_API_KEY) return res.status(500).json({ ok: false, error: 'brevo_key' });
  const contatos = await contatosDaLista(Number(process.env.BREVO_LIST_ID || 3));
  const fila = contatos.map(c => ({ c, p: proximo(c) })).filter(x => x.p && (x.p.qual === 'sons' ? TEMPLATE_SONS || !LIGADA : TEMPLATE_APP || !LIGADA));
  const resumo = {
    sons: fila.filter(x => x.p.qual === 'sons').length,
    app_teste: fila.filter(x => x.p.qual === 'app' && x.p.origem === 'teste').length,
    app_clube: fila.filter(x => x.p.qual === 'app' && x.p.origem === 'clube').length
  };
  const h = horaBrasilia();
  if ((req.query && req.query.ver) || !LIGADA || h < 9 || h >= 20) {
    return res.status(200).json({ ok: true, ligada: LIGADA, mandaria_agora: resumo, na_lista: contatos.length, horario_ok: h >= 9 && h < 20 });
  }
  const enviados = { sons: 0, app: 0, falhas: 0 };
  for (const { c, p } of fila.slice(0, 40)) {
    const at = c.attributes || {};
    const params = p.qual === 'sons' ? paramsSons(at) : paramsApp(at, p.origem);
    if (!params) continue;
    // marca antes de mandar: se duas chamadas chegarem juntas, a segunda não manda de novo
    const campo = p.qual === 'sons' ? 'CAD_SONS_AT' : 'CAD_APP_AT';
    const marca = await brevo(`/contacts/${encodeURIComponent(c.email)}`, 'PUT', { attributes: { [campo]: hojeBrasilia() } });
    if (!marca.ok) { enviados.falhas++; continue; }
    const env = await brevo('/smtp/email', 'POST', {
      templateId: p.qual === 'sons' ? TEMPLATE_SONS : TEMPLATE_APP,
      to: [{ email: c.email }],
      params,
      tags: ['cadencia', p.qual === 'sons' ? 'cadencia-sons' : 'cadencia-app-' + p.origem]
    });
    if (env.ok) enviados[p.qual]++;
    else {
      enviados.falhas++;
      console.error('cadencia', p.qual, env.status, env.text);
      await brevo(`/contacts/${encodeURIComponent(c.email)}`, 'PUT', { attributes: { [campo]: null } }).catch(() => null);
    }
  }
  return res.status(200).json({ ok: true, enviados });
}
