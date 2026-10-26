/* conta da the relax club: login (Google, link por email, email e senha), mixes salvos e "seu cantinho"
   usa o Firebase (projeto the-relax-club). as chaves abaixo são públicas por natureza; quem protege os dados são as regras do Firestore. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyDwhk7BcD59scuOpUYbGBEmoWepLA-rR7E',
  authDomain: 'the-relax-club.firebaseapp.com',
  projectId: 'the-relax-club',
  storageBucket: 'the-relax-club.firebasestorage.app',
  messagingSenderId: '576015119043',
  appId: '1:576015119043:web:944c62322c2496a998e876'
});
const auth = getAuth(app); auth.languageCode = 'pt-BR';
const db = getFirestore(app);
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const AMB = { fis:'físico', men:'mental', emo:'emocional', soc:'social', sen:'sensorial', cri:'criativo', esp:'espiritual' };
const DIAS_REFAZER = 30;
let user = null, perfil = null, pendingSave = false;

/* ---------- janela de login ---------- */
const modal = document.createElement('div');
modal.className = 'conta-modal'; modal.hidden = true;
modal.innerHTML = `
<div class="cm-box" role="dialog" aria-modal="true" aria-labelledby="cm-t">
  <button class="cm-x" type="button" aria-label="fechar">×</button>
  <div class="cm-step" data-step="inicio">
    <h2 id="cm-t">entra no clube</h2>
    <p class="cm-sub">com uma conta você salva os seus mixes e guarda o resultado do teste. é de graça.</p>
    <button class="cm-btn cm-google" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.5 10.5 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>continuar com o google</button>
    <div class="cm-ou"><span>ou com o seu email</span></div>
    <input class="cm-in" id="cm-email" type="email" placeholder="seu email" autocomplete="email">
    <button class="cm-btn cm-dark" id="cm-link" type="button">me manda um link pra entrar</button>
    <button class="cm-txt" id="cm-ir-senha" type="button">prefiro entrar com senha</button>
    <label class="cm-opt"><input type="checkbox" id="cm-optin"> <span>quero receber os emails da the relax club (dá pra sair quando quiser)</span></label>
    <p class="cm-msg" id="cm-msg"></p>
  </div>
  <div class="cm-step" data-step="senha" hidden>
    <h2>entrar com senha</h2>
    <input class="cm-in" id="cm-nome" type="text" placeholder="seu nome (só pra criar conta)" autocomplete="given-name">
    <input class="cm-in" id="cm-email2" type="email" placeholder="seu email" autocomplete="email">
    <input class="cm-in" id="cm-senha" type="password" placeholder="senha (mínimo 6 caracteres)" autocomplete="current-password">
    <button class="cm-btn cm-dark" id="cm-entrar" type="button">entrar</button>
    <button class="cm-btn" id="cm-criar" type="button">criar conta</button>
    <button class="cm-txt" id="cm-esqueci" type="button">esqueci a senha</button>
    <button class="cm-txt" id="cm-voltar" type="button">voltar</button>
    <p class="cm-msg" id="cm-msg2"></p>
  </div>
  <div class="cm-step" data-step="enviado" hidden>
    <h2>olha o seu email</h2>
    <p class="cm-sub">mandei um link pra <b id="cm-mail-show"></b>. é só clicar nele, neste mesmo aparelho, que você entra. se não aparecer, dá uma olhada no spam.</p>
    <button class="cm-txt" id="cm-voltar2" type="button">voltar</button>
  </div>
  <div class="cm-step" data-step="salvar" hidden>
    <h2>salvar este mix</h2>
    <p class="cm-sub" id="cm-mix-desc"></p>
    <input class="cm-in" id="cm-mix-nome" type="text" maxlength="40" placeholder="dá um nome, tipo foco da tarde">
    <button class="cm-btn cm-dark" id="cm-mix-ok" type="button">salvar</button>
    <p class="cm-msg" id="cm-msg3"></p>
  </div>
</div>`;
document.body.appendChild(modal);
const step = s => { modal.querySelectorAll('.cm-step').forEach(e => e.hidden = e.dataset.step !== s); };
const abrir = (s = 'inicio') => { step(s); modal.hidden = false; document.body.classList.add('cm-on'); setTimeout(() => modal.querySelector(`[data-step="${s}"] input`)?.focus(), 50); };
const fechar = () => { modal.hidden = true; document.body.classList.remove('cm-on'); pendingSave = false; };
modal.querySelector('.cm-x').onclick = fechar;
modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) fechar(); });
const msg = (id, t) => { const el = $(id); if (el) el.textContent = t || ''; };
const erro = e => {
  const c = e && e.code || '';
  if (c.includes('invalid-email')) return 'esse email não parece certo.';
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'email ou senha não bateram.';
  if (c.includes('user-not-found')) return 'não achei conta com esse email. que tal criar uma?';
  if (c.includes('email-already-in-use')) return 'já existe conta com esse email. tenta entrar.';
  if (c.includes('weak-password')) return 'a senha precisa de pelo menos 6 caracteres.';
  if (c.includes('popup-closed')) return '';
  if (c.includes('too-many-requests')) return 'muitas tentativas. espera um pouquinho e tenta de novo.';
  return 'algo deu errado. tenta de novo?';
};
const optin = () => $('#cm-optin').checked;
$('#cm-optin').onchange = () => { try { localStorage.setItem('trc-optin', optin() ? '1' : '0'); } catch (e) {} };

modal.querySelector('.cm-google').onclick = async () => {
  msg('#cm-msg', '');
  try { localStorage.setItem('trc-optin', optin() ? '1' : '0'); } catch (e) {}
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { msg('#cm-msg', erro(e)); }
};
$('#cm-link').onclick = async () => {
  const email = $('#cm-email').value.trim(); msg('#cm-msg', '');
  if (!email.includes('@')) return msg('#cm-msg', 'escreve o seu email primeiro.');
  try {
    await sendSignInLinkToEmail(auth, email, { url: location.origin + '/?entrar=link', handleCodeInApp: true });
    localStorage.setItem('trc-login-email', email);
    localStorage.setItem('trc-optin', optin() ? '1' : '0');
    $('#cm-mail-show').textContent = email; step('enviado');
  } catch (e) { msg('#cm-msg', erro(e)); }
};
$('#cm-ir-senha').onclick = () => { $('#cm-email2').value = $('#cm-email').value; step('senha'); };
$('#cm-voltar').onclick = $('#cm-voltar2').onclick = () => step('inicio');
$('#cm-entrar').onclick = async () => {
  msg('#cm-msg2', '');
  try { await signInWithEmailAndPassword(auth, $('#cm-email2').value.trim(), $('#cm-senha').value); } catch (e) { msg('#cm-msg2', erro(e)); }
};
$('#cm-criar').onclick = async () => {
  msg('#cm-msg2', '');
  try { localStorage.setItem('trc-optin', optin() ? '1' : '0'); } catch (e) {}
  try {
    const c = await createUserWithEmailAndPassword(auth, $('#cm-email2').value.trim(), $('#cm-senha').value);
    const nome = $('#cm-nome').value.trim(); if (nome) await updateProfile(c.user, { displayName: nome });
  } catch (e) { msg('#cm-msg2', erro(e)); }
};
$('#cm-esqueci').onclick = async () => {
  const email = $('#cm-email2').value.trim();
  if (!email.includes('@')) return msg('#cm-msg2', 'escreve o seu email que eu mando o link pra criar outra senha.');
  try { await sendPasswordResetEmail(auth, email); msg('#cm-msg2', 'mandei um link pra criar outra senha.'); } catch (e) { msg('#cm-msg2', erro(e)); }
};

/* volta do link por email */
if (isSignInWithEmailLink(auth, location.href)) {
  let email = localStorage.getItem('trc-login-email') || prompt('confirma o seu email pra entrar:');
  if (email) signInWithEmailLink(auth, email, location.href).then(() => {
    localStorage.removeItem('trc-login-email'); history.replaceState(null, '', '/');
  }).catch(e => { toast(erro(e) || 'esse link já foi usado ou expirou.'); history.replaceState(null, '', '/'); });
}

/* ---------- botão do topo ---------- */
const acct = document.createElement('button');
acct.type = 'button'; acct.className = 'acct'; acct.textContent = 'entrar';
document.querySelector('header').appendChild(acct);
acct.onclick = () => user ? $('#cantinho')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : abrir();

/* ---------- seu cantinho ---------- */
const side = document.querySelector('.side');
const box = document.createElement('section');
box.id = 'cantinho'; box.className = 'cantinho'; box.hidden = true;
side.prepend(box);
const primeiro = n => (n || '').trim().split(/\s+/)[0] || '';
const dataBR = iso => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

async function render() {
  if (!user) { box.hidden = true; return; }
  const nome = primeiro(perfil?.nome || user.displayName) ;
  const mixes = await listarMixes();
  const t = perfil?.teste;
  let teste = '';
  if (t && t.principal) {
    const dias = Math.floor((Date.now() - new Date(t.data)) / 864e5);
    const v = t.bat?.[t.principal];
    teste = `<div class="ct-teste"><small>seu último teste · ${dataBR(t.data)}</small>
      <b>cansaço ${esc(AMB[t.principal] || t.principal)}${v != null ? ` · ${v}%` : ''}</b>
      ${dias >= DIAS_REFAZER ? `<p>já faz ${dias} dias. bora refazer e ver o que mudou?</p><a class="ct-btn" href="/teste/">refazer o teste</a>`
        : `<p>dá pra refazer em ${DIAS_REFAZER - dias} ${DIAS_REFAZER - dias === 1 ? 'dia' : 'dias'}, pra ver o que mudou.</p>`}</div>`;
  } else {
    teste = `<div class="ct-teste"><small>teste dos 7 tipos de descanso</small><b>você ainda não fez</b><p>3 minutos pra descobrir qual bateria tá mais baixa.</p><a class="ct-btn" href="/teste/">fazer o teste</a></div>`;
  }
  box.innerHTML = `<div class="ct-top"><h2>seu cantinho${nome ? `, ${esc(nome)}` : ''}</h2><button class="ct-sair" type="button">sair</button></div>
    <div class="ct-mixes"><small>seus mixes</small>${mixes.length ? mixes.map(m => `<div class="ct-mix" data-id="${m.id}"><button type="button" class="ct-play">${esc(m.nome)}</button><button type="button" class="ct-del" aria-label="apagar ${esc(m.nome)}">×</button></div>`).join('')
      : `<p class="ct-vazio">liga uns sons e toca em "salvar mix" lá embaixo.</p>`}</div>${teste}`;
  box.hidden = false;
  box.querySelector('.ct-sair').onclick = () => signOut(auth);
  box.querySelectorAll('.ct-mix').forEach(el => {
    const m = mixes.find(x => x.id === el.dataset.id);
    el.querySelector('.ct-play').onclick = () => tocarMix(m);
    el.querySelector('.ct-del').onclick = async () => { if (!confirm(`apagar o mix "${m.nome}"?`)) return; await deleteDoc(doc(db, 'users', user.uid, 'mixes', m.id)); render(); };
  });
}
function tocarMix(m) {
  if (!playing) setPlaying(true);
  SONS.forEach(s => setOn(s.id, m.sons[s.id] != null, m.sons[s.id]));
  clearMix(); toast(`tocando ${m.nome}`);
}
async function listarMixes() {
  try { const q = await getDocs(query(collection(db, 'users', user.uid, 'mixes'), orderBy('criado', 'desc'))); return q.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { return []; }
}

/* ---------- salvar mix ---------- */
const atual = () => Object.fromEntries(SONS.filter(s => st[s.id].on).map(s => [s.id, st[s.id].vol]));
$('#save').onclick = () => {
  const sons = atual();
  if (!Object.keys(sons).length) return toast('liga pelo menos um som pra salvar');
  if (!user) { pendingSave = true; abrir(); msg('#cm-msg', 'entra rapidinho que eu salvo o seu mix.'); return; }
  abrirSalvar();
};
const mesmoMix = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b || {}); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
function nomeSugerido() {
  if (mixBase) return mixBase.nome + ' do meu jeito';
  const n = SONS.filter(s => st[s.id].on).map(s => s.nome);
  if (n.length <= 1) return n[0] || 'meu mix';
  return n.length > 3 ? n.slice(0, 3).join(', ') + ' e mais' : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
}
async function gravar(nome) {
  await addDoc(collection(db, 'users', user.uid, 'mixes'), { nome, sons: atual(), criado: serverTimestamp() });
  toast(`"${nome}" salvo no seu cantinho`); render();
}
async function abrirSalvar() {
  const sons = atual();
  // já salvou esse mesmo mix? não duplica
  const ja = (await listarMixes()).find(m => mesmoMix(sons, m.sons));
  if (ja) { fechar(); toast(`esse mix já tá no seu cantinho como "${ja.nome}"`); return; }
  // mix pronto sem nenhuma mudança: salva direto com o nome dele
  if (mixBase && mesmoMix(sons, mixBase.s)) { fechar(); try { await gravar(mixBase.nome); } catch (e) { toast('não consegui salvar agora. tenta de novo?'); } return; }
  $('#cm-mix-desc').textContent = SONS.filter(s => st[s.id].on).map(s => s.nome).join(', ');
  const campo = $('#cm-mix-nome'); campo.value = nomeSugerido(); msg('#cm-msg3', ''); abrir('salvar');
  setTimeout(() => campo.select(), 60);
}
$('#cm-mix-ok').onclick = async () => {
  const nome = $('#cm-mix-nome').value.trim() || 'meu mix';
  try { await gravar(nome); fechar(); }
  catch (e) { msg('#cm-msg3', 'não consegui salvar agora. tenta de novo?'); }
};
$('#cm-mix-nome').addEventListener('keydown', e => { if (e.key === 'Enter') $('#cm-mix-ok').click(); });

/* ---------- quando entra ou sai ---------- */
onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { perfil = null; acct.textContent = 'entrar'; acct.classList.remove('in'); render(); return; }
  acct.textContent = primeiro(u.displayName) || 'seu cantinho'; acct.classList.add('in');
  const ref = doc(db, 'users', u.uid);
  try {
    const snap = await getDoc(ref);
    perfil = snap.exists() ? snap.data() : null;
    const novo = !perfil;
    const upd = {};
    if (novo) Object.assign(upd, { nome: u.displayName || '', email: u.email || '', criado: serverTimestamp(), optin: localStorage.getItem('trc-optin') === '1' });
    // resultado do teste feito neste navegador
    try { const t = JSON.parse(localStorage.getItem('trc-teste') || 'null'); if (t && (!perfil?.teste || new Date(t.data) > new Date(perfil.teste.data))) upd.teste = t; } catch (e) {}
    if (Object.keys(upd).length) { await setDoc(ref, upd, { merge: true }); perfil = { ...(perfil || {}), ...upd }; }
    if (novo) {
      fetch('/api/clube/', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: await u.getIdToken(), nome: u.displayName || '', optin: upd.optin }) }).catch(() => {});
    }
  } catch (e) { console.warn('perfil', e); }
  if (!modal.hidden && pendingSave) { pendingSave = false; abrirSalvar(); }
  else if (!modal.hidden) { fechar(); toast(`que bom te ver${primeiro(u.displayName) ? ', ' + primeiro(u.displayName) : ''}`); }
  render();
});


/* ---------- compartilhar mix + contador de quantas vezes aquela combinação foi compartilhada ---------- */
const shareBtn = $('#share');
const MOSTRAR_A_PARTIR = 3; // abaixo disso o número não aparece, pra não ficar "1" solitário
const chaveMix = () => SONS.filter(s => st[s.id].on).map(s => s.id).sort().join('+');
let tCont;
async function contagem() {
  const k = chaveMix(), b = shareBtn.querySelector('b');
  if (!k) { b.textContent = ''; shareBtn.title = ''; return; }
  try {
    const d = await getDoc(doc(db, 'compartilhados', k));
    const n = d.exists() ? d.data().n : 0;
    if (chaveMix() !== k) return;
    b.textContent = n >= MOSTRAR_A_PARTIR ? String(n) : '';
    shareBtn.title = n ? `essa combinação já foi compartilhada ${n} ${n > 1 ? 'vezes' : 'vez'}` : '';
  } catch (e) {}
}
const _onChange = window.onChange;
window.onChange = function () { _onChange && _onChange(); clearTimeout(tCont); tCont = setTimeout(contagem, 500); };
shareBtn.onclick = async () => {
  const k = chaveMix();
  if (!k) { toast('liga pelo menos um som pra compartilhar'); return; }
  const url = linkDoMix();
  let ok = false;
  if (navigator.share && matchMedia('(pointer:coarse)').matches) {
    try { await navigator.share({ title: 'um mix da the relax club', text: 'liga esse som e para um pouquinho', url }); ok = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!ok) { try { await navigator.clipboard.writeText(url); ok = true; toast('link copiado. é só mandar pra alguém'); } catch (e) {} }
  if (!ok) { window.prompt('copia o link do seu mix:', url); ok = true; }
  try { await setDoc(doc(db, 'compartilhados', k), { n: increment(1) }, { merge: true }); } catch (e) {}
  contagem();
};
contagem();
