// POST /api/clube  { idToken, acao }
// chamada pelo site quando alguém entra no clube, muda o teste, o nome ou a preferência de emails.
// confere o token do Firebase, lê o perfil do membro direto no Firestore (com o próprio token dele)
// e grava ou atualiza o contato no Brevo com os dados de membro e de origem.
//
// acao: 'sync' (padrão) atualiza o contato e, se a pessoa aceitou os emails, coloca na lista
//       'sair'  atualiza e tira da lista (desligou os emails no perfil)
//       'excluir' tira da lista antes de a conta ser apagada
// quem não aceitou os emails fica só como contato (sem lista), pra não receber campanha.
//
// variáveis de ambiente na vercel: BREVO_API_KEY, BREVO_LIST_ID (já existem)

import { marcarFormulario } from './_formularios.js';

const FIREBASE_API_KEY = 'AIzaSyDwhk7BcD59scuOpUYbGBEmoWepLA-rR7E'; // chave pública do app web
const PROJETO = 'the-relax-club';
const FUNDADORES_ATE = 199;
const TEMPLATE_BOAS_VINDAS = 10; // "welcome sede · carteirinha" no Brevo, vai pra todo membro novo
const LISTA_SEM_OPTIN = 'clube sem opt-in'; // membros que não aceitaram os emails: ficam aqui, fora das cadências

// acha (ou cria) a lista dos membros sem opt-in, na mesma pasta da lista principal
async function listaSemOptin(listId) {
  const r = await brevo('/contacts/lists?limit=50', 'GET');
  try { const l = (JSON.parse(r.text).lists || []).find(x => x.name === LISTA_SEM_OPTIN); if (l) return l.id; } catch (e) {}
  let folderId = 1;
  try { folderId = JSON.parse((await brevo(`/contacts/lists/${listId}`, 'GET')).text).folderId || 1; } catch (e) {}
  try { return JSON.parse((await brevo('/contacts/lists', 'POST', { name: LISTA_SEM_OPTIN, folderId })).text).id; } catch (e) { return null; }
}

const ATRIBUTOS = [
  ['ORIGEM', 'text'], ['NOME', 'text'],
  ['CLUBE_AT', 'date'], ['MEMBRO_NUM', 'float'], ['FUNDADOR', 'boolean'], ['CLUBE_OPTIN', 'boolean'],
  ['CLUBE_LOGIN', 'text'], ['CLUBE_PAGINA', 'text'], ['CLUBE_GATILHO', 'text'],
  ['CLUBE_UTM_SOURCE', 'text'], ['CLUBE_UTM_MEDIUM', 'text'], ['CLUBE_UTM_CAMPAIGN', 'text'],
  ['CLUBE_REFERRER', 'text'], ['CLUBE_ENTRADA', 'text'],
  ['DESCANSO_PRINCIPAL', 'text'], ['ULTIMO_TESTE_AT', 'date'], ['EMAIL_BOAS_VINDAS_AT', 'date']
];
const AMB = { fis: 'físico', men: 'mental', emo: 'emocional', soc: 'social', sen: 'sensorial', cri: 'criativo', esp: 'espiritual' };

async function brevo(path, method, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// converte o formato do Firestore REST em objeto simples
function valor(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return campos(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  return null;
}
const campos = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, valor(v)]));
const dia = iso => { try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return undefined; } };
const corta = (t, n = 120) => (t == null || t === '' ? undefined : String(t).slice(0, n));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { idToken } = body;
  const acao = ['sync', 'sair', 'excluir'].includes(body.acao) ? body.acao : 'sync';
  if (!idToken) return res.status(400).json({ ok: false, error: 'token' });

  // quem é a pessoa (ninguém consegue mexer no contato de outra pessoa)
  const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken })
  }).then(r => r.json()).catch(() => null);
  const u = look && look.users && look.users[0];
  if (!u || !u.email) return res.status(401).json({ ok: false, error: 'auth' });
  if (!process.env.BREVO_API_KEY) return res.status(500).json({ ok: false, error: 'brevo_key' });

  const email = u.email.toLowerCase();
  const listId = Number(process.env.BREVO_LIST_ID || 3);

  if (acao === 'excluir') {
    await brevo(`/contacts/lists/${listId}/contacts/remove`, 'POST', { emails: [email] });
    const semId = await listaSemOptin(listId);
    if (semId) await brevo(`/contacts/lists/${semId}/contacts/remove`, 'POST', { emails: [email] });
    await brevo(`/contacts/${encodeURIComponent(email)}`, 'PUT', { attributes: { CLUBE_OPTIN: false } });
    return res.status(200).json({ ok: true });
  }

  // perfil do membro, lido com o token dele (as regras só deixam ele ler o próprio)
  const doc = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents/users/${u.localId}`, {
    headers: { authorization: `Bearer ${idToken}` }
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const p = doc && doc.fields ? campos(doc.fields) : {};

  await Promise.all(ATRIBUTOS.map(([name, type]) => brevo(`/contacts/attributes/normal/${name}`, 'POST', { type }).catch(() => null)));

  // não sobrescreve a ORIGEM de quem já era contato (ex.: veio pelo teste)
  const atual = await brevo(`/contacts/${encodeURIComponent(email)}`, 'GET');
  let origemAtual = '';
  if (atual.ok) { try { origemAtual = JSON.parse(atual.text).attributes?.ORIGEM || ''; } catch (e) {} }

  const prov = (u.providerUserInfo || [])[0]?.providerId || '';
  const metodo = p.cadastro?.metodo || (prov === 'google.com' ? 'google' : 'email');
  const nome = p.nome || u.displayName || '';
  const optin = acao === 'sair' ? false : !!p.optin;
  const o = p.origem || {};
  const attributes = {
    ORIGEM: origemAtual || 'clube',
    NOME: corta(String(nome).trim().split(/\s+/)[0], 60),
    CLUBE_AT: dia(p.membroDesde || p.criado || Date.now()),
    MEMBRO_NUM: p.membro || undefined,
    FUNDADOR: p.membro ? p.membro <= FUNDADORES_ATE : undefined,
    CLUBE_OPTIN: optin,
    CLUBE_LOGIN: metodo,
    CLUBE_PAGINA: corta(p.cadastro?.pagina),
    CLUBE_GATILHO: corta(p.cadastro?.gatilho),
    CLUBE_UTM_SOURCE: corta(o.source),
    CLUBE_UTM_MEDIUM: corta(o.medium),
    CLUBE_UTM_CAMPAIGN: corta(o.campaign),
    CLUBE_REFERRER: corta(o.ref),
    CLUBE_ENTRADA: corta(o.landing),
    DESCANSO_PRINCIPAL: p.teste?.principal ? AMB[p.teste.principal] || p.teste.principal : undefined,
    ULTIMO_TESTE_AT: p.teste?.data ? dia(p.teste.data) : undefined
  };
  Object.keys(attributes).forEach(k => attributes[k] === undefined && delete attributes[k]);

  // quem aceitou vai pra lista principal (cadências); quem não aceitou fica na lista "clube sem opt-in"
  const semId = await listaSemOptin(listId);
  const payload = { email, attributes, updateEnabled: true, listIds: optin ? [listId] : (semId ? [semId] : []) };
  if (!payload.listIds.length) delete payload.listIds;
  const r = await brevo('/contacts', 'POST', payload);
  if (!r.ok) { console.error('brevo clube', r.status, r.text); return res.status(502).json({ ok: false, error: 'brevo' }); }
  if (p.membro) await marcarFormulario(brevo, email, 'clube');
  const tirarDe = optin ? semId : (acao === 'sair' ? listId : null);
  if (tirarDe) await brevo(`/contacts/lists/${tirarDe}/contacts/remove`, 'POST', { emails: [email] });

  // boas-vindas: uma vez só, pra todo membro (com ou sem opt-in).
  // primeiro "reserva" o envio no perfil com trava de versão: se dois pedidos chegam juntos, só um passa.
  let boasVindas = !!p.boasVindas;
  if (!boasVindas && p.membro && doc && doc.updateTime) {
    const reserva = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents/users/${u.localId}?updateMask.fieldPaths=boasVindas&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { boasVindas: { timestampValue: new Date().toISOString() } } })
    }).catch(() => null);
    if (reserva && reserva.ok) {
      const env = await brevo('/smtp/email', 'POST', { templateId: TEMPLATE_BOAS_VINDAS, to: [{ email, name: String(nome).trim() || undefined }] });
      boasVindas = env.ok;
      if (!env.ok) console.error('boas-vindas', env.status, env.text);
      // marca no contato que o email de boas-vindas saiu: é o que o painel conta no funil do clube
      else await brevo(`/contacts/${encodeURIComponent(email)}`, 'PUT', { attributes: { EMAIL_BOAS_VINDAS_AT: dia(Date.now()) } }).catch(() => null);
    }
  }
  return res.status(200).json({ ok: true, lista: optin ? 'principal' : 'sem opt-in', boasVindas });
}
