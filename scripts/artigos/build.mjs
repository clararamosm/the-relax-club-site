/* build dos artigos do therelax.club
   gera html estático (renderizado aqui, sem depender de js pra ler) em:
     /artigos/            índice
     /artigos/<slug>/     cada artigo (+ og.png de compartilhamento)
     /sobre/  e  /news/   mesmas páginas de artigo, fora da pasta /artigos/
   e atualiza: card "artigos" da sede (index.html), links "ler sobre" do resultado do teste, sitemap.xml e llms.txt.

   uso:
     node scripts/artigos/build.mjs            publica só o que está com status "Publicado"
     node scripts/artigos/build.mjs --previa   inclui também o que está em "Revisão" (pra ver numa prévia da vercel)
   de onde vêm os artigos:
     com NOTION_TOKEN no ambiente, busca da base "Artigos do site" no notion e atualiza conteudo/artigos.json;
     sem token, usa o snapshot conteudo/artigos.json que está no repositório. */
import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { capaSvg } from './capa.mjs';
import { ogPng } from './og.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.resolve(AQUI, '../..');
const ARGS = process.argv.slice(2);
const PREVIA = ARGS.some(a => ['--previa', '--prévia', '--preview'].includes(a));
const SEM_OG = ARGS.includes('--sem-og');
const SITE = 'https://therelax.club';
const DATA_PADRAO = '2026-10-27';
const SNAPSHOT = path.join(RAIZ, 'conteudo/artigos.json');
const SUBSTACK = 'https://therelaxclub.substack.com';

/* ---------------- organização da página /artigos/ ---------------- */
const GRUPOS = [
  { id: 'cansaco', nome: 'cansaço e descanso', curto: 'cansaço e descanso', rel: 'outras perguntas sobre cansaço', d: 'os 7 tipos de cansaço e o que ajuda em cada um.',
    teste: 'descobre qual dos 7 tipos de descanso tá mais descarregado em você agora.',
    s: ['tipos-de-cansaco', 'cansaco-mental', 'cansaco-sensorial', 'cansaco-emocional', 'cansaco-fisico', 'cansaco-social', 'descanso-criativo', 'descanso-espiritual', 'acordo-cansada', 'cansaco-ou-burnout'] },
  { id: 'barulho', nome: 'barulhos e sons', curto: 'barulhos e sons', rel: 'outras perguntas sobre barulho', d: 'qual barulho usar pra dormir, focar ou relaxar, e por quê.',
    teste: 'talvez o cansaço não seja de barulho. descobre qual descanso tá faltando.',
    s: ['barulho-de-chuva', 'barulho-de-ventilador', 'barulho-para-dormir', 'barulho-para-estudar', 'barulho-de-mar', 'ruido-branco-rosa-marrom', 'sons-da-natureza', 'sons-do-interior', 'sons-de-casa', 'sons-para-meditar', 'sons-para-acalmar'] },
  { id: 'pausa', nome: 'pausas e rotina', curto: 'pausas e rotina', rel: 'outras perguntas sobre pausas e rotina', d: 'pausas curtas e o momento antes de dormir.',
    teste: 'uma pausa ajuda, mas qual descanso tá faltando? descobre em 3 minutos.',
    s: ['pausa-de-5-minutos', 'ritual-da-noite', 'timer-para-dormir'] },
  { id: 'usar', nome: 'como usar e indicações', curto: 'como usar', rel: 'outras perguntas sobre o clube', d: 'o mixer, o app no celular e outras indicações brasileiras.',
    teste: 'um teste rápido pra entender quais dos 7 tipos de descanso tão descarregados em você agora.',
    s: ['site-gratis-misturar-sons', 'instalar-no-celular', 'alternativa-ao-noisli', 'apps-de-meditacao-brasileiros', 'newsletters-brasileiras-descanso', 'sobre', 'news'] },
];
const COMECE = ['tipos-de-cansaco', 'barulho-de-chuva', 'cansaco-mental'];
const ORDEM_SEDE = ['barulho', 'cansaco', 'pausa', 'usar']; // ordem do card da sede
const GRUPO_POR_TIPO = { 'pilar': 'cansaco', 'tipo de descanso': 'cansaco', 'intenção sonora': 'barulho', 'pausa e rotina': 'pausa', 'usar o clube': 'usar' };
const FORA_DE_ARTIGOS = { sobre: '/sobre/', news: '/news/' }; // mesmo template, outro endereço
const TESTE_LER = { fis: 'cansaco-fisico', men: 'cansaco-mental', emo: 'cansaco-emocional', soc: 'cansaco-social', sen: 'cansaco-sensorial', cri: 'descanso-criativo', esp: 'descanso-espiritual' };

/* ---------------- utilitários ---------------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const jsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');
const ler = p => fs.readFileSync(path.join(RAIZ, p), 'utf8');
let escritos = 0;
function escrever(rel, conteudo) {
  const p = path.join(RAIZ, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
  const novo = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo);
  if (fs.existsSync(p) && fs.readFileSync(p).equals(novo)) return;
  fs.writeFileSync(p, novo); escritos++;
}
const slugify = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dataBR = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const semTravessao = s => s.replace(/\s*[—–]\s*/g, ', ');
const semLinks = s => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
function trocarEntre(texto, ini, fim, novo, arquivo) {
  const a = texto.indexOf(ini), b = texto.indexOf(fim);
  if (a < 0 || b < a) throw new Error(`marcadores ${ini} ... ${fim} não encontrados em ${arquivo}`);
  return texto.slice(0, a + ini.length) + novo + texto.slice(b);
}

/* ---------------- 1. dados ---------------- */
let dados;
if (process.env.NOTION_TOKEN) {
  const { lerDoNotion } = await import('./notion.mjs');
  dados = await lerDoNotion({ token: process.env.NOTION_TOKEN, raiz: RAIZ });
  escrever('conteudo/artigos.json', JSON.stringify(dados, null, 2) + '\n');
  console.log(`notion: ${dados.artigos.length} artigos lidos (Revisão + Publicado)`);
} else {
  dados = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  console.log(`snapshot: ${dados.artigos.length} artigos em conteudo/artigos.json (sem NOTION_TOKEN)`);
}

const grupoDe = a => (GRUPOS.find(g => g.s.includes(a.slug)) || GRUPOS.find(g => g.id === GRUPO_POR_TIPO[a.tipo]) || GRUPOS[3]).id;
const G = id => GRUPOS.find(g => g.id === id);
const TODOS = dados.artigos.filter(a => a.slug && a.titulo);
const VIS = TODOS.filter(a => a.status === 'Publicado' || (PREVIA && a.status === 'Revisão'));
const POR_SLUG = new Map(VIS.map(a => [a.slug, a]));
VIS.forEach(a => { a.grupo = grupoDe(a); a.data = (a.publicadoEm || DATA_PADRAO).slice(0, 10); a.respostaMd = a.respostaCurta || ''; a.respostaCurta = semTravessao(semLinks(a.respostaMd)); });
// ordem dentro do grupo: a da lista acima; artigos novos (fora da lista) entram no fim
const ordemNoGrupo = a => { const i = G(a.grupo).s.indexOf(a.slug); return i < 0 ? 999 : i; };
const doGrupo = id => VIS.filter(a => a.grupo === id).sort((x, y) => ordemNoGrupo(x) - ordemNoGrupo(y) || x.slug.localeCompare(y.slug));
const urlDe = slug => FORA_DE_ARTIGOS[slug] || `/artigos/${slug}/`;
const dirDe = slug => urlDe(slug).slice(1);
const videoDe = a => (a.videos || []).find(v => v.link && ytId(v.link));

/* ---------------- 2. mixer: mixes prontos e arquivos de áudio (lidos do index.html, a fonte é a sede) ---------------- */
const SEDE = ler('index.html');
const pegaConst = nome => { const m = SEDE.match(new RegExp('const ' + nome + '\\s*=\\s*([\\[{][\\s\\S]*?\\n[\\]}]);')); if (!m) throw new Error('não achei ' + nome + ' no index.html'); return Function('return ' + m[1])(); };
const MIXES = pegaConst('MIXES'), ARQ = pegaConst('ARQ'), SONS = pegaConst('SONS');
const SONS_IDS = new Set(SONS.map(s => s.id));
function resolverMix(p) {
  const m = MIXES.find(x => slugify(x.nome) === p);
  const lista = m ? Object.entries(m.s) : p.split(',').map(x => x.split('-')).filter(([id]) => SONS_IDS.has(id)).map(([id, v]) => [id, Math.max(5, Math.min(100, +v || 50))]);
  return { nome: m ? m.nome : null, lista };
}

/* ---------------- 3. markdown ---------------- */
function ytId(u) {
  try { const x = new URL(u); if (x.hostname.includes('youtu.be')) return x.pathname.slice(1).split('/')[0] || null;
    if (x.hostname.includes('youtube')) return x.searchParams.get('v') || (x.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/) || [])[1] || null; } catch (e) {}
  return null;
}
function resolverLink(href) {
  let u; try { u = new URL(href, SITE + '/'); } catch (e) { return { href }; }
  const interno = /^(www\.)?therelax\.club$/.test(u.hostname);
  if (!interno) return { href, externo: true };
  const p = u.pathname;
  const m = p.match(/^\/artigos\/([^/]+)\/?$/) || p.match(/^\/(sobre|news)\/?$/);
  if (m) { const slug = m[1]; return POR_SLUG.has(slug) ? { href: urlDe(slug) + u.hash } : { texto: true }; }
  if (/^\/perguntas\/?$/.test(p)) return POR_SLUG.has('sobre') ? { href: '/sobre/' } : { texto: true };
  return { href: p + u.search + u.hash };
}
const md = new Marked({ gfm: true, renderer: {
  link(tok) {
    const txt = this.parser.parseInline(tok.tokens); const r = resolverLink(tok.href);
    if (r.texto) return txt;
    return `<a href="${esc(r.href)}"${r.externo ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
  },
  heading(tok) { const t = this.parser.parseInline(tok.tokens); const n = Math.min(Math.max(tok.depth, 2), 3); return `<h${n} id="${slugify(tok.text)}">${t}</h${n}>\n`; },
} });

const normal = s => s.toLowerCase().replace(/[^a-z0-9à-ú]+/g, ' ').trim();
function limparCorpo(texto, resposta) {
  let s = texto.replace(/\r/g, '').trim();
  s = s.replace(/^#\s+[^\n]*\n/, '');                                       // título, se vier no corpo
  s = s.replace(/^\s*por clara ramos\b[^\n]*$/im, '');                       // assinatura (vira a linha "por clara ramos" da página)
  s = s.replace(/^\s*\\?\[\s*vídeo do youtube:[^\n]*?\\?\]\s*$/gim, '');      // marcador do vídeo (o vídeo vem da base de vídeos)
  s = s.trim();
  // a resposta curta vem destacada no topo, então sai do corpo
  const antes = s.split(/\n(?=##\s)/)[0];
  const paras = antes.split(/\n\s*\n/);
  if (resposta && paras.length && normal(paras[0]).slice(0, 80) === normal(resposta).slice(0, 80)) s = s.slice(s.indexOf(paras[0]) + paras[0].length).trim();
  return semTravessao(s) + '\n';
}
function mixDoArtigo(texto) {
  const sec = texto.split(/\n(?=##\s)/).find(x => /^##\s*por onde come[çc]ar/i.test(x.trim()));
  if (!sec) return null;
  const m = sec.match(/\[([^\]]+)\]\(([^)\s]*[?&]mix=[^)\s]+)\)/);
  if (!m) return null;
  let p; try { p = new URL(m[2], SITE + '/').searchParams.get('mix'); } catch (e) { return null; }
  if (!p) return null;
  const r = resolverMix(p); if (!r.lista.length) return null;
  const nome = m[1].replace(/[*_`]/g, '').trim();
  return { param: p, nome: r.nome && !/mix/.test(nome) ? 'mix ' + r.nome : nome, lista: r.lista };
}
/* meta description: até ~155 caracteres, cortando no fim de uma frase (ou, se não der, no fim de uma palavra) */
function cortar(s, max = 155) {
  s = s.trim(); if (s.length <= max) return s;
  const ate = s.slice(0, max + 1);
  const frase = Math.max(ate.lastIndexOf('. '), ate.lastIndexOf('? '), ate.lastIndexOf('! '));
  if (frase >= 80) return s.slice(0, frase + 1);
  const corte = ate.slice(0, ate.lastIndexOf(' ')).replace(/[\s,;:.]+$/, '');
  return corte + '…';
}
const tituloPagina = t => (t + ' · the relax club').length > 70 ? t : t + ' · the relax club';
const palavras = s => (s.replace(/<[^>]+>/g, ' ').match(/[\wÀ-ú]+/g) || []).length;

/* ---------------- 4. componentes ---------------- */
const capaDe = a => a.capa ? `<img src="${esc(a.capa)}" alt="" loading="lazy">` : capaSvg(a.slug, a.grupo, !!a.capaAnimada);
const adesivo = a => videoDe(a) ? '<span class="stk">com vídeo</span>' : '';
const itemLista = a => `<li><a href="${urlDe(a.slug)}"><span class="th" aria-hidden="true">${capaDe(a)}</span><span class="lt">${esc(a.titulo)}</span><span class="ls">${esc(a.respostaCurta)}</span>${videoDe(a) ? `<span class="lv">${adesivo(a)}</span>` : ''}</a></li>`;
const cardTeste = texto => `<a class="card main" href="/teste/"><small>teste gratuito · 3 minutos</small><b>que tipo de cansaço é o seu?</b><span>${esc(texto)}</span></a>`;
const cardNews = () => `<a class="card" href="${SUBSTACK}" target="_blank" rel="noopener"><small>toda segunda e quinta</small><b>the relax news</b><span>histórias e o que a ciência diz sobre descansar de verdade.</span></a>`;
// contador de quem tá ouvindo: ainda não existe presença no site, então o número fica escondido
const cardSede = () => `<a class="card sede-card" href="/"><small>a sede tá aberta</small><b>volta pra sede</b><span>liga um barulho e fica um pouco com quem tá parando agora também.</span><div class="live" hidden><i aria-hidden="true"></i><em data-ouvindo></em> pessoas ouvindo agora</div><span class="btn">entrar na sede</span></a>`;
function blocoVideo(a) {
  const v = videoDe(a); if (!v) return '';
  const id = ytId(v.link);
  return `<div class="video" data-video="${esc(id)}" data-titulo="${esc(v.titulo)}"><img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><button class="vi" type="button" aria-label="tocar o vídeo ${esc(v.titulo)}"><span class="vrow"><span class="pl" aria-hidden="true"></span><span class="vt"><small>vídeo do youtube · the relax club</small>${esc(v.titulo)}</span></span></button></div>`;
}
function blocoToca(mix) {
  if (!mix) return '';
  const sons = mix.lista.filter(([id]) => ARQ[id]).map(([id, v]) => { const [u, g, m, a, b] = ARQ[id]; return m === 'evento' ? { u, g, m, a, b, v } : { u, g, v }; });
  const link = `/?mix=${mix.param}`;
  if (!sons.length) return `<div class="toca so-link"><div class="tt"><b>${esc(mix.nome)}</b><span>esse mix toca no mixer da sede · <a href="${esc(link)}">abre no mixer</a></span></div></div>`;
  return `<div class="toca" data-mix="${esc(mix.param)}" data-sons="${esc(JSON.stringify(sons))}"><button class="pb" type="button" aria-pressed="false" aria-label="tocar ${esc(mix.nome)}"></button><div class="tt"><b>${esc(mix.nome)}</b><span><span class="tm">toca aqui mesmo, com timer de 30 min</span> · ou <a href="${esc(link)}">abre no mixer</a></span></div><div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>`;
}
function rodape() {
  return `<footer class="fim"><div class="wrap"><nav class="flinks" aria-label="links do site"><a href="/artigos/">artigos</a>${POR_SLUG.has('sobre') ? '<a href="/sobre/">sobre</a>' : ''}<a href="/teste/">que tipo de cansaço é o seu?</a><a href="${SUBSTACK}" target="_blank" rel="noopener">the relax news</a><a href="/privacidade/">privacidade</a></nav><div class="social"><a href="https://www.instagram.com/therelax.club/" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>instagram</a><a href="https://www.pinterest.com/therelaxclubbr/" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2.01.03-2.87.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.15-1.88 3.15-4.58 0-2.39-1.72-4.07-4.18-4.07-2.85 0-4.52 2.14-4.52 4.34 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.31-.24.99-.28 1.13-.04.18-.15.22-.34.13-1.25-.58-2.03-2.41-2.03-3.88 0-3.16 2.29-6.06 6.62-6.06 3.47 0 6.17 2.48 6.17 5.79 0 3.45-2.18 6.23-5.2 6.23-1.02 0-1.97-.53-2.3-1.15l-.62 2.38c-.23.87-.84 1.96-1.25 2.62.94.29 1.93.45 2.97.45 5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>pinterest</a><a href="https://www.tiktok.com/@therelax.club" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>tiktok</a><a href="https://www.youtube.com/@therelax-club" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>youtube</a></div><i>e mais nada.</i><span>the relax club</span></div></footer>`;
}
function pagina({ titulo, desc, url, img, tipo = 'article', ld, robots, body = '', conteudo }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-LKVLJKH0GV"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());try{var tq=location.search;if(/[?&]interno=1/.test(tq))localStorage.setItem('trc-interno','1');if(/[?&]interno=0/.test(tq))localStorage.removeItem('trc-interno');if(localStorage.getItem('trc-interno'))gtag('set',{traffic_type:'internal'})}catch(e){}gtag('config','G-LKVLJKH0GV',{allow_google_signals:false,allow_ad_personalization_signals:false});</script>
<script>document.documentElement.classList.add('js')</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(cortar(desc))}">
<meta name="robots" content="${robots || 'index,follow'}">
<link rel="canonical" href="${SITE}${url}">
<meta property="og:type" content="${tipo}">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:site_name" content="the relax club">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(cortar(desc))}">
<meta property="og:image" content="${SITE}${img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F1EBDC">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icone-180.png">
<meta name="apple-mobile-web-app-title" content="the relax club">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/artigos.css">
<script type="application/ld+json">${jsonLd(ld)}</script>
</head>
<body${body}>
<div class="wrap">
<header class="site"><a href="/" aria-label="the relax club, voltar pra sede"><img src="/logo.svg" alt="the relax club" width="62" height="52"></a></header>
${conteudo}
</div>
${rodape()}
<script src="/js/artigos.js" defer></script>
<script src="/js/instalar.js" defer></script>
<script>window.va = window.va || function(){ (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
<script>if("serviceWorker" in navigator) addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));</script>
</body>
</html>
`;
}
const AUTORA = { '@type': 'Person', name: 'Clara Ramos', url: SITE + '/sobre/' };
const EDITORA = { '@type': 'Organization', name: 'The Relax Club', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/email/logo.png' } };
const migalha = itens => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: itens.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + u })) });

/* ---------------- 5. páginas dos artigos ---------------- */
const LOGO = ler('logo.svg');
const avisos = [];
for (const a of VIS) {
  const g = G(a.grupo), url = urlDe(a.slug), dir = dirDe(a.slug);
  const fora = !!FORA_DE_ARTIGOS[a.slug];
  const corpoMd = limparCorpo(a.corpo || '', a.respostaMd);
  let html = md.parse(corpoMd).replace(/<table>/g, '<div class="tabela"><table>').replace(/<\/table>/g, '</table></div>');
  const mix = mixDoArtigo(corpoMd);
  const toca = blocoToca(mix);
  if (toca) {
    const h2 = [...html.matchAll(/<h2[\s>]/g)].map(m => m.index);
    const pc = [...html.matchAll(/<h2[^>]*>por onde come[çc]ar/gi)].map(m => m.index)[0];
    const at = h2.length >= 3 ? h2[1] : (pc ?? h2[1] ?? html.length);
    html = html.slice(0, at) + toca + '\n' + html.slice(at);
  }
  const min = Math.max(1, Math.round((palavras(a.respostaCurta) + palavras(corpoMd)) / 200));
  const resposta = semTravessao(a.respostaCurta);
  const outros = doGrupo(a.grupo).filter(x => x.slug !== a.slug);
  const i0 = G(a.grupo).s.indexOf(a.slug);
  const rel = (i0 >= 0 ? [...outros.filter(x => ordemNoGrupo(x) > i0), ...outros.filter(x => ordemNoGrupo(x) < i0)] : outros).slice(0, 3);
  const nomeCrumb = a.slug === 'sobre' ? 'sobre' : a.slug === 'news' ? 'the relax news' : g.nome;
  const crumb = fora ? `<p class="crumb"><a href="/">sede</a> / ${esc(nomeCrumb)}</p>` : `<p class="crumb"><a href="/">sede</a> / <a href="/artigos/">artigos</a> / ${esc(g.nome)}</p>`;
  const v = videoDe(a), vid = v && ytId(v.link);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: a.titulo, description: resposta, url: SITE + url, mainEntityOfPage: { '@type': 'WebPage', '@id': SITE + url },
      image: SITE + '/' + dir + 'og.png', inLanguage: 'pt-BR', datePublished: a.data, dateModified: a.data, author: AUTORA, publisher: EDITORA },
    migalha(fora ? [['sede', '/'], [nomeCrumb, url]] : [['sede', '/'], ['artigos', '/artigos/'], [a.titulo, url]]),
  ];
  if (vid) ld.push({ '@context': 'https://schema.org', '@type': 'VideoObject', name: v.titulo, description: resposta, thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
    uploadDate: a.data, embedUrl: `https://www.youtube-nocookie.com/embed/${vid}`, contentUrl: `https://www.youtube.com/watch?v=${vid}`, inLanguage: 'pt-BR' });
  const conteudo = `${crumb}
<div class="art">
<article class="art-main">
<p class="eyebrow">${esc(nomeCrumb)}</p>
<h1>${esc(a.titulo)}</h1>
<p class="by"><span class="av" aria-hidden="true">c</span><span>por ${POR_SLUG.has('sobre') && a.slug !== 'sobre' ? '<a href="/sobre/">clara ramos</a>' : 'clara ramos'}</span><span aria-hidden="true">·</span><span>atualizado em <time datetime="${a.data}">${dataBR(a.data)}</time></span><span aria-hidden="true">·</span><span>${min} min de leitura</span></p>
<div class="resp"><small>resposta curta</small>${md.parseInline(semTravessao(a.respostaMd))}</div>
${blocoVideo(a)}
<div class="corpo">
${html}</div>
${rel.length ? `<div class="rel"><h3>${esc(g.rel)}</h3><ul class="lista">${rel.map(itemLista).join('')}</ul></div>` : ''}
</article>
<aside class="art-side" aria-label="mais da the relax club">
${cardTeste(g.teste)}
${cardNews()}
</aside>
</div>`;
  escrever(dir + 'index.html', pagina({ titulo: tituloPagina(a.titulo), desc: resposta, url, img: '/' + dir + 'og.png', ld,
    robots: a.status === 'Publicado' ? 'index,follow' : 'noindex,follow', body: ` data-artigo="${esc(a.slug)}" data-grupo="${a.grupo}"`, conteudo }));
  if (!SEM_OG) {
    let capaImagem = null;
    if (a.capa) { const p = path.join(RAIZ, a.capa.replace(/^\//, '')); if (fs.existsSync(p)) { const ext = path.extname(p).slice(1).replace('jpg', 'jpeg'); capaImagem = `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,` + fs.readFileSync(p).toString('base64'); } }
    escrever(dir + 'og.png', ogPng({ titulo: a.titulo, slug: a.slug, grupo: a.grupo, logoSvg: LOGO, capaImagem }));
  }
  if (/[—–]/.test(a.titulo + a.respostaCurta + a.corpo)) avisos.push(`${a.slug}: tinha travessão (trocado por vírgula no corpo e na resposta; confira o título)`);
}

/* ---------------- 6. índice /artigos/ ---------------- */
{
  const grupos = GRUPOS.map(g => ({ g, itens: doGrupo(g.id) })).filter(x => x.itens.length);
  const feat = COMECE.map(s => POR_SLUG.get(s)).filter(Boolean);
  const NOMEG = Object.fromEntries(GRUPOS.map(g => [g.id, g.curto]));
  const desc = 'respostas curtas pras perguntas sobre cansaço, descanso e barulho pra dormir, escritas por clara ramos, com fonte em cada dado.';
  const conteudo = `<p class="crumb"><a href="/">sede</a> / artigos</p>
<div class="idx-head">
<h1>artigos</h1>
<p>respostas curtas pras perguntas sobre cansaço, descanso e barulho pra dormir. cada uma responde uma coisa só, escrita por clara ramos, com fonte em cada dado.</p>
</div>
${feat.length ? `<h2 class="mh">comece por aqui</h2>
<div class="feat">${feat.map(a => `<a href="${urlDe(a.slug)}"><span class="th" aria-hidden="true">${capaDe(a)}${adesivo(a)}</span><span class="ft"><small>${esc(NOMEG[a.grupo])}</small><b>${esc(a.titulo)}</b></span></a>`).join('')}</div>` : ''}
${grupos.length > 1 ? `<div class="filtros" role="group" aria-label="filtrar por assunto"><button class="chip on" type="button" data-f="todos" aria-pressed="true">todos</button>${grupos.map(({ g }) => `<button class="chip" type="button" data-f="${g.id}" aria-pressed="false">${esc(g.nome)}</button>`).join('')}</div>` : ''}
<div class="idx">
<div>${grupos.length ? grupos.map(({ g, itens }) => `<section class="grupo" data-g="${g.id}" aria-labelledby="g-${g.id}"><h2 id="g-${g.id}">${esc(g.nome)}</h2><p class="gd">${esc(g.d)}</p><ul class="lista">${itens.map(itemLista).join('')}</ul></section>`).join('\n') : '<p class="vazio">os primeiros artigos chegam em breve. enquanto isso, a sede tá aberta.</p>'}</div>
<aside class="idx-side" aria-label="mais da the relax club">
${cardTeste('descobre qual dos 7 tipos de descanso tá faltando e qual artigo ler primeiro.')}
${cardSede()}
</aside>
</div>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'artigos da the relax club', description: desc, url: SITE + '/artigos/', inLanguage: 'pt-BR', author: AUTORA, publisher: EDITORA,
      mainEntity: { '@type': 'ItemList', itemListElement: grupos.flatMap(x => x.itens).map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + urlDe(a.slug), name: a.titulo })) } },
    migalha([['sede', '/'], ['artigos', '/artigos/']]),
  ];
  escrever('artigos/index.html', pagina({ titulo: 'artigos sobre cansaço, descanso e barulho pra dormir · the relax club', desc, url: '/artigos/', img: '/og.png', tipo: 'website', ld, body: ' data-pagina="artigos"', conteudo }));
}

/* ---------------- 7. limpeza: some o que não está mais visível ---------------- */
for (const d of fs.readdirSync(path.join(RAIZ, 'artigos'), { withFileTypes: true })) {
  if (d.isDirectory() && d.name !== 'capas' && !POR_SLUG.has(d.name)) { fs.rmSync(path.join(RAIZ, 'artigos', d.name), { recursive: true, force: true }); console.log('removido: /artigos/' + d.name + '/'); }
  if (d.isDirectory() && FORA_DE_ARTIGOS[d.name]) { fs.rmSync(path.join(RAIZ, 'artigos', d.name), { recursive: true, force: true }); }
}
for (const s of Object.keys(FORA_DE_ARTIGOS)) if (!POR_SLUG.has(s) && fs.existsSync(path.join(RAIZ, s))) { fs.rmSync(path.join(RAIZ, s), { recursive: true, force: true }); console.log('removido: /' + s + '/'); }

/* ---------------- 8. card "artigos" da sede ---------------- */
{
  const dest = ORDEM_SEDE.flatMap(id => doGrupo(id)).filter(a => a.destaqueNaHome).slice(0, 4);
  const card = VIS.length ? `
      <div class="card guias"><small>artigos</small><b>perguntas que chegam por aqui</b>${dest.length ? `<ul>${dest.map(a => `<li><a href="${urlDe(a.slug)}"><span class="mini">${capaSvg(a.slug, a.grupo, false)}</span><span class="tx">${esc(a.titulo)}</span> <i aria-hidden="true">→</i></a></li>`).join('')}</ul>` : ''}<a class="mais" href="/artigos/">ver todos os artigos</a></div>
      ` : '\n      ';
  escrever('index.html', trocarEntre(SEDE, '<!-- artigos:inicio (gerado por scripts/artigos/build.mjs) -->', '<!-- artigos:fim -->', card, 'index.html'));
}

/* ---------------- 9. resultado do teste: link "ler sobre" de cada tipo ---------------- */
{
  const ler_ = Object.fromEntries(Object.entries(TESTE_LER).filter(([, s]) => POR_SLUG.has(s)).map(([k, s]) => [k, urlDe(s)]));
  const t = ler('teste/index.html');
  escrever('teste/index.html', trocarEntre(t, '/* artigos:inicio (gerado por scripts/artigos/build.mjs) */', '/* artigos:fim */', `\nconst LER_SOBRE = ${JSON.stringify(ler_)};\n`, 'teste/index.html'));
}

/* ---------------- 10. sitemap.xml e llms.txt ---------------- */
{
  const doSitemap = PREVIA ? VIS : VIS.filter(a => a.status === 'Publicado');
  const ultima = doSitemap.map(a => a.data).sort().pop() || DATA_PADRAO;
  const urls = doSitemap.length ? [`  <url><loc>${SITE}/artigos/</loc><lastmod>${ultima}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...doSitemap.map(a => `  <url><loc>${SITE}${urlDe(a.slug)}</loc><lastmod>${a.data}</lastmod><changefreq>monthly</changefreq><priority>${FORA_DE_ARTIGOS[a.slug] ? '0.6' : '0.7'}</priority></url>`)] : [];
  escrever('sitemap.xml', trocarEntre(ler('sitemap.xml'), '<!-- artigos:inicio -->', '<!-- artigos:fim -->', '\n' + urls.map(u => u + '\n').join('') + '  ', 'sitemap.xml'));

  const sobre = POR_SLUG.get('sobre'), news = POR_SLUG.get('news');
  const links = [
    VIS.length ? `- [artigos](${SITE}/artigos/): respostas curtas sobre cansaço, os 7 tipos de descanso, barulho pra dormir e pra focar, pausas e como usar o mixer, escritas por clara ramos.` : '',
    sobre ? `- [o que é a the relax club](${SITE}/sobre/): quem faz, o que tem no site e de onde vêm os sons.` : '',
    news ? `- [o que é a the relax news](${SITE}/news/): a newsletter do clube, o que sai em cada edição e como assinar.` : '',
  ].filter(Boolean);
  const lista = GRUPOS.map(g => ({ g, itens: doGrupo(g.id).filter(a => !FORA_DE_ARTIGOS[a.slug]) })).filter(x => x.itens.length);
  const secao = lista.length ? `\n## artigos\n\n${lista.map(({ g, itens }) => `### ${g.nome}\n\n${itens.map(a => `- [${a.titulo}](${SITE}${urlDe(a.slug)}): ${a.respostaCurta.split(/(?<=[.?!])\s/)[0]}`).join('\n')}\n`).join('\n')}\n` : '\n';
  let llms = ler('llms.txt');
  llms = trocarEntre(llms, '<!-- artigos-links:inicio -->', '<!-- artigos-links:fim -->', '\n' + links.map(l => l + '\n').join(''), 'llms.txt');
  llms = trocarEntre(llms, '<!-- artigos-lista:inicio -->', '<!-- artigos-lista:fim -->', secao, 'llms.txt');
  escrever('llms.txt', llms);
}

/* ---------------- resumo ---------------- */
const publicados = TODOS.filter(a => a.status === 'Publicado').length;
console.log(`${PREVIA ? 'prévia' : 'normal'}: ${VIS.length} artigos no site (${publicados} publicados no notion), ${escritos} arquivos alterados.`);
if (!PREVIA && !POR_SLUG.has('sobre')) console.warn('atenção: "sobre" não está publicado, então /sobre/ não existe (o rodapé e o redirect de /perguntas apontam pra lá).');
avisos.forEach(x => console.warn('aviso: ' + x));
