/* artigos da the relax club: comportamento dos componentes (o texto já vem pronto no html, isso aqui só liga o que mexe).
   - .toca: toca o mix do artigo aqui mesmo (arquivos de /sons/audio/, volumes do mix, em loop, timer de 30 min com fade)
   - .video: troca a capa pelo player do youtube (youtube-nocookie) só no clique
   - .filtros: filtra os grupos do índice /artigos/
   - eventos do GA4: artigo_view, toca_play, abre_mixer, artigo_teste_click
   - o tempo tocado vai pro aviso de instalar como app (/js/instalar.js) via trc.tempoTocando(segundos) */
(() => {
  const ga = (nome, dados) => { try { if (window.gtag) window.gtag('event', nome, dados || {}); } catch (e) {} };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const corpo = document.body, artigo = corpo.dataset.artigo || '', grupo = corpo.dataset.grupo || '';

  /* de onde a pessoa veio (primeira visita), igual ao js/clube.js, pra quem chega direto num artigo */
  (() => {
    if (ls('trc-origem')) return;
    const q = new URLSearchParams(location.search);
    let ref = ''; try { if (document.referrer) { const h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h; } } catch (e) {}
    ls('trc-origem', JSON.stringify({ source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '', ref,
      landing: location.pathname, data: new Date().toISOString() }));
  })();

  if (artigo) ga('artigo_view', { artigo, grupo });

  /* cliques que viram evento */
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    const href = a.getAttribute('href') || '';
    const onde = a.closest('.art-side,.idx-side') ? 'lateral' : a.closest('.toca') ? 'player' : 'texto';
    if (/^\/teste\/?/.test(href)) ga('artigo_teste_click', { artigo: artigo || 'indice', onde });
    else if (/^\/\?mix=/.test(href)) ga('abre_mixer', { artigo, mix: new URLSearchParams(href.slice(1)).get('mix') || '', onde });
  });

  /* ---------- filtros do índice ---------- */
  const filtros = document.querySelector('.filtros');
  if (filtros) filtros.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    const f = b.dataset.f;
    filtros.querySelectorAll('[data-f]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    document.querySelectorAll('.grupo[data-g]').forEach(g => { g.hidden = !(f === 'todos' || g.dataset.g === f); });
  });

  /* ---------- vídeo: capa leve, iframe só no clique ---------- */
  document.querySelectorAll('.video[data-video]').forEach(v => {
    const b = v.querySelector('.vi'); if (!b) return;
    b.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.dataset.video) + '?autoplay=1&rel=0&playsinline=1';
      f.title = v.dataset.titulo || 'vídeo do youtube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      v.innerHTML = ''; v.appendChild(f);
      ga('video_play', { artigo, video: v.dataset.video });
    });
  });

  /* ---------- toca aqui ---------- */
  const curva = v => Math.pow(v / 100, 1.6); // mesma curva de volume do mixer
  const MIN30 = 30 * 60 * 1000, VOL = .8;
  let ctx = null;
  const textoBase = 'toca aqui mesmo, com timer de 30 min';

  document.querySelectorAll('.toca[data-sons]').forEach(el => {
    let sons = []; try { sons = JSON.parse(el.dataset.sons || '[]'); } catch (e) {}
    const btn = el.querySelector('.pb'), tm = el.querySelector('.tm'), nome = el.querySelector('.tt b')?.textContent || '';
    if (!btn || !sons.length) return;
    let master = null, bufs = null, paradas = [], fim = 0, iv = 0, estado = 'parado';
    const marca = s => { estado = s; el.classList.toggle('tocando', s === 'tocando'); el.classList.toggle('carregando', s === 'carregando');
      btn.setAttribute('aria-pressed', s === 'tocando'); btn.setAttribute('aria-label', (s === 'tocando' ? 'pausar ' : 'tocar ') + nome); };

    const carregar = () => Promise.all(sons.map(s => fetch(s.u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(a => new Promise((ok, err) => ctx.decodeAudioData(a, ok, err)))));

    const tocaSom = (s, buf) => {
      const g = ctx.createGain(); g.gain.value = s.g * curva(s.v); g.connect(master);
      let src = null, t = 0, vivo = true;
      if (s.m === 'evento') { // toca inteiro e espera um pouco antes de tocar de novo (tigela cantando, gongo)
        const um = () => { if (!vivo) return; src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = .97 + Math.random() * .06; src.connect(g); src.start();
          t = setTimeout(um, (buf.duration + s.a + Math.random() * (s.b - s.a)) * 1000); };
        um();
      } else {
        src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = .06; src.loopEnd = Math.max(.1, buf.duration - .06);
        src.connect(g); src.start(0, Math.random() * Math.max(0, buf.duration - 1));
      }
      return () => { vivo = false; clearTimeout(t); try { src && src.stop(); } catch (e) {} g.disconnect(); };
    };

    const tique = () => {
      const falta = fim - Date.now();
      if (falta <= 0) { parar(3, 12000); return; }
      if (tm) tm.textContent = 'desliga sozinho em ' + Math.max(1, Math.ceil(falta / 60000)) + ' min';
    };

    function parar(fade = .25, espera = 1200) {
      clearInterval(iv);
      if (master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, fade); }
      const p = paradas; paradas = []; setTimeout(() => p.forEach(f => f()), espera);
      if (tm) tm.textContent = textoBase;
      marca('parado');
    }

    async function tocar() {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iphone no silencioso
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (!master) {
        master = ctx.createGain(); master.gain.value = 0;
        const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 8; lim.attack.value = .005; lim.release.value = .25;
        master.connect(lim); lim.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') await ctx.resume();
      marca('carregando');
      try { if (!bufs) bufs = await carregar(); }
      catch (e) { marca('parado'); if (tm) tm.textContent = 'não deu pra tocar aqui agora'; return; }
      if (estado !== 'carregando') return;
      document.querySelectorAll('.toca.tocando').forEach(o => o !== el && o.querySelector('.pb').click()); // um player por vez
      paradas = sons.map((s, i) => tocaSom(s, bufs[i]));
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0, ctx.currentTime); master.gain.setTargetAtTime(VOL, ctx.currentTime, .5);
      fim = Date.now() + MIN30; clearInterval(iv); iv = setInterval(tique, 1000); tique();
      marca('tocando');
      ga('toca_play', { artigo, mix: el.dataset.mix || '' });
    }

    btn.addEventListener('click', () => {
      if (estado === 'tocando') parar();
      else if (estado === 'carregando') marca('parado');
      else tocar();
    });
  });

  /* tempo com som tocando de verdade: alimenta o aviso de instalar como app (/js/instalar.js) */
  if (document.querySelector('.toca[data-sons]')) {
    let ult = Date.now();
    setInterval(() => {
      const agora = Date.now(), d = Math.min(65, (agora - ult) / 1000); ult = agora;
      if (ctx && ctx.state === 'running' && document.querySelector('.toca.tocando') && window.trc && window.trc.tempoTocando) window.trc.tempoTocando(d);
    }, 5000);
  }
})();
