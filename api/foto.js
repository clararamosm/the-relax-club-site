// GET /api/foto?u=<url da foto do google>
// repassa a foto de perfil do Google pelo nosso domínio, pra carteirinha conseguir mostrar e baixar a imagem.
// só aceita fotos do googleusercontent.com.
export default async function handler(req, res) {
  const u = String(req.query.u || '');
  let url;
  try { url = new URL(u); } catch (e) { return res.status(400).end(); }
  if (url.protocol !== 'https:' || !/(^|\.)googleusercontent\.com$/.test(url.hostname)) return res.status(400).end();
  const r = await fetch(url.toString()).catch(() => null);
  if (!r || !r.ok) return res.status(404).end();
  const tipo = r.headers.get('content-type') || 'image/jpeg';
  if (!tipo.startsWith('image/')) return res.status(400).end();
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('content-type', tipo);
  res.setHeader('cache-control', 'public, max-age=86400');
  return res.status(200).send(buf);
}
