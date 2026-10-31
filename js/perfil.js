/* página de perfil do membro: carteirinha, dados, foto, mixes, histórico de testes, emails, instalar como app (android, iphone, computador) e excluir conta */
import { auth, db, $, esc, AMB, DIAS_REFAZER, FUNDADORES_ATE, primeiro, abrir, fechar, msg, quandoMudar, atualizarPerfil, fotoDe, sair, sincronizarBrevo } from '/js/clube.js';
import * as clube from '/js/clube.js';
import { updateProfile, verifyBeforeUpdateEmail, deleteUser } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, collection, getDocs, deleteDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const NOMES = { chuva:'chuva', trovao:'trovoada', praia:'praia', corrego:'córrego', cachoeira:'cachoeira', vento:'vento', bemtevi:'passarinhos', cigarra:'cigarra', grilo:'grilos', sapos:'sapos', ventilador:'ventilador', fogao:'lareira', gato:'gato ronronando', vitrola:'vitrola', cafe:'cafeteria', sininhos:'sininhos', sino:'sino', tigela:'tigela', cantando:'tigela cantando', gongo:'gongo', batuque:'batuque', paudechuva:'pau de chuva', kalimba:'kalimba', flauta:'flauta' };
const ORDEM = ['fis', 'men', 'emo', 'soc', 'sen', 'cri', 'esp'];
const PETALAS = [[60,36,0],[78.8,45,51.43],[83.4,65.3,102.86],[70.4,81.6,154.29],[49.6,81.6,205.71],[36.6,65.3,257.14],[41.2,45,308.57]];
const app = $('#app');
const mesAno = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
const dataCurta = iso => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
const fotoCart = f => !f ? '' : f.startsWith('data:') ? f : '/api/foto/?u=' + encodeURIComponent(f);
const linkMix = sons => location.origin + '/?mix=' + Object.entries(sons).map(([k, v]) => `${k}-${v}`).join(',');
let mixes = [], testes = [], instalar = null;

/* ---------- app: três caixas (android, iphone, computador) ----------
   o botão de instalar só existe no aparelho em que a pessoa está (o navegador entrega um pedido por aparelho),
   então a caixa do aparelho dela ganha o botão e as outras explicam o caminho. no iphone não tem botão: são os passos. */
const UA = navigator.userAgent || '';
const IOS = /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const ANDROID = /Android/i.test(UA);
const CELULAR = IOS || ANDROID || /Mobi/i.test(UA);
const MAC_SAFARI = !CELULAR && /Macintosh/.test(UA) && /Safari/.test(UA) && !/Chrome|Chromium|Edg\/|OPR\/|Firefox/.test(UA) && +((UA.match(/Version\/(\d+)/) || [])[1] || 0) >= 17;
const APARELHO = IOS ? 'iphone' : ANDROID ? 'android' : CELULAR ? 'outro' : 'computador';
const COMO_APP = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } })();
const gaApp = (nome, dados) => { try { if (window.gtag) window.gtag('event', nome, dados || {}); } catch (e) {} };

const ICO_COMPARTILHAR = '<svg class="ico" viewBox="0 0 24 24" role="img" aria-label="ícone de compartilhar"><path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16M12 15V3M8.5 6.5 12 3l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICO_PONTINHOS = '<svg class="ico" viewBox="0 0 24 24" role="img" aria-label="ícone de três pontinhos"><circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/></svg>';
function caixasApp() {
  const aqui = d => APARELHO === d;
  const selo = d => aqui(d) ? `<span class="selo">${COMO_APP ? 'você já tá no app' : 'este aparelho'}</span>` : '';
  // android e computador sempre têm o botão; ele só abre a instalação no aparelho certo. fora dele, explica o caminho
  const botao = d => `<button class="btn dark" type="button" data-instalar="${d}">instalar</button><p class="dica" hidden></p>`;
  const android = '<p>um toque e o ícone vai pra tela inicial do celular.</p>';
  const iphone = `<ol class="passos">
      <li>toca em compartilhar ${ICO_COMPARTILHAR}. se não achar, ele pode estar dentro dos três pontinhos ${ICO_PONTINHOS}.</li>
      <li>escolhe "adicionar à tela de início".</li>
      <li>confirma em "adicionar". o ícone aparece junto dos seus apps.</li></ol>`;
  const computador = '<p>um clique e a sede abre numa janela própria, sem abas, no mac ou no windows.</p>';
  return [['android', 'android', android, true], ['iphone', 'iphone e ipad', iphone, false], ['computador', 'computador', computador, true]]
    .map(([d, nome, corpo, temBotao]) => `<div class="app-box${aqui(d) ? ' aqui' : ''}"><div class="app-top"><b>${nome}</b>${selo(d)}</div>${corpo}${temBotao ? botao(d) : ''}</div>`).join('');
}
// o que dizer quando o botão não consegue abrir a instalação
function dicaApp(d) {
  if (APARELHO !== d) return d === 'android'
    ? 'esse botão instala no celular android. abre therelax.club/perfil nele e toca em instalar.'
    : 'esse botão instala no computador. abre therelax.club/perfil nele (mac ou windows) e clica em instalar.';
  if (COMO_APP) return 'você já tá usando o app neste aparelho.';
  if (d === 'android') return 'o seu navegador não abriu a instalação. toca nos três pontinhos dele e escolhe "instalar app" ou "adicionar à tela inicial". se já instalou, o ícone tá na tela inicial.';
  if (MAC_SAFARI) return 'no safari, vai no menu arquivo e clica em "adicionar ao dock".';
  return 'esse navegador não instala direto. abre therelax.club no chrome ou no edge e clica em instalar, no fim da barra de endereço. se já instalou, a sede tá nos seus apps.';
}
function ligarCaixasApp() {
  const el = $('#apps'); if (!el) return;
  el.innerHTML = caixasApp();
  el.querySelectorAll('[data-instalar]').forEach(b => b.onclick = async () => {
    const d = b.dataset.instalar, pd = instalar;
    gaApp('mensagem_clicou', { id: 'instalar_perfil', plataforma: d, aqui: APARELHO === d ? 'sim' : 'nao' });
    if (APARELHO === d && pd && !COMO_APP) {
      try { await pd.prompt(); await pd.userChoice; } catch (e) {}
      instalar = null; ligarCaixasApp(); return;
    }
    const dica = b.nextElementSibling; dica.textContent = dicaApp(d); dica.hidden = false;
  });
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalar = e; ligarCaixasApp(); });
addEventListener('appinstalled', () => { instalar = null; ligarCaixasApp(); });

/* ---------- carteirinha ---------- */
function carteirinha(u, p) {
  const nome = p?.nome || u.displayName || primeiro(u.email?.split('@')[0]);
  const f = fotoDe(u, p);
  const n = p?.membro;
  const amb = p?.teste?.principal;
  const flor = `<svg class="flor" viewBox="0 0 120 120" aria-hidden="true">${PETALAS.map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y}" rx="9.5" ry="27" transform="rotate(${r} ${x} ${y})" fill="${ORDEM[i] === amb ? 'rgba(241,235,220,.3)' : 'none'}" stroke="${ORDEM[i] === amb ? '#F1EBDC' : 'rgba(241,235,220,.6)'}" stroke-width="1"/>`).join('')}</svg>`;
  const linhas = `<svg class="lines" viewBox="0 0 440 278" preserveAspectRatio="none" aria-hidden="true">${[40, 80, 120, 160, 200, 240].map((y, i) => `<path d="M0 ${y} C 110 ${y - 14 + i * 2}, 220 ${y + 16}, 330 ${y - 6} S 440 ${y + 8}, 440 ${y}" fill="none" stroke="#F1EBDC" stroke-width="1"/>`).join('')}</svg>`;
  return `<div class="cart">${linhas}<span class="brilho" aria-hidden="true"></span>
    <div class="cart-top"><img src="/logo-claro.svg" alt="the relax club"><small>carteirinha<br>de membro</small></div>
    <div class="cart-mid"><div class="cart-foto">${f ? `<img src="${esc(fotoCart(f))}" alt="" onerror="this.replaceWith(document.createTextNode('${esc((nome || '?')[0])}'))">` : esc((nome || '?')[0].toUpperCase())}</div>
      <div><div class="cart-nome">${esc(nome)}</div>${n && n <= FUNDADORES_ATE ? '<span class="cart-fund">membro fundador</span>' : ''}</div></div>
    ${flor}
    <div class="cart-bot"><div>membro nº<b>${n ? n : '...'}</b></div><div style="text-align:right">${amb ? `descanso que mais pede atenção<b>${esc(AMB[amb])}</b>` : `membro desde<b>${esc(mesAno(p?.membroDesde) || mesAno(new Date().toISOString()))}</b>`}</div></div>
  </div>`;
}

/* ---------- página ---------- */
async function carregarListas(u) {
  try { mixes = (await getDocs(query(collection(db, 'users', u.uid, 'mixes'), orderBy('criado', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { mixes = []; }
  try { testes = (await getDocs(query(collection(db, 'users', u.uid, 'testes'), orderBy('data', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { testes = []; }
}

function telaFora() {
  app.innerHTML = `<h1>seu perfil</h1><div class="fora"><p>entra no clube pra ver a sua carteirinha de membro, os seus mixes e o histórico do teste.</p><button class="btn dark" id="entrar" type="button">entrar no clube</button></div>`;
  $('#entrar').onclick = () => abrir('inicio', 'perfil');
}

function desenhar(u, p) {
  const senha = u.providerData.some(x => x.providerId === 'password');
  const nome = p?.nome || u.displayName || '';
  const f = fotoDe(u, p);
  const ult = testes[0] || p?.teste;
  const dias = ult ? Math.floor((Date.now() - new Date(ult.data)) / 864e5) : null;
  app.innerHTML = `
  <h1>oi, ${esc(primeiro(nome) || 'membro')}</h1>
  <p class="lead">essa é a sua ficha no clube.</p>

  <div class="cart-wrap">
    <div class="palco">${carteirinha(u, p)}</div>
    <div class="cart-acoes" style="margin-top:6px"><button class="btn dark" id="baixar" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/></svg>baixar pra postar</button></div>
    <p class="cart-dica">${p?.teste ? 'a pétala acesa é o tipo de descanso que mais pediu atenção no seu último teste.' : 'faça o teste e a sua carteirinha ganha o tipo de descanso que mais pede atenção em você.'}</p>
  </div>

  <div class="cols">
  <div class="col-a">
  <section class="sec"><h2>seus dados</h2>
    <div class="campo"><label for="f-nome">nome</label><div class="linha"><input class="in" id="f-nome" maxlength="60" value="${esc(nome)}"><button class="btn" id="s-nome" type="button">salvar</button></div><p class="ok" id="m-nome"></p></div>
    <div class="campo"><label for="f-email">email</label>
      ${senha ? `<div class="linha"><input class="in" id="f-email" type="email" value="${esc(u.email || '')}"><button class="btn" id="s-email" type="button">trocar</button></div><p class="nota">pra trocar, eu mando um link de confirmação pro email novo.</p>`
        : `<input class="in" id="f-email" value="${esc(u.email || '')}" readonly><p class="nota">você entrou com o google, então o email é o da sua conta google.</p>`}
      <p class="ok" id="m-email"></p></div>
    <div class="campo"><label>foto</label><div class="foto-linha"><div class="foto-prev">${f ? `<img src="${esc(fotoCart(f))}" alt="" onerror="this.replaceWith(document.createTextNode('${esc((nome || '?')[0])}'))">` : esc((nome || '?')[0].toUpperCase())}</div>
      <label class="btn" for="f-foto" style="cursor:pointer">escolher foto</label><input id="f-foto" type="file" accept="image/*" hidden>
      ${p?.foto ? '<button class="mini" id="r-foto" type="button">tirar foto</button>' : ''}</div><p class="ok" id="m-foto"></p></div>
  </section>

  <section class="sec"><h2>seus mixes</h2>
    ${mixes.length ? `<div class="lista">${mixes.map(m => `<div class="item" data-id="${m.id}"><div class="t"><b>${esc(m.nome)}</b><span>${esc(Object.keys(m.sons || {}).map(k => NOMES[k] || k).join(', '))}</span></div>
      <a class="mini play" href="${esc(linkMix(m.sons || {}))}">tocar</a><button class="mini" data-acao="link" type="button">link</button><button class="mini" data-acao="nome" type="button">renomear</button><button class="mini" data-acao="apagar" type="button" aria-label="apagar">apagar</button></div>`).join('')}</div>`
      : `<p class="vazio">ainda nenhum. na sede, liga uns sons e toca em salvar.</p>`}
  </section>

  <section class="sec"><h2>a the relax club como app</h2>
    <p class="sub">no celular ou no computador: a sede ganha ícone e abre direto, sem a barra do navegador.</p>
    <div class="apps" id="apps"></div>
  </section>

  <section class="sec"><h2>conta</h2>
    <div class="linha"><button class="btn" id="sair" type="button">sair</button><button class="mini perigo" id="excluir" type="button">excluir minha conta</button></div>
    <p class="ok" id="m-conta"></p>
  </section>
  </div>
  <aside class="col-b">
  <section class="sec"><h2>seus testes</h2>
    ${ult ? `<p class="sub">${dias >= DIAS_REFAZER ? `o último foi há ${dias} dias. bora ver o que mudou?` : `dá pra refazer em ${DIAS_REFAZER - dias} ${DIAS_REFAZER - dias === 1 ? 'dia' : 'dias'}.`}</p>` : ''}
    ${testes.length ? `<div class="lista">${testes.map(t => `<div class="item"><div class="t"><b>cansaço ${esc(AMB[t.principal] || t.principal)}${t.bat?.[t.principal] != null ? ` · ${t.bat[t.principal]}%` : ''}</b><span>${esc(dataCurta(t.data))}${t.segundo ? ` · depois vem o ${esc(AMB[t.segundo] || t.segundo)}` : ''}</span></div></div>`).join('')}</div>`
      : `<p class="vazio">você ainda não fez o teste com a conta aberta.</p>`}
    <p style="margin-top:12px"><a class="btn ${!ult || dias >= DIAS_REFAZER ? 'dark' : ''}" href="/teste/">${ult ? 'refazer o teste' : 'fazer o teste'}</a></p>
  </section>

  <section class="sec"><h2>emails do clube</h2>
    <p class="sub">novidades do clube, lembrete de refazer o teste e conteúdos sobre o seu tipo de descanso. a the relax news é assinada à parte, no <a href="https://therelaxclub.substack.com" target="_blank" rel="noopener">substack</a>.</p>
    <label class="switch"><input type="checkbox" id="f-optin" ${p?.optin ? 'checked' : ''}> <span>quero receber os emails do clube</span></label>
    <p class="ok" id="m-optin"></p>
  </section>
  </aside>
  </div>`;
  ligar(u, p);
  cartao3d();
}

/* carteirinha 3d: inclina seguindo o mouse; no celular, vai virando conforme a rolagem */
let rolagem3d = null;
function cartao3d() {
  const c = document.querySelector('.palco .cart'); if (!c) return;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduz) return;
  const aplica = (rx, ry) => {
    c.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    c.style.setProperty('--bx', `${50 + ry * 2.4}%`); c.style.setProperty('--by', `${50 - rx * 2.4}%`);
  };
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const palco = c.parentElement;
    palco.onmousemove = e => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.classList.add('vivo'); aplica(-y * 16, x * 20); };
    palco.onmouseleave = () => { c.classList.remove('vivo'); aplica(0, 0); };
  } else {
    if (rolagem3d) removeEventListener('scroll', rolagem3d);
    let pedido = false;
    rolagem3d = () => { if (pedido) return; pedido = true; requestAnimationFrame(() => { pedido = false;
      const r = c.getBoundingClientRect(), meio = (r.top + r.height / 2) / innerHeight - .5; // -0.5 (topo) a 0.5 (embaixo)
      aplica(Math.max(-1, Math.min(1, meio * 2)) * 14, Math.max(-1, Math.min(1, meio * 2)) * -22); }); };
    addEventListener('scroll', rolagem3d, { passive: true }); rolagem3d();
  }
}

function ligar(u, p) {
  $('#s-nome').onclick = async () => {
    const v = $('#f-nome').value.trim(); if (!v) return msg('#m-nome', 'escreve um nome.');
    try { await updateProfile(auth.currentUser, { displayName: v }); await setDoc(doc(db, 'users', u.uid), { nome: v }, { merge: true }); atualizarPerfil({ nome: v }); toast('nome salvo'); sincronizarBrevo(); }
    catch (e) { msg('#m-nome', 'não consegui salvar agora.'); }
  };
  $('#f-nome').onkeydown = e => { if (e.key === 'Enter') $('#s-nome').click(); };
  if ($('#s-email')) $('#s-email').onclick = async () => {
    const v = $('#f-email').value.trim();
    if (!v.includes('@') || v === u.email) return msg('#m-email', 'escreve o email novo.');
    try { await verifyBeforeUpdateEmail(auth.currentUser, v); msg('#m-email', `mandei um link pra ${v}. a troca vale quando você clicar nele.`); }
    catch (e) { msg('#m-email', (e.code || '').includes('recent-login') ? 'por segurança, sai e entra de novo antes de trocar o email.' : 'não consegui trocar agora. confere o email?'); }
  };
  $('#f-foto').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    msg('#m-foto', 'ajustando a foto…');
    try {
      const foto = await reduzir(file);
      await setDoc(doc(db, 'users', u.uid), { foto }, { merge: true }); atualizarPerfil({ foto }); toast('foto nova salva');
    } catch (err) { msg('#m-foto', 'não consegui usar essa imagem. tenta outra?'); }
  };
  if ($('#r-foto')) $('#r-foto').onclick = async () => { await setDoc(doc(db, 'users', u.uid), { foto: '' }, { merge: true }); atualizarPerfil({ foto: '' }); };
  document.querySelectorAll('.item[data-id]').forEach(el => {
    const m = mixes.find(x => x.id === el.dataset.id);
    el.querySelector('[data-acao="link"]').onclick = async () => { try { await navigator.clipboard.writeText(linkMix(m.sons)); toast('link copiado'); } catch (e) { prompt('copia o link:', linkMix(m.sons)); } };
    el.querySelector('[data-acao="nome"]').onclick = async () => {
      const v = (prompt('novo nome do mix:', m.nome) || '').trim().slice(0, 40); if (!v || v === m.nome) return;
      await setDoc(doc(db, 'users', u.uid, 'mixes', m.id), { nome: v }, { merge: true }).catch(() => {});
      m.nome = v; el.querySelector('b').textContent = v; toast('mix renomeado');
    };
    el.querySelector('[data-acao="apagar"]').onclick = async () => {
      if (!confirm(`apagar o mix "${m.nome}"?`)) return;
      await deleteDoc(doc(db, 'users', u.uid, 'mixes', m.id)); mixes = mixes.filter(x => x !== m); el.remove();
    };
  });
  $('#f-optin').onchange = async e => {
    const optin = e.target.checked;
    try {
      await setDoc(doc(db, 'users', u.uid), { optin }, { merge: true }); atualizarPerfil({ optin });
      await sincronizarBrevo(optin ? 'sync' : 'sair');
      toast(optin ? 'pronto, você vai receber os emails' : 'pronto, não mando mais emails');
    } catch (err) { msg('#m-optin', 'não consegui salvar agora.'); }
  };
  ligarCaixasApp();
  $('#sair').onclick = () => sair();
  $('#excluir').onclick = () => excluir(u);
  $('#baixar').onclick = () => baixar(u, p);
}

/* foto: corta no centro e reduz pra um quadrado leve (fica guardada no próprio perfil) */
function reduzir(file) {
  return new Promise((ok, falha) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const lado = Math.min(img.width, img.height), T = 320, c = document.createElement('canvas'); c.width = c.height = T;
      c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, T, T);
      URL.revokeObjectURL(url);
      let q = .85, d = c.toDataURL('image/jpeg', q);
      while (d.length > 150000 && q > .4) { q -= .1; d = c.toDataURL('image/jpeg', q); }
      ok(d);
    };
    img.onerror = falha; img.src = url;
  });
}

/* baixar a carteirinha no formato de story (1080x1920): fotografa a carteirinha da tela e monta o story num canvas */
async function baixar(u, p) {
  const b = $('#baixar'); b.disabled = true; const txt = b.innerHTML; b.textContent = 'preparando…';
  try {
    if (!window.html2canvas) await new Promise((ok, falha) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
    await document.fonts.ready;
    const el = document.querySelector('.cart-wrap .cart');
    const tr = el.style.transform; el.style.transform = 'none'; el.classList.add('parado');
    const k = 880 / el.offsetWidth;
    const card = await window.html2canvas(el, { scale: k, useCORS: true, backgroundColor: null, ignoreElements: n => n.classList && n.classList.contains('flor') });
    // a flor é desenhada à mão (o html2canvas não lida bem com ela)
    const fl = el.querySelector('.flor'), fr = fl.getBoundingClientRect(), cr = el.getBoundingClientRect(), gc = card.getContext('2d');
    const k2 = card.width / cr.width;
    gc.setTransform(1, 0, 0, 1, 0, 0);
    const fx = (fr.left - cr.left) * k2, fy = (fr.top - cr.top) * k2, fs = fr.width * k2 / 120, amb = p?.teste?.principal;
    PETALAS.forEach(([x, y, r], i) => { gc.save(); gc.translate(fx + x * fs, fy + y * fs); gc.rotate(r * Math.PI / 180); gc.beginPath(); gc.ellipse(0, 0, 9.5 * fs, 27 * fs, 0, 0, Math.PI * 2);
      if (ORDEM[i] === amb) { gc.fillStyle = 'rgba(241,235,220,.3)'; gc.fill(); gc.strokeStyle = '#F1EBDC'; } else gc.strokeStyle = 'rgba(241,235,220,.6)';
      gc.lineWidth = 1.2 * k2; gc.stroke(); gc.restore(); });
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#F1EBDC'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(41,55,41,.10)'; g.lineWidth = 2;
    for (let y = 120; y < H; y += 120) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(300, y - 30, 700, y + 34, W, y - 6); g.stroke(); }
    const serif = getComputedStyle(document.documentElement).getPropertyValue('--serif');
    g.fillStyle = '#293729'; g.textAlign = 'center';
    g.font = `300 104px ${serif}`; g.fillText('eu faço parte da', W / 2, 470); g.fillText('the relax club', W / 2, 580);
    const ch = card.height * 880 / card.width, cy = (H - ch) / 2 + 60;
    g.save(); g.shadowColor = 'rgba(41,55,41,.25)'; g.shadowBlur = 60; g.shadowOffsetY = 24;
    g.drawImage(card, 100, cy, 880, ch); g.restore();
    g.fillStyle = '#3C4D3E'; g.font = `400 40px ${getComputedStyle(document.body).fontFamily}`; g.fillText('therelax.club', W / 2, cy + ch + 150);
    el.style.transform = tr; el.classList.remove('parado');
    const a = document.createElement('a'); a.download = `carteirinha-the-relax-club${p?.membro ? '-' + p.membro : ''}.png`; a.href = c.toDataURL('image/png'); a.click();
  } catch (e) { console.error(e); toast('não consegui gerar a imagem agora. tira um print da carteirinha?'); }
  b.disabled = false; b.innerHTML = txt;
}

/* excluir conta: apaga mixes, testes e perfil, tira dos emails e apaga o login */
async function excluir(u) {
  if (!confirm('excluir a sua conta apaga a carteirinha, os mixes e o histórico do teste. não dá pra desfazer. quer mesmo?')) return;
  const ultimo = new Date(u.metadata.lastSignInTime).getTime();
  if (Date.now() - ultimo > 4 * 60 * 1000) {
    sessionStorage.setItem('trc-excluir', '1');
    msg('#m-conta', 'por segurança, entra de novo pra confirmar.');
    await sair(); abrir(); return;
  }
  try {
    msg('#m-conta', 'apagando…');
    await sincronizarBrevo('excluir');
    for (const sub of ['mixes', 'testes']) {
      const q = await getDocs(collection(db, 'users', u.uid, sub)); for (const d of q.docs) await deleteDoc(d.ref);
    }
    await deleteDoc(doc(db, 'users', u.uid));
    await deleteUser(auth.currentUser);
    sessionStorage.removeItem('trc-excluir'); excluida = true;
    app.innerHTML = '<h1>conta excluída</h1><p class="lead">tudo apagado. a sede continua aberta quando você quiser voltar.</p><p style="text-align:center"><a class="btn dark" href="/">voltar pra sede</a></p>';
  } catch (e) { msg('#m-conta', (e.code || '').includes('recent-login') ? 'por segurança, sai, entra de novo e tenta excluir outra vez.' : 'não consegui excluir agora. tenta de novo?'); }
}

/* ---------- quando entra ou sai ---------- */
let ultimaChave = '', excluida = false;
quandoMudar(async (u, p) => {
  if (excluida) return;
  if (!u) { ultimaChave = ''; telaFora(); return; }
  if (!document.querySelector('.conta-modal').hidden) fechar();
  if (!p) { app.innerHTML = '<p class="fora">carregando…</p>'; return; }
  const chave = JSON.stringify([u.uid, p.nome, p.foto, p.membro, p.optin, p.teste?.data]);
  if (chave === ultimaChave) return; ultimaChave = chave;
  await carregarListas(u);
  desenhar(u, p);
  if (sessionStorage.getItem('trc-excluir') === '1') { sessionStorage.removeItem('trc-excluir'); setTimeout(() => excluir(clube.user), 300); }
});
setTimeout(() => { if (!clube.user && $('#carregando')) telaFora(); }, 2500);
