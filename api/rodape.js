// TEMPORÁRIO: troca as redes por ícones e a caixa da sede só pelo botão, no rodapé padrão dos modelos do brevo.
// protegido por MANUTENCAO_TOKEN; apagar depois de usar.
// GET /api/rodape/?token=..&ids=1,2 (mostra)  &ver=ID (html novo)  &aplicar=1 (grava)
const icone = (href, nome) => `<a href="${href}" style="display:inline-block;margin:0 5px;"><img src="https://therelax.club/email/redes/${nome}.png" width="36" height="36" alt="${nome}" style="display:block;width:36px;height:36px;border:0;"></a>`;
const REDES = `<tr><td align="center" style="padding:18px 0 0 0;">
${icone('https://www.instagram.com/therelax.club/', 'instagram')}${icone('https://www.pinterest.com/therelaxclubbr/', 'pinterest')}${icone('https://www.youtube.com/@therelax-club', 'youtube')}${icone('https://therelaxclub.substack.com', 'substack')}
</td></tr>`;
const botao = (camp) => `<tr><td align="center" style="padding:22px 0 0 0;"><a href="https://therelax.club/?utm_source=brevo&utm_medium=email&utm_campaign=${camp}" style="display:inline-block;background:#FFFFFF;color:#3C4D3E;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:500;text-decoration:none;border:1.5px solid #3C4D3E;border-radius:99px;padding:12px 22px;">crie seu som de descanso</a></td></tr>`;

function trocar(html) {
  const ini = html.indexOf('<tr><td align="center" style="padding:20px 0 0 0;">\n<a href="https://www.instagram.com/therelax.club/"');
  const fimMarca = '<tr><td align="center" style="padding:28px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:28px 0 0 0;border-top:1px solid #EFEAE0;">';
  const fim = html.indexOf(fimMarca);
  if (ini < 0 || fim < 0 || fim < ini) return { erro: 'rodape padrao nao encontrado' };
  const velho = html.slice(ini, fim);
  const camp = (velho.match(/utm_campaign=([\w-]+)/) || [])[1] || 'rodape';
  return { camp, novo: html.slice(0, ini) + botao(camp) + '\n' + REDES + '\n' + html.slice(fim) };
}

async function brevo(path, method = 'GET', body) {
  const r = await fetch('https://api.brevo.com/v3' + path, { method, headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j, text: t };
}

export default async function handler(req, res) {
  const tok = process.env.MANUTENCAO_TOKEN;
  if (!tok || req.query.token !== tok) return res.status(404).end();
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const out = [];
  for (const id of ids) {
    const t = await brevo(`/smtp/templates/${id}`);
    if (!t.ok) { out.push({ id, erro: 'get ' + t.status }); continue; }
    const r = trocar(t.json.htmlContent || '');
    if (req.query.ver && Number(req.query.ver) === id && r.novo) return res.status(200).setHeader('content-type', 'text/html; charset=utf-8').send(r.novo);
    const item = { id, nome: t.json.name, camp: r.camp, erro: r.erro };
    if (req.query.aplicar && r.novo) { const u = await brevo(`/smtp/templates/${id}`, 'PUT', { htmlContent: r.novo }); item.gravado = u.ok ? 'ok' : 'erro ' + u.status; }
    out.push(item);
  }
  return res.status(200).json(out);
}
