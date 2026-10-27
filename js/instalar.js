/* aviso "instalar como app" da the relax club (sede e páginas de artigo).
   - aparece depois de 5 minutos de som tocando somados (mixer da sede + player "toca aqui" dos artigos),
     contando só o tempo com áudio tocando de fato. quem toca avisa com trc.tempoTocando(segundos).
   - o acumulado fica no localStorage e soma entre visitas.
   - não aparece: já aberto como app, fechado nos últimos 14 dias, app já instalado, ou computador sem instalação.
   - android/chrome: botão "instalar" (prompt do navegador). iphone/ipad: "ver como" + dica do compartilhar.
     outros celulares: "ver como" (vai pro artigo com o passo a passo).
   - o css (/css/instalar.css) só é baixado quando o aviso vai aparecer.
   - eventos do GA4: instalar_aviso_mostrado, instalar_clicou, instalar_fechou, app_instalado */
(() => {
  const LIMITE = 5 * 60;                 // segundos de som tocando
  const PAUSA = 14 * 24 * 3600 * 1000;   // depois de fechar, some por 14 dias
  const K_TEMPO = 'trc-tocado', K_FECHOU = 'trc-instalar-fechou', K_INSTALADO = 'trc-instalado';
  const COMO = '/artigos/instalar-no-celular/';
  const CSS = '/css/instalar.css';

  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const ga = (nome, dados) => { try { if (window.gtag) window.gtag('event', nome, dados || {}); } catch (e) {} };

  const ua = navigator.userAgent || '';
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // ipad se apresenta como mac
  const iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|Line\//.test(ua);
  const celular = ios || /Android|Mobi/i.test(ua);
  const comoApp = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return navigator.standalone === true; } };

  let pedido = null, mostrando = false, el = null;

  /* chrome/edge (android e computador): guarda o pedido de instalação pra usar no botão */
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedido = e; checar(); });
  addEventListener('appinstalled', () => { ls(K_INSTALADO, '1'); ga('app_instalado', { plataforma: !celular ? 'computador' : ios ? 'ios' : 'android' }); fechar(false); });

  const plataforma = () => pedido ? (celular ? 'android' : 'computador') : ios ? (iosSafari ? 'ios_safari' : 'ios_outro') : 'outro_celular';
  const tempo = () => { const n = parseFloat(ls(K_TEMPO)); return isFinite(n) && n > 0 ? n : 0; };

  function pode() {
    if (comoApp() || ls(K_INSTALADO)) return false;
    const f = +ls(K_FECHOU); if (f && Date.now() - f < PAUSA) return false;
    if (!celular && !pedido) return false;           // computador sem instalação pelo navegador
    if (location.pathname.indexOf(COMO) === 0) return false; // já tá no passo a passo
    return true;
  }

  function checar() { if (!mostrando && tempo() >= LIMITE && pode()) mostrar(); }

  /* quem toca som chama isso de tempos em tempos com os segundos tocados desde a última chamada */
  window.trc = window.trc || {};
  window.trc.tempoTocando = s => {
    s = +s; if (!(s > 0)) return;
    ls(K_TEMPO, String(Math.round((tempo() + Math.min(s, 120)) * 10) / 10));
    checar();
  };

  function carregarCss() {
    return new Promise(ok => {
      if (document.querySelector('link[data-instalar]')) return ok();
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.instalar = '';
      l.onload = l.onerror = () => ok(); document.head.appendChild(l);
    });
  }

  async function mostrar() {
    mostrando = true;
    await carregarCss();
    if (!pode()) { mostrando = false; return; } // algo mudou enquanto o css carregava
    const p = plataforma();
    const onde = celular ? 'no celular e abre direto da tela de início' : 'no computador e abre direto, sem precisar do navegador';
    el = document.createElement('div');
    el.className = 'trc-aviso';
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'aviso');
    el.innerHTML = `<div class="trc-aviso-in"><p class="trc-aviso-tx">vi que você tá curtindo ficar por aqui. instala a the relax club ${onde}, como um app.${p === 'ios_safari' ? '<small>toque em compartilhar e depois em adicionar à tela de início</small>' : ''}</p>`
      + (pedido ? '<button type="button" class="trc-aviso-bt" data-acao="instalar">instalar</button>' : `<a class="trc-aviso-bt" href="${COMO}" data-acao="ver_como">ver como</a>`)
      + '<button type="button" class="trc-aviso-x" aria-label="fechar aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el && el.classList.add('on')));
    ga('instalar_aviso_mostrado', { plataforma: p });

    el.querySelector('.trc-aviso-x').addEventListener('click', () => { ga('instalar_fechou', { plataforma: p }); fechar(true); });
    el.querySelector('.trc-aviso-bt').addEventListener('click', async e => {
      const acao = e.currentTarget.dataset.acao;
      ga('instalar_clicou', { plataforma: p, acao });
      ls(K_FECHOU, String(Date.now())); // já viu o caminho: não insiste por 14 dias
      if (acao !== 'instalar' || !pedido) return; // "ver como" segue o link
      const pd = pedido; pedido = null;
      try { await pd.prompt(); const r = await pd.userChoice; if (r && r.outcome === 'accepted') ls(K_INSTALADO, '1'); } catch (er) {}
      fechar(false);
    });
  }

  function fechar(marcar) {
    if (marcar) ls(K_FECHOU, String(Date.now()));
    if (!el) return;
    const x = el; el = null;
    x.classList.remove('on');
    setTimeout(() => x.remove(), 400);
  }

  // quem já passou dos 5 minutos em outra visita vê o aviso logo que a página abre
  // (uns segundos depois do load, pra dar tempo do chrome mandar o beforeinstallprompt)
  const inicio = () => setTimeout(checar, 2500);
  if (document.readyState === 'complete') inicio(); else addEventListener('load', inicio);
})();
