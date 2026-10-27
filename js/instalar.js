/* convite pra instalar como app da the relax club (sede e páginas de artigo).
   - aparece depois de 5 minutos de som tocando somados (mixer da sede + player "toca aqui" dos artigos),
     contando só o tempo com áudio tocando de fato. quem toca avisa com trc.tempoTocando(segundos).
   - o acumulado fica no localStorage e soma entre visitas.
   - não aparece: já aberto como app, fechado nos últimos 14 dias, app já instalado, ou computador sem instalação.
   - aparece como mensagem da clara no canto (componente /js/mensagem.js, id "instalar"), que dá pra minimizar.
   - android/chrome: botão "instalar" (prompt do navegador). iphone/ipad: "ver como" + dica do compartilhar.
     outros celulares: "ver como" (vai pro artigo com o passo a passo).
   - clicar no botão ou em "agora não" faz sumir por 14 dias.
   - eventos do GA4: os do componente (mensagem_*, com id "instalar") e app_instalado */
(() => {
  const LIMITE = 5 * 60;                 // segundos de som tocando
  const PAUSA = 14 * 24 * 3600 * 1000;   // depois de fechar, some por 14 dias
  const K_TEMPO = 'trc-tocado', K_FECHOU = 'trc-instalar-fechou', K_INSTALADO = 'trc-instalado';
  const COMO = '/artigos/instalar-no-celular/';
  const JS = '/js/mensagem.js';      // componente "mensagem da clara" (baixado só quando vai aparecer)

  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const ga = (nome, dados) => { try { if (window.gtag) window.gtag('event', nome, dados || {}); } catch (e) {} };

  const ua = navigator.userAgent || '';
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // ipad se apresenta como mac
  const iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|Line\//.test(ua);
  const celular = ios || /Android|Mobi/i.test(ua);
  const comoApp = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return navigator.standalone === true; } };

  let pedido = null, mostrando = false, msg = null;

  /* chrome/edge (android e computador): guarda o pedido de instalação pra usar no botão */
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedido = e; checar(); });
  addEventListener('appinstalled', () => { ls(K_INSTALADO, '1'); ga('app_instalado', { plataforma: !celular ? 'computador' : ios ? 'ios' : 'android' }); fechar(); });

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

  function carregarComponente() {
    return new Promise(ok => {
      if (window.trc.mensagem) return ok();
      const sc = document.createElement('script'); sc.src = JS; sc.async = true;
      sc.onload = sc.onerror = () => ok(); document.head.appendChild(sc);
    });
  }

  async function mostrar() {
    mostrando = true;
    await carregarComponente();
    if (!window.trc.mensagem || !pode()) { mostrando = false; return; } // algo mudou enquanto carregava
    const p = plataforma();
    const texto = celular
      ? 'quer ter a the relax club como app? fica na tela de início do celular e abre num toque.'
      : 'quer ter a the relax club como app no computador? abre direto, sem precisar do navegador.';
    const nota = p === 'ios_safari' ? 'no iphone: toque em compartilhar e depois em adicionar à tela de início.' : '';
    const snooze = () => ls(K_FECHOU, String(Date.now()));
    msg = await window.trc.mensagem({
      id: 'instalar', texto, nota,
      acao: pedido
        ? { rotulo: 'instalar', clique: async () => {
            const pd = pedido; pedido = null; if (!pd) return;
            try { await pd.prompt(); const r = await pd.userChoice; if (r && r.outcome === 'accepted') ls(K_INSTALADO, '1'); } catch (er) {}
            if (msg) msg.fechar();
          } }
        : { rotulo: 'ver como', href: COMO },
      aoAgir: snooze,      // já viu o caminho: não insiste por 14 dias
      aoFechar: snooze     // "agora não": some por 14 dias
    });
    if (!msg) mostrando = false;
  }

  function fechar() { if (msg) { msg.fechar(); msg = null; } }

  // quem já passou dos 5 minutos em outra visita vê o aviso logo que a página abre
  // (uns segundos depois do load, pra dar tempo do chrome mandar o beforeinstallprompt)
  const inicio = () => setTimeout(checar, 2500);
  if (document.readyState === 'complete') inicio(); else addEventListener('load', inicio);
})();
