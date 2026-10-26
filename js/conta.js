/* sede (home): seu cantinho, salvar mix, compartilhar e avatar na barra. o núcleo do clube fica em /js/clube.js */
import { db, $, esc, AMB, DIAS_REFAZER, primeiro, dataBR, abrir, fechar, aoFechar, msg, criarAvatar, quandoMudar, user as _u } from '/js/clube.js';
import * as clube from '/js/clube.js';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let pendingSave = false;
aoFechar.push(() => { pendingSave = false; });
const getUser = () => clube.user, getPerfil = () => clube.perfil;

/* janela de salvar mix */
const salvarBox = document.createElement('div');
salvarBox.className = 'cm-step'; salvarBox.dataset.step = 'salvar'; salvarBox.hidden = true;
salvarBox.innerHTML = `<h2>salvar este mix</h2>
    <p class="cm-sub" id="cm-mix-desc"></p>
    <input class="cm-in" id="cm-mix-nome" type="text" maxlength="40" placeholder="dá um nome, tipo foco da tarde">
    <button class="cm-btn cm-dark" id="cm-mix-ok" type="button">salvar</button>
    <p class="cm-msg" id="cm-msg3"></p>`;
document.querySelector('.conta-modal .cm-box').appendChild(salvarBox);

/* avatar na barra de baixo, do lado de salvar e compartilhar */
criarAvatar(document.querySelector('.bar .in'));

/* ---------- seu cantinho ---------- */
const side = document.querySelector('.side');
const box = document.createElement('section');
box.id = 'cantinho'; box.className = 'cantinho'; box.hidden = true;
side.prepend(box);

async function render() {
  const user = getUser(), perfil = getPerfil();
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
  box.innerHTML = `<div class="ct-top"><h2>seu cantinho${nome ? `, ${esc(nome)}` : ''}</h2><a class="ct-sair" href="/perfil/">${perfil?.membro ? `nº ${perfil.membro}` : 'perfil'}</a></div>
    <div class="ct-mixes"><small>seus mixes</small>${mixes.length ? mixes.map(m => `<div class="ct-mix" data-id="${m.id}"><button type="button" class="ct-play">${esc(m.nome)}</button><button type="button" class="ct-del" aria-label="apagar ${esc(m.nome)}">×</button></div>`).join('')
      : `<p class="ct-vazio">liga uns sons e toca em "salvar mix" lá embaixo.</p>`}</div>${teste}`;
  box.hidden = false;
  box.querySelectorAll('.ct-mix').forEach(el => {
    const m = mixes.find(x => x.id === el.dataset.id);
    el.querySelector('.ct-play').onclick = () => tocarMix(m);
    el.querySelector('.ct-del').onclick = async () => { if (!confirm(`apagar o mix "${m.nome}"?`)) return; await deleteDoc(doc(db, 'users', getUser().uid, 'mixes', m.id)); render(); };
  });
}
function tocarMix(m) {
  if (!playing) setPlaying(true);
  SONS.forEach(s => setOn(s.id, m.sons[s.id] != null, m.sons[s.id]));
  clearMix(); toast(`tocando ${m.nome}`);
}
async function listarMixes() {
  const user = getUser(); if (!user) return [];
  try { const q = await getDocs(query(collection(db, 'users', user.uid, 'mixes'), orderBy('criado', 'desc'))); return q.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { return []; }
}

/* ---------- salvar mix ---------- */
const atual = () => Object.fromEntries(SONS.filter(s => st[s.id].on).map(s => [s.id, st[s.id].vol]));
$('#save').onclick = () => {
  const sons = atual();
  if (!Object.keys(sons).length) return toast('liga pelo menos um som pra salvar');
  if (!getUser()) { pendingSave = true; abrir(); msg('#cm-msg', 'entra rapidinho que eu salvo o seu mix.'); return; }
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
  const user = getUser();
  await addDoc(collection(db, 'users', user.uid, 'mixes'), { nome, sons: atual(), criado: serverTimestamp() });
  toast(`"${nome}" salvo no seu cantinho`); render();
  try { window.gtag && gtag('event', 'salvar_mix', { nome }); } catch (e) {}
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
quandoMudar(() => {
  render();
  if (getUser() && !document.querySelector('.conta-modal').hidden && pendingSave) { pendingSave = false; abrirSalvar(); }
  else if (getUser() && !document.querySelector('.conta-modal').hidden && document.querySelector('[data-step="inicio"]:not([hidden]), [data-step="senha"]:not([hidden])')) fechar();
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
  try { window.gtag && gtag('event', 'compartilhar_mix', { sons: k }); } catch (e) {}
  try { await setDoc(doc(db, 'compartilhados', k), { n: increment(1) }, { merge: true }); } catch (e) {}
  contagem();
};
contagem();
