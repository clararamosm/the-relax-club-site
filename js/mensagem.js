/* mensagem da clara: componente reutilizável de "mensagem no canto" da the relax club.
   uma mensagem por vez. o rostinho da clara fica fixo no canto de cima à direita e a mensagem abre pra baixo dele.
   - abre como conversa: "digitando" e depois a mensagem.
   - na primeira vez abre sozinha. minimizar (setinha, tocar fora ou esc) deixa só o rostinho.
   - depois disso ela continua nas próximas páginas só como rostinho, até a pessoa agir ou dispensar.
     na mesma visita, sem bolinha (já leu). numa visita nova, com a bolinha vermelha de "mensagem pra você".
   - "agora não" dispensa e chama aoFechar (quem chamou decide por quanto tempo some).

   uso:
     trc.mensagem({
       id: 'instalar',                       // único por mensagem (guarda o estado no localStorage)
       texto: 'quer ter a the relax club como app?', // html confiável, escrito por nós
       nota: 'no iphone: ...',               // opcional, linha pequena embaixo
       acao: { rotulo: 'instalar', href: '/x/' } // ou { rotulo, clique: fn } ; opcional
       nao: 'agora não',                     // opcional, texto do botão de dispensar
       aoFechar: () => {}, aoAgir: () => {}   // opcionais
     })
   eventos do GA4 (todos com {id}): mensagem_mostrada, mensagem_abriu, mensagem_minimizou, mensagem_clicou, mensagem_dispensou */
(() => {
  window.trc = window.trc || {};
  if (window.trc.mensagem) return;

  const CSS = '/css/mensagem.css';
  const FOTO = '/teste/clara.jpg';
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  const ga = (nome, dados) => { try { if (window.gtag) window.gtag('event', nome, dados || {}); } catch (e) {} };
  const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function carregarCss() {
    return new Promise(ok => {
      if (document.querySelector('link[data-mensagem]')) return ok();
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.mensagem = '';
      l.onload = l.onerror = () => ok(); document.head.appendChild(l);
    });
  }

  const avatar = cls => `<span class="trc-msg-foto ${cls || ''}" aria-hidden="true"><img src="${FOTO}" alt="" onerror="this.remove()">c</span>`;
  const ICO_MIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';

  let atual = null;

  window.trc.mensagem = async function (m) {
    if (!m || !m.id || atual) return null;
    const K = 'trc-msg-' + m.id;
    await carregarCss();

    // localStorage 'min' = já apareceu antes: volta só como rostinho no canto.
    // sessionStorage 'lida' = já foi lida nesta visita: rostinho sem a bolinha vermelha.
    const comecaMin = ls(K) === 'min';
    let lida = ss(K) === 'lida';

    const raiz = document.createElement('div');
    raiz.className = 'trc-msg';
    raiz.innerHTML =
      `<button type="button" class="trc-msg-bolha" aria-label="mensagem da clara" aria-expanded="false">${avatar()}<span class="trc-msg-ponto" aria-hidden="true"></span></button>`
      + `<section class="trc-msg-card" role="dialog" aria-modal="false" aria-label="mensagem da clara">`
      + `<header class="trc-msg-topo"><span class="trc-msg-quem"><b>clara</b><small>the relax club</small></span>`
      + `<button type="button" class="trc-msg-min" aria-label="minimizar mensagem">${ICO_MIN}</button></header>`
      + `<div class="trc-msg-conversa" aria-live="polite"><div class="trc-msg-digitando" aria-hidden="true"><i></i><i></i><i></i></div></div>`
      + `</section>`;
    document.body.appendChild(raiz);

    const conversa = raiz.querySelector('.trc-msg-conversa');
    const bolha = raiz.querySelector('.trc-msg-bolha');
    let escrita = false;

    function escrever() {
      if (escrita) return; escrita = true;
      const corpo = () => {
        conversa.innerHTML =
          `<p class="trc-msg-tx">${m.texto}${m.nota ? `<small>${m.nota}</small>` : ''}</p>`
          + `<div class="trc-msg-acoes">`
          + (m.acao ? (m.acao.href ? `<a class="trc-msg-bt" href="${m.acao.href}">${m.acao.rotulo}</a>` : `<button type="button" class="trc-msg-bt">${m.acao.rotulo}</button>`) : '')
          + `<button type="button" class="trc-msg-nao">${m.nao || 'agora não'}</button></div>`;
        const bt = conversa.querySelector('.trc-msg-bt');
        if (bt) bt.addEventListener('click', e => {
          ga('mensagem_clicou', { id: m.id });
          ls(K, null);
          if (m.aoAgir) m.aoAgir(e);
          if (m.acao.clique) { e.preventDefault(); m.acao.clique(e); }
        });
        conversa.querySelector('.trc-msg-nao').addEventListener('click', () => { ga('mensagem_dispensou', { id: m.id }); fechar(); if (m.aoFechar) m.aoFechar(); });
      };
      if (calmo()) corpo(); else setTimeout(corpo, 1100);
    }

    function marcarLida() { lida = true; ss(K, 'lida'); ls(K, 'min'); raiz.classList.add('lida'); }
    function abrir(origem) {
      marcarLida();
      raiz.classList.remove('min'); raiz.classList.add('aberta'); bolha.setAttribute('aria-expanded', 'true');
      escrever();
      if (origem) ga('mensagem_abriu', { id: m.id });
    }
    function minimizar() {
      if (!raiz.classList.contains('aberta')) return;
      raiz.classList.remove('aberta'); raiz.classList.add('min'); bolha.setAttribute('aria-expanded', 'false');
      ga('mensagem_minimizou', { id: m.id, lida });
      bolha.focus({ preventScroll: true });
    }
    function fechar() {
      ls(K, null); ss(K, '');
      raiz.classList.remove('on');
      setTimeout(() => raiz.remove(), 350);
      atual = null;
    }

    raiz.querySelector('.trc-msg-min').addEventListener('click', minimizar);
    bolha.addEventListener('click', () => raiz.classList.contains('aberta') ? minimizar() : abrir(true));
    raiz.addEventListener('keydown', e => { if (e.key === 'Escape') minimizar(); });
    // tocar fora da mensagem também minimiza
    document.addEventListener('pointerdown', e => { if (raiz.isConnected && !raiz.contains(e.target)) minimizar(); }, true);

    if (comecaMin) { raiz.classList.add('min'); if (lida) raiz.classList.add('lida'); }
    else { raiz.classList.add('aberta'); bolha.setAttribute('aria-expanded', 'true'); marcarLida(); escrever(); }
    requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.add('on')));
    ga('mensagem_mostrada', { id: m.id, minimizada: comecaMin });

    atual = { fechar, abrir, minimizar };
    return atual;
  };
})();
