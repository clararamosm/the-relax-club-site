// POST /api/link  { email, destino }
// gera o link mágico de entrar no clube pelo Firebase (sem o Firebase mandar o email dele)
// e manda o link num email nosso, pelo Brevo, de clara@therelax.club.
//
// precisa da variável de ambiente FIREBASE_SERVICE_ACCOUNT (o JSON da conta de serviço do projeto the-relax-club).
// sem ela, responde 501 e o site cai no email padrão do Firebase.
import crypto from 'node:crypto';

const PROJETO = 'the-relax-club';
const TEMPLATE_LINK = Number(process.env.BREVO_TPL_LINK || 12); // "acesso · 01 · link pra entrar"
const recentes = new Map(); // freio simples: 1 pedido por email a cada 45s (por instância)

const b64 = x => Buffer.from(x).toString('base64url');
async function tokenGoogle(sa) {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform'
  }));
  const assinatura = crypto.createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: corpo + '.' + assinatura })
  }).then(r => r.json());
  return r.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.BREVO_API_KEY) return res.status(501).json({ ok: false, error: 'sem_config' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ ok: false, error: 'email' });
  const ultimo = recentes.get(email); if (ultimo && Date.now() - ultimo < 45000) return res.status(429).json({ ok: false, error: 'espera' });
  recentes.set(email, Date.now());

  let sa; try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch (e) { return res.status(501).json({ ok: false, error: 'sem_config' }); }
  const token = await tokenGoogle(sa).catch(() => null);
  if (!token) return res.status(502).json({ ok: false, error: 'google' });

  const origem = 'https://therelax.club';
  const destino = typeof body.destino === 'string' && body.destino.startsWith('/') ? body.destino : '/';
  const continueUrl = origem + destino + (destino.includes('?') ? '&' : '?') + 'entrar=link';
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:sendOobCode`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requestType: 'EMAIL_SIGNIN', email, continueUrl, canHandleCodeInApp: true, returnOobLink: true })
  }).then(r => r.json()).catch(() => null);
  if (!r || !r.oobLink) { console.error('oob', JSON.stringify(r)); return res.status(502).json({ ok: false, error: 'firebase' }); }

  const env = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ templateId: TEMPLATE_LINK, to: [{ email }], params: { LINK: r.oobLink } })
  });
  if (!env.ok) { console.error('brevo link', env.status, await env.text()); return res.status(502).json({ ok: false, error: 'brevo' }); }
  return res.status(200).json({ ok: true });
}
