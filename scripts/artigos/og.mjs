/* imagem de compartilhamento (1200x630) de cada artigo: título, logo e a capa do artigo do lado */
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { capaMiolo } from './capa.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const FONTES = [path.join(AQUI, 'fontes/InstrumentSerif-Regular.ttf'), path.join(AQUI, 'fontes/Inter-Medium.ttf')];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* quebra o título em linhas de largura parecida (sem palavra sozinha na última linha) */
function quebrar(texto, tamanho, largura) {
  const w = s => s.length * tamanho * .37; // largura aproximada da instrument serif em caixa baixa
  const palavras = texto.split(/\s+/);
  const total = w(texto);
  let n = Math.max(1, Math.ceil(total / largura));
  for (; n <= 6; n++) {
    const alvo = total / n; const linhas = []; let atual = '';
    for (const p of palavras) {
      const t = atual ? atual + ' ' + p : p;
      if (atual && w(t) > alvo * 1.12 && linhas.length < n - 1) { linhas.push(atual); atual = p; } else atual = t;
    }
    linhas.push(atual);
    if (linhas.every(l => w(l) <= largura) && (linhas.length === 1 || linhas[linhas.length - 1].includes(' '))) return linhas;
  }
  return [texto];
}

export function ogPng({ titulo, slug, grupo, logoSvg, capaImagem }) {
  const t = titulo.toLowerCase();
  const tam = t.length > 90 ? 50 : t.length > 60 ? 58 : 66;
  const linhas = quebrar(t, tam, 560);
  const alturaLinha = tam * 1.06;
  const topo = Math.max(196 + tam * .5, 350 - (linhas.length * alturaLinha) / 2 + tam * .78);
  const logo = 'data:image/svg+xml;base64,' + Buffer.from(logoSvg).toString('base64');
  const capa = capaImagem
    ? `<image href="${capaImagem}" x="650" y="40" width="510" height="550" preserveAspectRatio="xMidYMid slice"/>`
    : `<svg x="650" y="40" width="510" height="550" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">${capaMiolo(slug, grupo, false)}</svg>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#F1EBDC"/>
<defs><clipPath id="c"><rect x="650" y="40" width="510" height="550" rx="34"/></clipPath></defs>
<g clip-path="url(#c)">${capa}</g>
<image href="${logo}" x="64" y="50" width="112" height="94"/>
<text font-family="Instrument Serif" font-size="${tam}" fill="#293729">${linhas.map((l, i) => `<tspan x="64" y="${(topo + i * alturaLinha).toFixed(1)}">${esc(l)}</tspan>`).join('')}</text>
<text x="64" y="574" font-family="Inter" font-size="22" font-weight="500" fill="#5d6b5d">therelax.club · artigos · por clara ramos</text>
</svg>`;
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { fontFiles: FONTES, loadSystemFonts: false, defaultFontFamily: 'Inter' } });
  return r.render().asPng();
}

export const lerArquivo = p => fs.readFileSync(p, 'utf8');
