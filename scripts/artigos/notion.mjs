/* modo notion: com NOTION_TOKEN, busca os artigos direto da base "Artigos do site" e atualiza o snapshot conteudo/artigos.json.
   a integração do notion precisa ter acesso às bases "Artigos do site" e "vídeos do youtube". */
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';

export const DATA_SOURCE_ARTIGOS = '5b446831-0103-4483-bf38-6d97a926a4f6';
const STATUS_ACEITOS = new Set(['Revisão', 'Publicado']);

const texto = p => (p?.rich_text || p?.title || []).map(t => t.plain_text).join('').trim();

async function baixar(url, destinoSemExt) {
  const r = await fetch(url); if (!r.ok) throw new Error('não baixou a capa: ' + r.status);
  const tipo = r.headers.get('content-type') || '';
  const ext = tipo.includes('png') ? '.png' : tipo.includes('webp') ? '.webp' : tipo.includes('svg') ? '.svg' : '.jpg';
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(destinoSemExt), { recursive: true });
  for (const e of ['.png', '.jpg', '.webp', '.svg']) if (e !== ext) fs.rmSync(destinoSemExt + e, { force: true });
  fs.writeFileSync(destinoSemExt + ext, buf);
  return path.basename(destinoSemExt) + ext;
}

export async function lerDoNotion({ token, raiz }) {
  const notion = new Client({ auth: token });
  const n2m = new NotionToMarkdown({ notionClient: notion });
  const paginas = [];
  let cursor;
  do {
    const r = await notion.dataSources.query({ data_source_id: DATA_SOURCE_ARTIGOS, start_cursor: cursor, page_size: 100 });
    paginas.push(...r.results); cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);

  const videosCache = new Map();
  const video = async id => {
    if (!videosCache.has(id)) {
      const p = await notion.pages.retrieve({ page_id: id });
      const pr = p.properties || {};
      videosCache.set(id, { id, titulo: texto(pr['Título do vídeo']), link: pr['Link do vídeo']?.url || null });
    }
    return videosCache.get(id);
  };

  const artigos = [];
  for (const p of paginas) {
    const pr = p.properties || {};
    const status = pr['Status']?.status?.name || '';
    const slug = texto(pr['Slug']);
    if (!slug || !STATUS_ACEITOS.has(status)) continue;
    const md = n2m.toMarkdownString(await n2m.pageToMarkdown(p.id)).parent || '';
    const videos = [];
    for (const rel of pr['Vídeos do youtube']?.relation || []) videos.push(await video(rel.id));
    let capa = null;
    const arq = (pr['Capa']?.files || [])[0];
    if (arq) {
      const url = arq.type === 'external' ? arq.external.url : arq.file?.url;
      if (url) capa = '/artigos/capas/' + await baixar(url, path.join(raiz, 'artigos/capas', slug));
    }
    artigos.push({
      id: p.id, titulo: texto(pr['Título']), slug, tipo: pr['Tipo']?.select?.name || '', status,
      respostaCurta: texto(pr['Resposta curta']), capaAnimada: !!pr['Capa animada']?.checkbox, destaqueNaHome: !!pr['Destaque na home']?.checkbox,
      publicadoEm: pr['Publicado em']?.date?.start || null, capa, videos, corpo: md.trim() + '\n'
    });
  }
  artigos.sort((a, b) => a.slug.localeCompare(b.slug));
  return { fonte: 'notion: Artigos do site (collection://' + DATA_SOURCE_ARTIGOS + ')', artigos };
}
