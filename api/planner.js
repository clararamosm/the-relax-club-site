// POST /api/planner  { nome, email, source, medium, campaign, ref, site }
// lista de espera do planner: grava o contato no Brevo, na lista "planner · lista de espera"
// (criada sozinha no primeiro cadastro, na mesma pasta da lista principal).
// quem entra aqui não vai pra lista principal do clube: é uma lista segmentada só do planner.
//
// variáveis de ambiente na vercel: BREVO_API_KEY, BREVO_LIST_ID (já existem)

import { marcarFormulario } from './_formularios.js';

const LISTA_PLANNER = 'planner · lista de espera';
const TEMPLATE_CONFIRMA = 13; // "planner · 01 · lista de espera" no Brevo: confirma a entrada e dá um spoiler
const ATRIBUTOS = [
  ['ORIGEM', 'text'], ['NOME', 'text'],
  ['PLANNER_ESPERA', 'boolean'], ['PLANNER_AT', 'date'],
  ['PLANNER_UTM_SOURCE', 'text'], ['PLANNER_UTM_MEDIUM', 'text'], ['PLANNER_UTM_CAMPAIGN', 'text'], ['PLANNER_REFERRER', 'text']
];

async function brevo(path, method, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}
const corta = (t, n = 120) => (t == null || String(t).trim() === '' ? undefined : String(t).trim().slice(0, n));

async function listaPlanner() {
  const r = await brevo('/contacts/lists?limit=50', 'GET');
  try { const l = (JSON.parse(r.text).lists || []).find(x => x.name === LISTA_PLANNER); if (l) return l.id; } catch (e) {}
  let folderId = 1;
  try { folderId = JSON.parse((await brevo(`/contacts/lists/${Number(process.env.BREVO_LIST_ID || 3)}`, 'GET')).text).folderId || 1; } catch (e) {}
  try { return JSON.parse((await brevo('/contacts/lists', 'POST', { name: LISTA_PLANNER, folderId })).text).id; } catch (e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (body.site) return res.status(200).json({ ok: true }); // robô preencheu o campo escondido
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ ok: false, error: 'email' });
  if (!process.env.BREVO_API_KEY) return res.status(500).json({ ok: false, error: 'brevo_key' });

  await Promise.all(ATRIBUTOS.map(([name, type]) => brevo(`/contacts/attributes/normal/${name}`, 'POST', { type }).catch(() => null)));
  const listId = await listaPlanner();
  if (!listId) return res.status(502).json({ ok: false, error: 'lista' });

  // quem já era contato (do teste ou do clube) mantém ORIGEM e NOME
  const atual = await brevo(`/contacts/${encodeURIComponent(email)}`, 'GET');
  let antes = {}, jaNaLista = false;
  if (atual.ok) { try { const c = JSON.parse(atual.text); antes = c.attributes || {}; jaNaLista = (c.listIds || []).includes(listId); } catch (e) {} }

  const nome = corta(String(body.nome || '').split(/\s+/)[0], 60);
  const attributes = {
    ORIGEM: antes.ORIGEM || 'planner',
    NOME: antes.NOME || nome,
    PLANNER_ESPERA: true,
    PLANNER_AT: antes.PLANNER_AT || new Date().toISOString().slice(0, 10),
    PLANNER_UTM_SOURCE: antes.PLANNER_UTM_SOURCE || corta(body.source),
    PLANNER_UTM_MEDIUM: antes.PLANNER_UTM_MEDIUM || corta(body.medium),
    PLANNER_UTM_CAMPAIGN: antes.PLANNER_UTM_CAMPAIGN || corta(body.campaign),
    PLANNER_REFERRER: antes.PLANNER_REFERRER || corta(body.ref)
  };
  Object.keys(attributes).forEach(k => attributes[k] === undefined && delete attributes[k]);

  // se o Brevo recusar os atributos, tenta de novo só com o essencial: o importante é a pessoa entrar na lista
  let r = await brevo('/contacts', 'POST', { email, attributes, listIds: [listId], updateEnabled: true });
  if (!r.ok) {
    console.error('brevo planner', r.status, r.text);
    r = await brevo('/contacts', 'POST', { email, listIds: [listId], updateEnabled: true });
    if (!r.ok && atual.ok) r = await brevo(`/contacts/lists/${listId}/contacts/add`, 'POST', { emails: [email] });
    if (!r.ok) { console.error('brevo planner minimo', r.status, r.text); return res.status(502).json({ ok: false, error: 'brevo' }); }
  }
  await marcarFormulario(brevo, email, 'planner');
  // email de confirmação, só na primeira vez que a pessoa entra na lista
  if (!jaNaLista) {
    const env = await brevo('/smtp/email', 'POST', { templateId: TEMPLATE_CONFIRMA, to: [{ email, name: nome || undefined }], params: { NOME: nome || '' } });
    if (!env.ok) console.error('planner confirma', env.status, env.text);
  }
  return res.status(200).json({ ok: true });
}
