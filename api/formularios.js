// TEMPORÁRIO: preenche o campo FORMULARIOS de quem entrou antes dele existir. protegido por MANUTENCAO_TOKEN; apagar depois.
// GET /api/formularios/?token=..  (mostra)   &aplicar=1 (grava)
import { marcarFormulario, formulariosPelosCampos } from './_formularios.js';

async function brevo(path, method = 'GET', body) {
  const r = await fetch('https://api.brevo.com/v3' + path, { method, headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

export default async function handler(req, res) {
  const tok = process.env.MANUTENCAO_TOKEN;
  if (!tok || req.query.token !== tok) return res.status(404).end();
  const r = await brevo('/contacts?limit=500');
  const contatos = JSON.parse(r.text).contacts || [];
  const out = [];
  for (const c of contatos) {
    const forms = formulariosPelosCampos(c.attributes || {});
    const item = { contato: c.id, formularios: forms };
    if (req.query.aplicar) for (const f of forms) item[f] = await marcarFormulario(brevo, c.email, f);
    out.push(item);
  }
  const attrs = JSON.parse((await brevo('/contacts/attributes')).text).attributes.filter(a => a.name === 'FORMULARIOS');
  return res.status(200).json({ atributo: attrs, contatos: out });
}
