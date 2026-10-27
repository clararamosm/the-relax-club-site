/* mensagens da clara que dependem do app (carregado na sede, nos artigos e nas outras páginas).
   1. no navegador: convite pra instalar como app.
   2. no app instalado: convite pra receber notificações (news nova e avisos).

   1. instalar
   - aparece depois de 5 minutos de som tocando somados (mixer da sede + player "toca aqui" dos artigos),
     contando só o tempo com áudio tocando de fato. quem toca avisa com trc.tempoTocando(segundos).
   - o acumulado fica no localStorage e soma entre visitas.
   - não aparece: já aberto como app, fechado nos últimos 14 dias, app já instalado, ou computador sem instalação.
   - aparece como mensagem da clara no canto (componente /js/mensagem.js, id "instalar"), que dá pra minimizar.
   - android/chrome: botão "instalar" (prompt do navegador). iphone/ipad: "ver como" + dica do compartilhar.
     outros celulares: "ver como" (vai pro artigo com o passo a passo).
   - clicar no botão ou em "agora não" faz sumir por 14 dias.
   - eventos do GA4: os do componente (mensagem_*, com id "instalar") e app_instalado

   2. notificações (só dentro do app: no iphone o navegador nem deixa, e assim o navegador fica sem pedido nenhum)
   - aparece uns segundos depois de abrir o app, se a pessoa ainda não respondeu ao pedido de notificação.
   - "quero" pede a permissão do celular e manda a inscrição pra /api/avisos (que responde com uma notificação de boas-vindas).
   - "agora não" some por 14 dias. permissão negada no celular: nunca mais pergunta.
   - quem já aceitou: a cada abertura confere se a inscrição continua valendo e renova no servidor se mudou.
   - eventos do GA4: mensagem_* com id "avisos", avisos_ativou, avisos_negou */
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
    s = Math.min(s, 120);
    ls(K_TEMPO, String(Math.round((tempo() + s) * 10) / 10));
    pendente += s; if (pendente >= 600) enviarMinutos(); // a cada 10 minutos tocando
    checar();
  };

  /* minutos tocados no google analytics (evento tempo_tocado, parâmetro minutos). anônimo: só soma tempo.
     manda a cada 10 minutos de som e quando a pessoa sai ou esconde a página (se tiver pelo menos 30 segundos guardados). */
  let pendente = 0;
  const lugar = location.pathname.indexOf('/artigos/') === 0 ? 'artigo' : location.pathname === '/' ? 'sede' : 'outro';
  function enviarMinutos() {
    if (pendente < 30) return;
    const minutos = Math.round(pendente / 6) / 10; pendente = 0;
    ga('tempo_tocado', { minutos, lugar, app: comoApp() ? 'sim' : 'nao', transport_type: 'beacon' });
  }
  addEventListener('pagehide', enviarMinutos);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enviarMinutos(); });

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


  /* ---------- 2. notificações ---------- */
  const VAPID = 'BKJbMV-Y9C-1_41hBDZZI8dSUxmKKAgdRlZ33nKemo61ZRB_f-qAbuRKWMgou536C5n5dTaPZCqhGK0ANyrNry4'; // chave pública (VAPID_PUBLICA na vercel)
  const K_AV_FECHOU = 'trc-avisos-fechou', K_AV_ENDP = 'trc-avisos-endpoint';
  const temPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const platAviso = () => ios ? 'ios' : /Android/i.test(ua) ? 'android' : celular ? 'outro' : 'computador';
  const chave = b64 => { const p = '='.repeat((4 - b64.length % 4) % 4); const r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };

  async function inscricao(criar) {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && criar) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(VAPID) });
    return sub;
  }
  async function mandarProServidor(sub, renovar) {
    const r = await fetch('/api/avisos/', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sub: sub.toJSON(), plataforma: platAviso(), renovar }) });
    if (r.ok) ls(K_AV_ENDP, sub.endpoint);
    return r.ok;
  }

  // chamado no toque do botão "quero" (o iphone só deixa pedir permissão a partir de um toque)
  async function ativarAvisos() {
    let perm;
    try { perm = await Notification.requestPermission(); } catch (e) { perm = 'default'; }
    if (perm !== 'granted') { ga('avisos_negou', { plataforma: platAviso(), permissao: perm }); if (msg) msg.fechar(); return; }
    try {
      const sub = await inscricao(true);
      if (sub && await mandarProServidor(sub, false)) ga('avisos_ativou', { plataforma: platAviso() });
    } catch (e) {}
    if (msg) msg.fechar();
  }

  function podeAvisos() {
    if (!comoApp() || !temPush()) return false;
    if (Notification.permission !== 'default') return false;
    const f = +ls(K_AV_FECHOU); if (f && Date.now() - f < PAUSA) return false;
    return true;
  }
  async function mostrarAvisos() {
    if (mostrando || !podeAvisos()) return;
    mostrando = true;
    await carregarComponente();
    if (!window.trc.mensagem || !podeAvisos()) { mostrando = false; return; }
    msg = await window.trc.mensagem({
      id: 'avisos',
      texto: 'posso te avisar aqui no celular quando sair news nova? sem exagero, prometo.',
      acao: { rotulo: 'quero', clique: ativarAvisos },
      aoFechar: () => ls(K_AV_FECHOU, String(Date.now()))
    });
    if (!msg) mostrando = false;
  }

  // quem já aceitou: confere se a inscrição continua a mesma (o navegador às vezes troca) e renova no servidor
  async function conferirAvisos() {
    if (!temPush() || Notification.permission !== 'granted') return;
    try {
      const sub = await inscricao(true);
      if (sub && sub.endpoint !== ls(K_AV_ENDP)) await mandarProServidor(sub, true);
    } catch (e) {}
  }

  if (comoApp()) {
    try { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {}); } catch (e) {} // abriu o app: tira o número do ícone
    const iniciarApp = () => { conferirAvisos(); setTimeout(mostrarAvisos, 4000); };
    if (document.readyState === 'complete') iniciarApp(); else addEventListener('load', iniciarApp);
  }

  /* ---------- 1. instalar: começo ---------- */
  // quem já passou dos 5 minutos em outra visita vê o aviso logo que a página abre
  // (uns segundos depois do load, pra dar tempo do chrome mandar o beforeinstallprompt)
  const inicio = () => setTimeout(checar, 2500);
  if (document.readyState === 'complete') inicio(); else addEventListener('load', inicio);
})();
