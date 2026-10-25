// POST /api/inscrever
// recebe o resultado do teste e cria (ou atualiza) o contato no brevo,
// com o âmbito e as baterias salvos como atributos. a automação do brevo
// dispara o email certo a partir do atributo AMBITO.
//
// variáveis de ambiente na vercel:
//   BREVO_API_KEY  -> chave da api do brevo (configurações > sms & email > chaves api)
//   BREVO_LIST_ID  -> número da lista no brevo (hoje: 3, "The Relax Club")

const NOMES = { fis:'físico', men:'mental', emo:'emocional', soc:'social', sen:'sensorial', cri:'criativo', esp:'espiritual' };
const ATRIBUTOS = {
  NOME:'text', AMBITO:'text', AMBITO_2:'text', PERFIL:'text', BATERIA:'text', ENERGIA:'float',
  BAT_FISICO:'float', BAT_MENTAL:'float', BAT_EMOCIONAL:'float', BAT_SOCIAL:'float',
  BAT_SENSORIAL:'float', BAT_CRIATIVO:'float', BAT_ESPIRITUAL:'float',
  ORIGEM:'text', QUIZ_AT:'date', TESTE_RESPOSTAS:'text'
};
const BAT_KEY = { fis:'BAT_FISICO', men:'BAT_MENTAL', emo:'BAT_EMOCIONAL', soc:'BAT_SOCIAL', sen:'BAT_SENSORIAL', cri:'BAT_CRIATIVO', esp:'BAT_ESPIRITUAL' };

async function brevo(path, method, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method,
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

// cria os atributos que ainda não existem (só roda se o primeiro envio falhar)
async function criarAtributos() {
  for (const [nome, tipo] of Object.entries(ATRIBUTOS)) {
    await brevo('/contacts/attributes/normal/' + nome, 'POST', { type: tipo });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (b.site) return res.status(200).json({ ok: true }); // robô caiu no campo escondido

    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'email inválido' });
    if (!NOMES[b.principal] || !NOMES[b.segundo]) return res.status(400).json({ error: 'resultado inválido' });
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_LIST_ID) return res.status(500).json({ error: 'brevo não configurado' });

    const bat = b.bat || {};
    const attributes = {
      AMBITO: NOMES[b.principal],
      AMBITO_2: NOMES[b.segundo],
      PERFIL: ['normal', 'em_dia', 'espalhado'].includes(b.perfil) ? b.perfil : 'normal',
      BATERIA: String(Number(bat[b.principal]) || 0),
      ENERGIA: Number(b.energia) || 0,
      ORIGEM: String(b.origem || 'direto').slice(0, 80),
      QUIZ_AT: new Date().toISOString().slice(0, 10),
      TESTE_RESPOSTAS: JSON.stringify(b.respostas || {}).slice(0, 900)
    };
    for (const k of Object.keys(BAT_KEY)) attributes[BAT_KEY[k]] = Number(bat[k]) || 0;
    const nome = String(b.nome || '').trim().slice(0, 60);
    if (nome) attributes.NOME = nome.toLowerCase();

    const contato = { email, attributes, listIds: [Number(process.env.BREVO_LIST_ID)], updateEnabled: true };
    let r = await brevo('/contacts', 'POST', contato);
    if (!r.ok && r.status === 400 && /attribute/i.test(r.text)) {
      await criarAtributos();
      r = await brevo('/contacts', 'POST', contato);
    }
    if (!r.ok) return res.status(502).json({ error: 'brevo recusou', detail: r.text.slice(0, 300) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'erro interno', detail: String(e.message || e) });
  }
}
