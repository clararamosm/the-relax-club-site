// POST /api/clube
// chamada pelo site quando alguém cria conta no clube (login pelo Firebase).
// confere o token do Firebase e, se a pessoa marcou que quer receber emails,
// grava (ou atualiza) o contato no Brevo com ORIGEM=clube.
//
// variáveis de ambiente na vercel: BREVO_API_KEY, BREVO_LIST_ID (já existem)

const FIREBASE_API_KEY = 'AIzaSyDwhk7BcD59scuOpUYbGBEmoWepLA-rR7E'; // chave pública do app web

async function brevo(path, method, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { idToken, nome, optin } = body;
  if (!idToken) return res.status(400).json({ ok: false, error: 'token' });

  // confere quem é a pessoa direto no Firebase (ninguém consegue inscrever o email de outra pessoa)
  const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken })
  }).then(r => r.json()).catch(() => null);
  const u = look && look.users && look.users[0];
  if (!u || !u.email) return res.status(401).json({ ok: false, error: 'auth' });

  if (!optin) return res.status(200).json({ ok: true, brevo: false });
  if (!process.env.BREVO_API_KEY) return res.status(500).json({ ok: false, error: 'brevo_key' });

  for (const [name, type] of [['ORIGEM', 'text'], ['NOME', 'text'], ['CLUBE_AT', 'date']]) {
    await brevo(`/contacts/attributes/normal/${name}`, 'POST', { type }).catch(() => null);
  }
  const attributes = { ORIGEM: 'clube', CLUBE_AT: new Date().toISOString().slice(0, 10) };
  const n = (typeof nome === 'string' && nome.trim()) || u.displayName;
  if (n) attributes.NOME = String(n).trim().split(/\s+/)[0].slice(0, 60);
  const r = await brevo('/contacts', 'POST', {
    email: u.email.toLowerCase(), attributes, listIds: [Number(process.env.BREVO_LIST_ID || 3)], updateEnabled: true
  });
  if (!r.ok) { console.error('brevo clube', r.status, r.text); return res.status(502).json({ ok: false, error: 'brevo' }); }
  return res.status(200).json({ ok: true, brevo: true });
}
