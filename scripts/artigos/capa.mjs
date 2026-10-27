/* capa gerada de cada artigo: svg determinístico pelo slug, no desenho do grupo
   (anéis pros cansaços, ondas pros barulhos, arcos pras pausas, pontos pro como usar).
   mesmo algoritmo da referência aprovada (artigos/_design/capas-dos-artigos.html). */

export function rnd(seed) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

const n = x => +x.toFixed(2); // só encurta os números; o desenho é o mesmo

const FUNDOS = { cansaco: ['#293729', '#3C4D3E'], barulho: ['#DED3BB', '#E9E1CC'], pausa: ['#C9D0BC', '#DCE0D2'], usar: ['#F7F3EA', '#ECE5D4'] };

/* devolve o miolo do svg (viewBox 0 0 200 200) */
export function capaMiolo(slug, g, anim) {
  const R = rnd(slug);
  const [b1, b2] = FUNDOS[g] || FUNDOS.usar; const escuro = g === 'cansaco'; const tr = escuro ? 'rgba(241,235,220,' : 'rgba(41,55,41,';
  const bg = `<rect width="200" height="200" fill="${b1}"/><circle cx="${n(40 + R() * 120)}" cy="${n(40 + R() * 120)}" r="${n(60 + R() * 50)}" fill="${b2}"/>`;
  let el = '';
  if (g === 'cansaco') { const cx = n(60 + R() * 80), cy = n(60 + R() * 80); for (let i = 0; i < 6; i++) { el += `<ellipse cx="${cx}" cy="${cy}" rx="${20 + i * 14}" ry="${12 + i * 9}" transform="rotate(${n(R() * 180)} ${cx} ${cy})" fill="none" stroke="${tr}${n(.35 + i * .08)})" stroke-width="1.3"/>`; } }
  if (g === 'barulho') { for (let i = 0; i < 5; i++) { const y = 50 + i * 24, a = 6 + R() * 14, f = .03 + R() * .04, ph = R() * 6; let d = ''; for (let x = -30; x <= 230; x += 5) { d += (x === -30 ? 'M' : 'L') + x + ' ' + (y + Math.sin(x * f + ph) * a).toFixed(1); } el += `<path d="${d}" fill="none" stroke="${tr}${n(.3 + i * .12)})" stroke-width="1.4"/>`; } }
  if (g === 'pausa') { const cx = 100, cy = n(130 + R() * 30); for (let i = 0; i < 5; i++) { el += `<path d="M${cx - 30 - i * 18} ${cy} A${30 + i * 18} ${30 + i * 18} 0 0 1 ${cx + 30 + i * 18} ${cy}" fill="none" stroke="${tr}${n(.3 + i * .12)})" stroke-width="1.4"/>`; } el += `<circle cx="${cx}" cy="${cy}" r="10" fill="${tr}.7)"/>`; }
  if (g === 'usar') { for (let x = 30; x <= 170; x += 20) for (let y = 30; y <= 170; y += 20) { if (R() < .55) el += `<circle cx="${x}" cy="${y}" r="${n(2 + R() * 4)}" fill="${tr}${n(.25 + R() * .5)})"/>`; } }
  return bg + (anim ? `<g class="an an-${g}">${el}</g>` : el);
}

export function capaSvg(slug, g, anim) {
  return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${capaMiolo(slug, g, anim)}</svg>`;
}
