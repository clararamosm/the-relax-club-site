// POST /api/inscrever
// recebe o resultado do teste e cria (ou atualiza) o contato no brevo,
// com o ambito e as baterias salvos como atributos. depois de gravar o
// contato, dispara o email certo via API send (templates SMTP) a partir
// do PERFIL / AMBITO. nao usa automacao marketing do brevo.
//
// variaveis de ambiente na vercel:
//   BREVO_API_KEY  -> chave da api do brevo (configuracoes > sms & email > chaves api)
//   BREVO_LIST_ID  -> numero da lista no brevo (hoje: 3, "The Relax Club")

import { marcarFormulario } from './_formularios.js';

const NOMES = { fis:'físico', men:'mental', emo:'emocional', soc:'social', sen:'sensorial', cri:'criativo', esp:'espiritual' };
const ATRIBUTOS = {
  NOME:'text', AMBITO:'text', AMBITO_2:'text', PERFIL:'text', BATERIA:'text', ENERGIA:'float',
  BAT_FISICO:'float', BAT_MENTAL:'float', BAT_EMOCIONAL:'float', BAT_SOCIAL:'float',
  BAT_SENSORIAL:'float', BAT_CRIATIVO:'float', BAT_ESPIRITUAL:'float',
  ORIGEM:'text', QUIZ_AT:'date', TESTE_RESPOSTAS:'text', EMAIL_RESULTADO_AT:'date',
  // mapa ordenado do menor % pro maior, igual ao da pagina de resultado
  BAT_SORT_1_NOME:'text', BAT_SORT_2_NOME:'text', BAT_SORT_3_NOME:'text', BAT_SORT_4_NOME:'text',
  BAT_SORT_5_NOME:'text', BAT_SORT_6_NOME:'text', BAT_SORT_7_NOME:'text',
  BAT_SORT_1_PCT:'float', BAT_SORT_2_PCT:'float', BAT_SORT_3_PCT:'float', BAT_SORT_4_PCT:'float',
  BAT_SORT_5_PCT:'float', BAT_SORT_6_PCT:'float', BAT_SORT_7_PCT:'float'
};
const ORDEM = ['fis', 'men', 'emo', 'soc', 'sen', 'cri', 'esp'];

// ordem do mapa: usa o rank que o site mandou (se valido); senao ordena por % crescente,
// empate na ordem canonica fisico -> espiritual
function ordenarBaterias(batNum, rank) {
  if (Array.isArray(rank)) {
    const r = rank.filter(k => ORDEM.includes(k));
    if (r.length === 7 && new Set(r).size === 7 && r.every(k => batNum[k] != null)) return r;
  }
  return ORDEM.filter(k => batNum[k] != null)
    .sort((a, b) => (batNum[a] - batNum[b]) || (ORDEM.indexOf(a) - ORDEM.indexOf(b)));
}
const BAT_KEY = { fis:'BAT_FISICO', men:'BAT_MENTAL', emo:'BAT_EMOCIONAL', soc:'BAT_SOCIAL', sen:'BAT_SENSORIAL', cri:'BAT_CRIATIVO', esp:'BAT_ESPIRITUAL' };

// templates SMTP ativos (remetente clara@therelax.club): perfil especial ou ambito no perfil normal
const TEMPLATE_POR_CHAVE = { fis:1, men:2, emo:3, soc:4, sen:5, cri:6, esp:7 };
const TEMPLATE_POR_AMBITO = {
  físico:1, fisico:1, mental:2, emocional:3, social:4, sensorial:5, criativo:6, espiritual:7
};

function templateIdPara(perfil, principal) {
  if (perfil === 'em_dia') return 8;
  if (perfil === 'espalhado') return 9;
  if (principal && TEMPLATE_POR_CHAVE[principal] != null) return TEMPLATE_POR_CHAVE[principal];
  const nome = principal && NOMES[principal] ? NOMES[principal] : principal;
  if (nome && TEMPLATE_POR_AMBITO[nome] != null) return TEMPLATE_POR_AMBITO[nome];
  // fallback desconhecido -> fisico (template 1)
  return 1;
}

async function brevo(path, method, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

// cria os atributos que ainda nao existem (so roda se o primeiro envio falhar por atributo faltando)
let attrsProntos = false;
async function garantirAtributos() {
  if (attrsProntos) return;
  await Promise.all(Object.entries(ATRIBUTOS).map(([name, type]) =>
    brevo(`/contacts/attributes/normal/${name}`, 'POST', { type }).catch(() => null)
  ));
  attrsProntos = true;
}

function hoje() {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // YYYY-MM-DD no horário de brasília (a cadência conta os dias a partir daqui)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  if (!process.env.BREVO_API_KEY) {
    return res.status(500).json({ ok: false, error: 'brevo_key' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const {
    email, nome, site, energia, perfil, principal, segundo, bat, rank, respostas, origem
  } = body;

  // honeypot: bots preenchem "site" → responde ok sem gravar
  if (site) return res.status(200).json({ ok: true });

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'email' });
  }
  if (!principal || !NOMES[principal]) {
    return res.status(400).json({ ok: false, error: 'principal' });
  }

  const batObj = bat && typeof bat === 'object' ? bat : {};
  const perfilOk = (perfil === 'em_dia' || perfil === 'espalhado' || perfil === 'normal')
    ? perfil
    : 'normal';

  const attributes = {
    NOME: typeof nome === 'string' && nome.trim() ? nome.trim().slice(0, 120) : undefined,
    AMBITO: NOMES[principal],
    AMBITO_2: segundo && NOMES[segundo] ? NOMES[segundo] : undefined,
    PERFIL: perfilOk,
    BATERIA: batObj[principal] != null ? String(batObj[principal]) : undefined,
    ENERGIA: typeof energia === 'number' ? energia : (energia != null ? Number(energia) : undefined),
    ORIGEM: typeof origem === 'string' && origem.trim() ? origem.trim().slice(0, 200) : undefined,
    QUIZ_AT: hoje(),
    TESTE_RESPOSTAS: respostas != null ? JSON.stringify(respostas).slice(0, 5000) : undefined
  };

  const batNum = {};
  for (const [k, attr] of Object.entries(BAT_KEY)) {
    if (batObj[k] != null && batObj[k] !== '') {
      const n = Number(batObj[k]);
      if (!Number.isNaN(n)) { attributes[attr] = n; batNum[k] = n; }
    }
  }
  ordenarBaterias(batNum, rank).forEach((k, i) => {
    attributes[`BAT_SORT_${i + 1}_NOME`] = NOMES[k];
    attributes[`BAT_SORT_${i + 1}_PCT`] = batNum[k];
  });

  // remove undefined pra nao apagar attrs no update
  for (const k of Object.keys(attributes)) {
    if (attributes[k] === undefined || attributes[k] === null || Number.isNaN(attributes[k])) {
      delete attributes[k];
    }
  }

  await garantirAtributos();

  const emailNorm = email.trim().toLowerCase();
  const listId = Number(process.env.BREVO_LIST_ID || 3);
  const r = await brevo('/contacts', 'POST', {
    email: emailNorm,
    attributes,
    listIds: [listId],
    updateEnabled: true
  });

  if (!r.ok) {
    // se falhou por atributo novo, tenta criar de novo e reenviar uma vez
    attrsProntos = false;
    await garantirAtributos();
    const r2 = await brevo('/contacts', 'POST', {
      email: emailNorm,
      attributes,
      listIds: [listId],
      updateEnabled: true
    });
    if (!r2.ok) {
      console.error('brevo error', r2.status, r2.text);
      return res.status(502).json({ ok: false, error: 'brevo' });
    }
  }

  await marcarFormulario(brevo, emailNorm, 'teste');

  // contato gravado: tenta enviar o transactional; falha do email nao derruba a request
  const templateId = templateIdPara(perfilOk, principal);
  let emailSent = false;
  try {
    const send = await brevo('/smtp/email', 'POST', {
      templateId,
      to: [{ email: emailNorm }]
    });
    if (send.ok) {
      emailSent = true;
      // marca no contato que o email 1 (resultado) saiu: é o que o painel conta no funil
      await brevo(`/contacts/${encodeURIComponent(emailNorm)}`, 'PUT', { attributes: { EMAIL_RESULTADO_AT: hoje() } }).catch(() => null);
    } else {
      console.error('brevo smtp send error', send.status, send.text, 'templateId', templateId);
    }
  } catch (err) {
    console.error('brevo smtp send exception', err && err.message ? err.message : err, 'templateId', templateId);
  }

  return res.status(200).json({ ok: true, emailSent });
}
