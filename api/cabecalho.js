// temporário: tira o cabeçalho "a clara preparou isso pra você" dos modelos que não são de resultado nem de som.
// protegido pelo MANUTENCAO_TOKEN. ?token=...  mostra o que sairia; &aplicar=1 grava no brevo. apagar depois de usar.
const IDS = [10, 12, 13, 15];
const RE = /<tr><td[^>]*><table[^>]*><tr>\s*<td[^>]*><img src="https:\/\/therelax\.club\/teste\/clara\.jpg" width="34"[\s\S]*?<\/table><\/td><\/tr>\s*/;
export default async function handler(req, res) {
  if (!process.env.MANUTENCAO_TOKEN || req.query.token !== process.env.MANUTENCAO_TOKEN) return res.status(404).end();
  const h = { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' };
  const out = [];
  for (const id of IDS) {
    const t = await (await fetch(`https://api.brevo.com/v3/smtp/templates/${id}`, { headers: h })).json();
    const html = t.htmlContent || '';
    const m = html.match(RE);
    const item = { id, nome: t.name, achou: !!m, texto: m ? m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null, tamanho: m ? m[0].length : 0 };
    if (m && req.query.aplicar === '1') {
      const r = await fetch(`https://api.brevo.com/v3/smtp/templates/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({ htmlContent: html.replace(RE, '') }) });
      item.gravou = r.status;
    }
    out.push(item);
  }
  res.status(200).json(out);
}
