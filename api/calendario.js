// calendário "31 dias pra parar de propósito" (porta aberta pra sempre, o dia 1 é de cada pessoa).
//
// POST /api/calendario  { e, t }                         -> ativa pelo link do email (quem já está na lista). t = CAL_TOKEN do contato.
// POST /api/calendario  { nome, email, site, source... } -> entra pelo formulário da página (quem ainda não está na lista).
// GET  /api/calendario?preparar=1                         -> dá um CAL_TOKEN pra quem está nas listas e ainda não tem
//                                                            (é o que vai no link do botão "ativar" dos emails de divulgação).
//                                                            não mostra nada de ninguém: só devolve quantos receberam token.
//
// o que fica gravado no contato do brevo:
//   CAL_OPTIN_AT  dia em que a pessoa confirmou
//   CAL_INICIO    o dia 1 dela (01/12/2026 pra quem ativa antes; depois disso, o dia seguinte). nunca muda depois de gravado.
//   CAL_ORIGEM    'email' (ativou pelo link) ou 'pagina' (formulário)
// e a pessoa entra na lista "calendário · ativos" (usada pra tirar quem já ativou dos próximos emails de divulgação).
//
// variáveis de ambiente na vercel: BREVO_API_KEY, BREVO_LIST_ID (já existem)
import crypto from 'node:crypto';
import { marcarFormulario } from './_formularios.js';

const LISTA_ATIVOS = 'calendário · ativos';
const LISTAS_DIVULGACAO = [Number(process.env.BREVO_LIST_ID || 3), 5]; // the relax club + planner · lista de espera
const LANCAMENTO = '2026-12-01';
const ATRIBUTOS = [['CAL_TOKEN', 'text'], ['CAL_OPTIN_AT', 'date'], ['CAL_INICIO', 'date'], ['CAL_ORIGEM', 'text'],
  ['CAL_UTM_SOURCE', 'text'], ['CAL_UTM_MEDIUM', 'text'], ['CAL_UTM_CAMPAIGN', 'text'], ['CAL_REFERRER', 'text'], ['ORIGEM', 'text'], ['NOME', 'text']];

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
const corta = (t, n = 120) => (t == null || String(t).trim() === '' ? undefined : String(t).trim().slice(0, n));
const hojeBrasilia = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const amanha = () => new Date(Date.now() - 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
const inicioPraHoje = () => (amanha() > LANCAMENTO ? amanha() : LANCAMENTO);
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;

async function garantirCampos() {
  await Promise.all(ATRIBUTOS.map(([n, type]) => brevo(`/contacts/attributes/normal/${n}`, 'POST', { type }).catch(() => null)));
}
async function listaAtivos() {
  const r = await brevo('/contacts/lists?limit=50');
  const l = ((r.json && r.json.lists) || []).find(x => x.name === LISTA_ATIVOS);
  if (l) return l.id;
  const c = await brevo('/contacts/lists', 'POST', { name: LISTA_ATIVOS, folderId: 1 });
  return c.json && c.json.id;
}

// grava a confirmação. CAL_INICIO só é gravado uma vez por pessoa.
async function ativar(email, antes, extra) {
  const ja = antes.CAL_INICIO;
  const inicio = ja || inicioPraHoje();
  const attributes = { ...extra };
  if (!ja) Object.assign(attributes, { CAL_INICIO: inicio, CAL_OPTIN_AT: hojeBrasilia() });
  Object.keys(attributes).forEach(k => attributes[k] === undefined && delete attributes[k]);
  const lista = await listaAtivos();
  const listIds = [Number(process.env.BREVO_LIST_ID || 3)]; if (lista) listIds.push(lista);
  const r = await brevo('/contacts', 'POST', { email, attributes, listIds, updateEnabled: true });
  if (!r.ok) { console.error('calendario ativar', r.status, r.text); return null; }
  await marcarFormulario(brevo, email, 'calendario');
  return { inicio: String(inicio).slice(0, 10), ja: !!ja };
}

export default async function handler(req, res) {
  if (!process.env.BREVO_API_KEY) return res.status(500).json({ ok: false, error: 'brevo_key' });

  if (req.method === 'GET' && req.query && req.query.preparar) {
    await garantirCampos();
    let novos = 0, total = 0;
    for (const listId of LISTAS_DIVULGACAO) {
      for (let offset = 0; offset < 5000; offset += 500) {
        const r = await brevo(`/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`);
        const lote = (r.json && r.json.contacts) || [];
        for (const c of lote) {
          total++;
          if (c.attributes && c.attributes.CAL_TOKEN) continue;
          const u = await brevo(`/contacts/${encodeURIComponent(c.email)}`, 'PUT', { attributes: { CAL_TOKEN: crypto.randomBytes(12).toString('hex') } });
          if (u.ok) novos++;
        }
        if (lote.length < 500) break;
      }
    }
    return res.status(200).json({ ok: true, contatos: total, tokens_novos: novos });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (b.site) return res.status(200).json({ ok: true }); // robô preencheu o campo escondido
  await garantirCampos();

  // 1) ativar pelo link do email
  if (b.t) {
    const email = String(b.e || '').trim().toLowerCase().replace(/ /g, '+');
    if (!emailOk(email)) return res.status(400).json({ ok: false, error: 'link' });
    const c = await brevo(`/contacts/${encodeURIComponent(email)}`);
    const at = (c.json && c.json.attributes) || {};
    const a = String(at.CAL_TOKEN || ''), t = String(b.t);
    if (!c.ok || !a || a.length !== t.length || !crypto.timingSafeEqual(Buffer.from(a), Buffer.from(t))) return res.status(400).json({ ok: false, error: 'link' });
    const r = await ativar(email, at, { CAL_ORIGEM: at.CAL_ORIGEM || 'email' });
    if (!r) return res.status(502).json({ ok: false, error: 'brevo' });
    const nome = String(at.NOME || '').split(/\s+/)[0].toLowerCase();
    return res.status(200).json({ ok: true, inicio: r.inicio, ja: r.ja, nome });
  }

  // 2) formulário da página
  const email = String(b.email || '').trim().toLowerCase();
  if (!emailOk(email)) return res.status(400).json({ ok: false, error: 'email' });
  const c = await brevo(`/contacts/${encodeURIComponent(email)}`);
  const at = (c.ok && c.json && c.json.attributes) || {};
  const nome = corta(String(b.nome || '').split(/\s+/)[0], 60);
  const r = await ativar(email, at, {
    ORIGEM: at.ORIGEM || 'calendario',
    NOME: at.NOME || nome,
    CAL_ORIGEM: at.CAL_ORIGEM || 'pagina',
    CAL_TOKEN: at.CAL_TOKEN || crypto.randomBytes(12).toString('hex'),
    CAL_UTM_SOURCE: at.CAL_UTM_SOURCE || corta(b.source),
    CAL_UTM_MEDIUM: at.CAL_UTM_MEDIUM || corta(b.medium),
    CAL_UTM_CAMPAIGN: at.CAL_UTM_CAMPAIGN || corta(b.campaign),
    CAL_REFERRER: at.CAL_REFERRER || corta(b.ref)
  });
  if (!r) return res.status(502).json({ ok: false, error: 'brevo' });
  return res.status(200).json({ ok: true, inicio: r.inicio, ja: r.ja });
}
