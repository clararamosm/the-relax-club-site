// TEMPORÁRIO: troca o rodapé dos modelos do brevo pelo rodapé padrão da the relax club
// (assinatura centrada sem flor, redes com youtube, caixa da sede, logo e aviso).
// protegido por MANUTENCAO_TOKEN; apagar este arquivo e a variável depois de usar.
// GET /api/rodape/?token=..&ids=1,2   -> mostra o que mudaria (sem gravar)
// &ver=ID                              -> devolve o html novo de um modelo
// &aplicar=1                           -> grava no brevo

const F = 'font-family:Arial,Helvetica,sans-serif;';
const pilula = (href, txt) => `<a href="${href}" style="display:inline-block;margin:0 3px 8px 3px;${F}font-size:13px;color:#3C4D3E;text-decoration:none;border:1px solid #E4DCCB;border-radius:99px;padding:8px 12px;">${txt}</a>`;

function rodape({ camp, aviso, botaoTeste }) {
  return `<!-- rodapé padrão trc: assinatura centrada, redes, sede, logo, aviso -->
<tr><td align="center" style="padding:14px 0 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
<tr>
<td valign="middle" style="padding-right:14px;"><img src="https://therelax.club/teste/clara.jpg" width="52" height="52" alt="Clara" style="display:block;width:52px;height:52px;border-radius:50%;"></td>
<td valign="middle" align="left" style="${F}font-size:14px;line-height:1.45;color:#5d6b5d;text-align:left;"><span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:24px;color:#293729;">Clara</span><br>The Relax Club</td>
</tr>
</table>
</td></tr>
${botaoTeste ? `<tr><td align="center" style="padding:22px 0 0 0;">${botaoTeste}</td></tr>\n` : ''}<tr><td align="center" style="padding:20px 0 0 0;">
${pilula('https://www.instagram.com/therelax.club/', 'instagram')}${pilula('https://www.pinterest.com/therelaxclubbr/', 'pinterest')}${pilula('https://www.youtube.com/@therelax-club', 'youtube')}${pilula('https://therelaxclub.substack.com', 'substack')}
</td></tr>
<tr><td align="center" style="padding:20px 0 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3EEE3;border-radius:18px;">
<tr><td align="center" style="padding:22px 22px 10px 22px;${F}font-size:15px;line-height:1.55;color:#293729;">a sede da the relax club é um lugar pra relaxar e se encontrar. acesse nosso mix de sons pra relaxar, focar ou dormir. grátis, no navegador.</td></tr>
<tr><td align="center" style="padding:0 22px 22px 22px;"><a href="https://therelax.club/?utm_source=brevo&utm_medium=email&utm_campaign=${camp}" style="display:inline-block;background:#FFFFFF;color:#3C4D3E;${F}font-size:14px;font-weight:500;text-decoration:none;border:1.5px solid #3C4D3E;border-radius:99px;padding:12px 22px;">crie seu som de descanso</a></td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:28px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:28px 0 0 0;border-top:1px solid #EFEAE0;">
<a href="https://therelax.club"><img src="https://therelax.club/email/logo.png" width="70" alt="the relax club" style="display:block;margin:0 auto;width:70px;height:auto;border:0;"></a>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:14px 24px 0 24px;${F}font-size:12px;line-height:1.6;color:#a3a99f;">${aviso}</td></tr>`;
}

const CAMP_PADRAO = { 14: 'cadencia-sons', 15: 'cadencia-app' };

function trocar(id, html) {
  const marcas = ['<!-- rodapé padrão trc', '<!-- assinatura clara centrada', '<tr><td style="padding:14px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>\n<td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>\n<td valign="middle" style="padding-right:14px;"><img src="https://therelax.club/teste/clara.jpg"'];
  let ini = -1;
  for (const m of marcas) { const i = html.indexOf(m); if (i >= 0 && (ini < 0 || i < ini)) ini = i; }
  const sair = html.indexOf('sair da lista</a></td>');
  if (ini < 0 || sair < 0 || sair < ini) return { erro: 'nao achei a assinatura ou o aviso' };
  let fim = sair + 'sair da lista</a></td>'.length;
  const resto = html.slice(fim);
  if (/^\s*<\/tr>/.test(resto)) fim += resto.indexOf('</tr>') + 5;
  else { const k = resto.indexOf('</tr></table></td></tr>'); if (k < 0) return { erro: 'fim do rodape' }; fim += k + '</tr></table></td></tr>'.length; }
  const velho = html.slice(ini, fim);
  const aviso = (velho.match(/color:#a3a99f;">([\s\S]*?sair da lista<\/a>)<\/td>/) || [])[1];
  if (!aviso) return { erro: 'aviso' };
  const camp = (velho.match(/utm_campaign=([\w-]+)/) || [])[1] || CAMP_PADRAO[id] || 'rodape';
  const botaoTeste = (velho.match(/<a [^>]*>faça o teste novamente<\/a>/) || [])[0] || '';
  const novo = html.slice(0, ini) + rodape({ camp, aviso, botaoTeste }) + html.slice(fim);
  return { novo, camp, tinhaFlor: /flor(-clara)?\.png/.test(velho), botaoTeste: !!botaoTeste, antes: velho.length, depois: novo.length - html.length + velho.length };
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
    const r = trocar(id, t.json.htmlContent || '');
    if (req.query.ver && Number(req.query.ver) === id && r.novo) return res.status(200).setHeader('content-type', 'text/html; charset=utf-8').send(r.novo);
    const item = { id, nome: t.json.name, ativo: t.json.isActive, ...r, novo: undefined };
    if (req.query.aplicar && r.novo) {
      const u = await brevo(`/smtp/templates/${id}`, 'PUT', { htmlContent: r.novo });
      item.gravado = u.ok ? 'ok' : ('erro ' + u.status + ' ' + u.text.slice(0, 120));
    }
    out.push(item);
  }
  return res.status(200).json(out);
}
