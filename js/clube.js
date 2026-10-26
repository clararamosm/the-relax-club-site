/* núcleo do clube: firebase, janela de login, avatar com menu, perfil do membro e número da carteirinha.
   usado na home (sede), no /perfil/ e no /teste/. as chaves abaixo são públicas por natureza; quem protege os dados são as regras do Firestore. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const app = initializeApp({
  apiKey: 'AIzaSyDwhk7BcD59scuOpUYbGBEmoWepLA-rR7E',
  authDomain: 'the-relax-club.firebaseapp.com',
  projectId: 'the-relax-club',
  storageBucket: 'the-relax-club.firebasestorage.app',
  messagingSenderId: '576015119043',
  appId: '1:576015119043:web:944c62322c2496a998e876'
});
export const auth = getAuth(app); auth.languageCode = 'pt-BR';
export const db = getFirestore(app);
export const $ = s => document.querySelector(s);
export const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const AMB = { fis:'físico', men:'mental', emo:'emocional', soc:'social', sen:'sensorial', cri:'criativo', esp:'espiritual' };
export const DIAS_REFAZER = 30;
export const PRIMEIRO_NUMERO = 100, FUNDADORES_ATE = 199;
export const primeiro = n => (n || '').trim().split(/\s+/)[0] || '';
export const dataBR = iso => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const avisar = m => (window.toast ? window.toast(m) : console.log(m));
const toast = avisar;

/* ---------- janela de login ---------- */
const modal = document.createElement('div');
modal.className = 'conta-modal'; modal.hidden = true;
modal.innerHTML = `
<div class="cm-box" role="dialog" aria-modal="true" aria-labelledby="cm-t">
  <button class="cm-x" type="button" aria-label="fechar">×</button>
  <div class="cm-step" data-step="inicio">
    <h2 id="cm-t">entra no clube</h2>
    <p class="cm-sub">membros salvam os seus mixes, guardam o histórico do teste e ganham a carteirinha do clube. é de graça.</p>
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
const fechar = () => { modal.hidden = true; document.body.classList.remove('cm-on'); aoFechar.forEach(f => f()); };
const aoFechar = [];
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


export { abrir, fechar, aoFechar, msg, erro };

/* ---------- avatar com menu (perfil e sair) ---------- */
const IC_AV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>';
export function fotoDe(u, p) { return (p && p.foto) || (u && u.photoURL) || ''; }
export function criarAvatar(onde, { abreParaBaixo = false } = {}) {
  const w = document.createElement('div'); w.className = 'av-wrap';
  w.innerHTML = `<button class="av" type="button" aria-label="entrar no clube" aria-haspopup="menu">${IC_AV}</button>
    <div class="av-menu${abreParaBaixo ? ' down' : ''}" role="menu" hidden><small></small><a href="/perfil/" role="menuitem">perfil e carteirinha</a><button type="button" role="menuitem" data-sair>sair</button></div>`;
  onde.appendChild(w);
  const b = w.querySelector('.av'), menu = w.querySelector('.av-menu');
  b.onclick = e => { e.stopPropagation(); if (!user) return abrir(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', e => { if (!w.contains(e.target)) menu.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
  menu.querySelector('[data-sair]').onclick = () => { menu.hidden = true; sair(); };
  const pinta = () => {
    if (!user) { b.className = 'av'; b.innerHTML = IC_AV; b.setAttribute('aria-label', 'entrar no clube'); return; }
    const f = fotoDe(user, perfil), nome = perfil?.nome || user.displayName || '';
    b.className = 'av in'; b.setAttribute('aria-label', 'abrir menu da conta');
    b.innerHTML = f ? `<img src="${esc(f)}" alt="" referrerpolicy="no-referrer">` : esc((nome || user.email || '?').trim()[0].toUpperCase());
    menu.querySelector('small').textContent = perfil?.membro ? `membro nº ${perfil.membro}` : (user.email || '');
  };
  quandoMudar(pinta); pinta();
  return w;
}
export const sair = () => signOut(auth);

/* ---------- quem está logado ---------- */
export let user = null, perfil = null;
const ouvintes = [];
export function quandoMudar(f) { ouvintes.push(f); }
const avisa = () => ouvintes.forEach(f => { try { f(user, perfil); } catch (e) { console.error(e); } });
export function atualizarPerfil(campos) { perfil = { ...(perfil || {}), ...campos }; avisa(); }

const idTeste = t => String(t.data).replace(/[^0-9a-z]/gi, '-');
async function sincronizarTeste() {
  if (!user) return;
  let t; try { t = JSON.parse(localStorage.getItem('trc-teste') || 'null'); } catch (e) {}
  if (!t || !t.data) return;
  try {
    await setDoc(doc(db, 'users', user.uid, 'testes', idTeste(t)), t);
    if (!perfil?.teste || new Date(t.data) > new Date(perfil.teste.data)) { await setDoc(doc(db, 'users', user.uid), { teste: t }, { merge: true }); perfil = { ...(perfil || {}), teste: t }; }
  } catch (e) { console.error('teste', e); }
}
addEventListener('trc-teste', async () => { await sincronizarTeste(); avisa(); });

async function darNumero() {
  if (!user || perfil?.membro) return;
  try {
    const n = await runTransaction(db, async tx => {
      const cRef = doc(db, 'contadores', 'membros'), uRef = doc(db, 'users', user.uid);
      const [c, u] = [await tx.get(cRef), await tx.get(uRef)];
      if (u.exists() && u.data().membro) return u.data().membro;
      const prox = c.exists() ? c.data().n + 1 : PRIMEIRO_NUMERO;
      tx.set(cRef, { n: prox });
      tx.set(uRef, { membro: prox, membroDesde: new Date().toISOString() }, { merge: true });
      return prox;
    });
    perfil = { ...(perfil || {}), membro: n, membroDesde: perfil?.membroDesde || new Date().toISOString() };
  } catch (e) { console.error('numero', e); }
}

onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { perfil = null; avisa(); return; }
  avisa();
  const ref = doc(db, 'users', u.uid);
  try {
    const snap = await getDoc(ref);
    perfil = snap.exists() ? snap.data() : null;
    const novo = !perfil;
    if (novo) {
      const upd = { nome: u.displayName || '', email: u.email || '', criado: serverTimestamp(), optin: localStorage.getItem('trc-optin') === '1' };
      await setDoc(ref, upd, { merge: true }); perfil = upd;
    }
    await darNumero();
    await sincronizarTeste();
    if (novo) {
      const idToken = await u.getIdToken();
      fetch('/api/clube/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken, nome: u.displayName || '', optin: perfil.optin }) }).catch(() => {});
    }
  } catch (e) { console.error('perfil', e); }
  avisa();
});
