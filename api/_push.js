// módulo compartilhado das notificações (arquivos que começam com _ não viram rota na vercel).
// guarda quem aceitou receber no blob privado "trc-avisos" (inscricoes/<hash>.json) e manda as notificações (web push).
//
// variáveis de ambiente na vercel:
//   VAPID_PUBLICA, VAPID_PRIVADA -> par de chaves das notificações (a pública também está em js/instalar.js)
//   BLOB_READ_WRITE_TOKEN        -> criada sozinha quando o blob "trc-avisos" foi ligado ao projeto
import crypto from 'node:crypto';
import webpush from 'web-push';
import { put, list, get, del } from '@vercel/blob';

export const PASTA = 'inscricoes/';
export const configurado = () => !!(process.env.VAPID_PUBLICA && process.env.VAPID_PRIVADA && process.env.BLOB_READ_WRITE_TOKEN);
export const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 40);

// só aceita endereços dos serviços de notificação dos navegadores (google, apple, mozilla, microsoft)
const SERVICOS = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
export function validar(sub) {
  if (!sub || typeof sub !== 'object') return null;
  let u; try { u = new URL(String(sub.endpoint || '')); } catch (e) { return null; }
  if (u.protocol !== 'https:' || !SERVICOS.test(u.hostname) || u.href.length > 1000) return null;
  const k = sub.keys || {};
  if (typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || k.p256dh.length > 200 || k.auth.length > 100) return null;
  return { endpoint: u.href, keys: { p256dh: k.p256dh, auth: k.auth } };
}

function iniciar() {
  webpush.setVapidDetails('mailto:clara@therelax.club', process.env.VAPID_PUBLICA, process.env.VAPID_PRIVADA);
}

export async function guardar(sub, extra = {}) {
  const id = hash(sub.endpoint);
  await put(PASTA + id + '.json', JSON.stringify({ sub, ...extra, em: new Date().toISOString() }), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
  });
  return id;
}
export async function remover(endpoint) { await del(PASTA + hash(endpoint) + '.json').catch(() => {}); }

export async function contar() {
  let n = 0, cursor;
  do { const r = await list({ prefix: PASTA, cursor, limit: 1000 }); n += r.blobs.length; cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return n;
}

async function ler(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

// manda pra uma inscrição. devolve 'ok' | 'removida' | 'falha'
export async function enviarPara(sub, dados) {
  iniciar();
  try {
    await webpush.sendNotification(sub, JSON.stringify(dados), { TTL: 60 * 60 * 24, urgency: 'normal' });
    return 'ok';
  } catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) { await remover(sub.endpoint); return 'removida'; } // a pessoa desinstalou ou bloqueou
    console.error('push', e && e.statusCode, e && e.body);
    return 'falha';
  }
}

// manda pra todo mundo que aceitou. dados: { titulo, texto, url, tag }
export async function enviarParaTodos(dados) {
  const total = { enviadas: 0, removidas: 0, falhas: 0 };
  let cursor;
  do {
    const r = await list({ prefix: PASTA, cursor, limit: 1000 });
    for (let i = 0; i < r.blobs.length; i += 20) {
      const lote = r.blobs.slice(i, i + 20);
      const res = await Promise.all(lote.map(async b => {
        const reg = await ler(b.pathname).catch(() => null);
        if (!reg || !reg.sub) return 'falha';
        return enviarPara(reg.sub, dados);
      }));
      res.forEach(x => { if (x === 'ok') total.enviadas++; else if (x === 'removida') total.removidas++; else total.falhas++; });
    }
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  return total;
}

// marca que um envio automático já foi feito (pra não repetir). devolve false se já tinha sido marcado.
export async function marcarEnvio(chave) {
  const nome = 'enviados/' + hash(chave) + '.json';
  const r = await list({ prefix: nome, limit: 1 });
  if (r.blobs.length) return false;
  await put(nome, JSON.stringify({ chave, em: new Date().toISOString() }), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  return true;
}

export const corpo = req => { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return {}; } };
