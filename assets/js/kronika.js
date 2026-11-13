/* Hvězdná kronika – společná logika webu:
   stálý přehrávač (archiv vložený do stránky), přechody mezi stránkami bez přerušení zvuku,
   menu na mobilu, hledání, ztlumení a vysvětlivky pojmů. */
(function () {
  'use strict';
  var ZAKLAD = document.body.dataset.zaklad || '/';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ulozit = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var cist = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };

  /* ---------- Přehrávač ---------- */
  var obal = $('#prehravac'), frame = $('#pf'), pp = $('#pb-pp');
  var stav = null, framePripraven = null;

  function okno() { try { return frame.contentWindow && frame.contentWindow.KRONIKA ? frame.contentWindow : null; } catch (e) { return null; } }
  function pripravFrame() {
    if (framePripraven) return framePripraven;
    framePripraven = new Promise(function (hotovo) {
      var konec = Date.now() + 15000;
      (function cekej() {
        var w = okno();
        if (w) return hotovo(w);
        if (Date.now() > konec) return hotovo(null);
        setTimeout(cekej, 80);
      })();
      if (!frame.getAttribute('src')) frame.setAttribute('src', ZAKLAD + 'archiv/?embed=1&v=' + (document.body.dataset.verze || '') + '#domu');
    });
    return framePripraven;
  }
  // Zvuk musí odemknout klik v hlavní stránce: tady vytvoříme zvukový kontext a „probudíme“ hlas.
  function odemkni() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !window.__kvCtx) window.__kvCtx = new AC();
      if (window.__kvCtx && window.__kvCtx.state === 'suspended') window.__kvCtx.resume();
    } catch (e) {}
    try {
      if (window.speechSynthesis && !window.__kvHlas) {
        var u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); window.__kvHlas = true;
      }
    } catch (e) {}
  }
  function ukaz() { obal.hidden = false; document.body.classList.add('s-prehravacem'); }
  function rozbal(ano) {
    obal.classList.toggle('rozbaleny', !!ano);
    document.documentElement.classList.toggle('prehravac-otevreny', !!ano);
    var w = okno();
    if (w) { w.__kvViditelny = !!ano; try { w.KRONIKA.fit(); } catch (e) {} }
    if (ano) { ukaz(); frame.focus(); }
  }
  function prehrat(id, veta, rozbalit) {
    odemkni(); ukaz();
    if (rozbalit) rozbal(true);
    $('#pb-nazev').textContent = 'Načítám…';
    pripravFrame().then(function (w) {
      if (!w) { $('#pb-nazev').textContent = 'Přehrávač se nepodařilo načíst'; return; }
      if (rozbalit) { w.__kvViditelny = true; try { w.KRONIKA.fit(); } catch (e) {} }
      Promise.resolve(w.KRONIKA.play(id, veta || 0)).then(function (ok) { if (!ok) $('#pb-nazev').textContent = 'Tuto kapitolu se nepodařilo spustit'; });
    });
  }
  function otevritArchiv(sekce) {
    odemkni(); rozbal(true);
    pripravFrame().then(function (w) { if (w) { w.__kvViditelny = true; w.KRONIKA.fit(); w.KRONIKA.nav(sekce || 'domu'); } });
  }
  window.kronikaStav = function (s) {
    stav = s;
    if (!s || !s.id) return;
    ukaz();
    $('#pb-nazev').textContent = s.label + (s.total ? ' · věta ' + (s.ln + 1) + ' z ' + s.total : '');
    $('#pb-text').textContent = s.text || '';
    $('#pb-bar').style.width = s.total ? ((s.ln + 1) / s.total * 100) + '%' : '0';
    pp.textContent = s.playing ? '❚❚' : '▶';
    pp.setAttribute('aria-label', s.playing ? 'Pozastavit' : 'Přehrát');
  };
  window.kronikaOsoba = function (id) { rozbal(false); jdi(ZAKLAD + 'osobnosti/#' + id); };
  window.kronikaNav = function (cesta) { rozbal(false); jdi(ZAKLAD + cesta); };
  window.kronikaPrehrat = prehrat;

  pp.addEventListener('click', function () {
    odemkni();
    var w = okno();
    if (w && stav && stav.id) { w.KRONIKA.toggle(); return; }
    var poz = pozice();
    if (poz) prehrat(poz.id, poz.ln); else prehrat('prolog', 0, true);
  });
  $('#pb-otevrit').addEventListener('click', function () { odemkni(); rozbal(true); pripravFrame().then(function (w) { if (w && (!stav || !stav.id)) { var p = pozice(); if (p) w.KRONIKA.play(p.id, p.ln); } }); });
  $('#pf-zmensit').addEventListener('click', function () { rozbal(false); });
  $('#pb-zavrit').addEventListener('click', function () {
    var w = okno(); if (w) try { w.KRONIKA.pause(); } catch (e) {}
    rozbal(false); obal.hidden = true; document.body.classList.remove('s-prehravacem');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && obal.classList.contains('rozbaleny')) rozbal(false); });

  function pozice() { try { var p = JSON.parse(cist('kv-pozice') || 'null'); return p && p.id ? p : null; } catch (e) { return null; } }
  // Rozposlouchaná kapitola: lišta se ukáže v klidovém stavu a nabídne pokračování.
  (function () {
    var p = pozice();
    if (!p) return;
    ukaz();
    $('#pb-nazev').textContent = 'Pokračovat: ' + p.label;
    $('#pb-text').textContent = 'Věta ' + (p.ln + 1) + (p.total ? ' z ' + p.total : '');
    $('#pb-bar').style.width = p.total ? ((p.ln + 1) / p.total * 100) + '%' : '0';
  })();
  // Přehrávač načteme dopředu jen tomu, kdo o zvuk stojí: kdo má rozposlouchanou kapitolu (v klidu na pozadí),
  // nebo kdo najede / sáhne na přehrávač či odkaz na poslech. Ostatním (hlavně na mobilu) se nic navíc nestahuje.
  var vKlidu = window.requestIdleCallback || function (f) { return setTimeout(f, 1800); };
  if (pozice()) vKlidu(function () { pripravFrame(); }, { timeout: 4000 });
  ['pointerover', 'touchstart', 'focusin'].forEach(function (ud) {
    document.addEventListener(ud, function (e) {
      if (!framePripraven && e.target.closest && e.target.closest('#prehravac, a[href*="/archiv/"], [data-prehrat]')) pripravFrame();
    }, { passive: true });
  });

  /* ---------- Hudba a hlas (zvlášť vypínatelné) ---------- */
  var zv = { hudba: $('#z-hudba'), hlas: $('#z-hlas') };
  function kreslitZvuk() {
    ['hudba', 'hlas'].forEach(function (k) {
      var on = cist('kv-' + k) !== '0', b = zv[k]; if (!b) return;
      b.setAttribute('aria-pressed', on); b.classList.toggle('ztlumeno', !on);
      b.setAttribute('aria-label', (on ? 'Vypnout ' : 'Zapnout ') + (k === 'hudba' ? 'hudbu' : 'hlas')); b.title = b.getAttribute('aria-label');
    });
  }
  ['hudba', 'hlas'].forEach(function (k) {
    if (!zv[k]) return;
    zv[k].addEventListener('click', function () {
      var on = cist('kv-' + k) === '0';
      ulozit('kv-' + k, on ? '1' : '0'); kreslitZvuk();
      var w = okno(); if (w) try { w.KRONIKA[k](on); } catch (e) {}
    });
  });
  window.kronikaZvuk = function () { kreslitZvuk(); };
  kreslitZvuk();

  /* ---------- Menu na mobilu ---------- */
  var mt = $('#menu-tlacitko'), menu = $('#hlavni-menu');
  mt.addEventListener('click', function () {
    var o = !document.body.classList.contains('menu-otevrene');
    document.body.classList.toggle('menu-otevrene', o); mt.setAttribute('aria-expanded', o);
  });

  /* ---------- Přechody mezi stránkami bez načítání ---------- */
  function vnitrni(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname.indexOf(ZAKLAD) !== 0) return false;
    if (/\.(json|xml|md|png|jpe?g|svg|webp|mp3|ogg)$/i.test(u.pathname)) return false;
    return u;
  }
  function oznacMenu() {
    var cesta = location.pathname.slice(ZAKLAD.length).split('/')[0] || 'domu';
    if (cesta === 'kapitoly') cesta = 'dejiny';
    if (cesta === 'rod-messeru') cesta = 'osobnosti';
    if (cesta === 'uvod') cesta = 'o-projektu';
    [].forEach.call(menu.querySelectorAll('a'), function (a) {
      if (a.dataset.sekce === cesta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function spustSkripty(kde) {
    [].forEach.call(kde.querySelectorAll('script'), function (st) {
      var n = document.createElement('script');
      [].forEach.call(st.attributes, function (at) { n.setAttribute(at.name, at.value); });
      n.textContent = st.textContent; st.parentNode.replaceChild(n, st);
    });
  }
  function poNacteni() {
    oznacMenu();
    delete $('main').dataset.vysvetleno;
    vysvetli($('main'));
    prolinkuj($('main'));
    cestaStranky = location.pathname;
    document.dispatchEvent(new CustomEvent('kronika:stranka'));
  }
  // Warp mezi záložkami – stejný efekt jako po dohrání prologu v archivu.
  var warp = (function () {
    var klid = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var c, x, hvezdy, t0 = 0, konec = 0, beh = 0, DOBA = 620, rgb = [222, 236, 246], ac = null, sum = null;
    // Barva každé záložky z palety období
    var BARVY = { domu: '#f6bd4b', dejiny: '#7fb8d8', 'casova-osa': '#e0785c', mapa: '#6fd3a0', osobnosti: '#b99ae0', pribehy: '#8fd0c0', encyklopedie: '#a6c97f', rasy: '#f06a6a', 'o-projektu': '#d9c46a' };
    function naRgb(h) { h = (h || '').replace('#', ''); return h.length === 6 ? [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }) : [222, 236, 246]; }
    function zvuk() {
      if (cist('kv-hudba') === '0') return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        if (!ac) { ac = new AC(); sum = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); var d = sum.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        if (ac.state === 'suspended') ac.resume();
        var hl = parseFloat(cist('kv-vol-hudba')); if (!(hl >= 0 && hl <= 1)) hl = .8;
        var t = ac.currentTime + .01, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), D = DOBA / 1000;
        src.buffer = sum; src.loop = true; f.type = 'bandpass'; f.Q.value = 1.4;
        f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(5200, t + D * .85); f.frequency.exponentialRampToValueAtTime(260, t + D * 1.5);
        g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(Math.max(.002, .35 * hl), t + D * .8); g.gain.exponentialRampToValueAtTime(.001, t + D * 1.55);
        src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t); src.stop(t + D * 1.6);
      } catch (e) {}
    }
    function priprav() {
      if (c) return;
      c = document.createElement('canvas'); c.className = 'warp'; c.setAttribute('aria-hidden', 'true');
      document.body.appendChild(c); x = c.getContext('2d');
      hvezdy = []; for (var i = 0; i < 200; i++) hvezdy.push([Math.random(), Math.random(), Math.random() * 1.2 + .3, Math.random()]);
    }
    function kresli(ted) {
      var r = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
      if (c.width !== W * r || c.height !== H * r) { c.width = W * r; c.height = H * r; }
      x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, W, H);
      var k = Math.min(1, (ted - t0) / DOBA), e = k * k, zhas = konec ? Math.max(0, 1 - (ted - konec) / 420) : 1;
      if (konec && zhas <= 0) { c.style.display = 'none'; beh = 0; return; }
      x.globalAlpha = zhas;
      x.fillStyle = 'rgba(4,9,18,' + (.25 + .6 * e) + ')'; x.fillRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2; x.lineCap = 'round';
      for (var i = 0; i < hvezdy.length; i++) {
        var s = hvezdy[i], px = s[0] * W - cx, py = s[1] * H - cy, d = Math.hypot(px, py) || 1, ux = px / d, uy = py / d;
        var r0 = d * (1 + e * 2.2), r1 = r0 + e * H * .9 * s[2];
        x.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (.25 + .65 * s[3]) + ')'; x.lineWidth = s[2] * 1.1;
        x.beginPath(); x.moveTo(cx + ux * r0, cy + uy * r0); x.lineTo(cx + ux * r1, cy + uy * r1); x.stroke();
      }
      // bez bílého záblesku: konec přechodu jen ztmavne do hlubokého vesmíru
      if (k > .68) { x.fillStyle = 'rgba(4,9,18,' + ((k - .68) / .32 * .55) + ')'; x.fillRect(0, 0, W, H); }
      x.globalAlpha = 1;
      beh = requestAnimationFrame(kresli);
    }
    return {
      // vrátí slib, který se splní ve chvíli, kdy je obrazovka „v záblesku“ a dá se vyměnit obsah
      start: function (sekce) {
        if (klid) return Promise.resolve();
        rgb = naRgb(BARVY[sekce]); zvuk();
        priprav(); c.style.display = 'block'; t0 = performance.now(); konec = 0;
        if (!beh) beh = requestAnimationFrame(kresli);
        return new Promise(function (ok) { setTimeout(ok, DOBA * .9); });
      },
      hotovo: function () { if (c && !konec) konec = performance.now(); }
    };
  })();

  var nacitani = 0, cestaStranky = location.pathname;
  function jdi(url, bezHistorie, sWarpem) {
    var u = new URL(url, location.href), moje = ++nacitani;
    document.body.classList.remove('menu-otevrene');
    if (u.pathname === location.pathname && u.hash && !bezHistorie) {
      history.pushState(null, '', u.href);
      var c = document.getElementById(decodeURIComponent(u.hash.slice(1)));
      if (c) c.scrollIntoView(); window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    document.body.classList.add('nacita');
    var cekej = sWarpem ? warp.start(sWarpem) : Promise.resolve();
    fetch(u.href, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) { return cekej.then(function () { return html; }); }).then(function (html) {
      if (moje !== nacitani) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var novy = doc.querySelector('main');
      if (!novy) { location.href = u.href; return; }
      if (!bezHistorie) history.pushState(null, '', u.href);
      document.title = doc.title;
      document.body.dataset.sekce = doc.body.dataset.sekce || '';
      var m = $('main'); m.innerHTML = novy.innerHTML;
      spustSkripty(m);
      if (u.hash) { var c = document.getElementById(decodeURIComponent(u.hash.slice(1))); if (c) c.scrollIntoView(); else window.scrollTo(0, 0); }
      else window.scrollTo(0, 0);
      // Klávesnice a čtečky: po výměně obsahu přesunout focus na nadpis nové stránky (čtečka ho přečte).
      var nadpis = m.querySelector('h1') || m;
      if (!nadpis.hasAttribute('tabindex')) nadpis.setAttribute('tabindex', '-1');
      try { nadpis.focus({ preventScroll: true }); } catch (e) { nadpis.focus(); }
      document.body.classList.remove('nacita');
      warp.hotovo();
      poNacteni();
    }).catch(function () { location.href = u.href; });
  }
  window.kronikaJdi = jdi;

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]'); if (!a) return;
    var u = vnitrni(a); if (!u) return;
    var cesta = u.pathname.slice(ZAKLAD.length);
    if (cesta.indexOf('archiv') === 0) {
      e.preventDefault();
      var h = decodeURIComponent(u.hash.slice(1)), dily = h.split('@');
      if (/^(prolog|kap-\d+|letka|web-.+)$/.test(dily[0])) prehrat(dily[0], +dily[1] || 0, a.dataset.rozbalit === '1' || dily[0] === 'prolog');
      else otevritArchiv(h || 'domu');
      return;
    }
    if (u.pathname === location.pathname && !u.hash) { e.preventDefault(); return; }
    e.preventDefault(); jdi(u.href, false, a.closest('#hlavni-menu, .logo') ? (a.dataset.sekce || 'domu') : false);
  });
  window.addEventListener('popstate', function () {
    // Zpět mezi kotvami na stejné stránce: prohlížeč sám vyvolá hashchange, stránku nestahovat znovu.
    if (location.pathname === cestaStranky) { var c = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (c) c.scrollIntoView(); return; }
    jdi(location.href, true);
  });

  /* ---------- Hledání ---------- */
  var hp = $('#hledat-vse'), vys = $('#vysledky'), index = null;
  function nactiIndex() {
    if (index) return index;
    var j = function (u) { return fetch(ZAKLAD + u + '?v=' + (document.body.dataset.verze || '')).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); };
    index = Promise.all([j('data/osoby.json'), j('data/udalosti.json'), j('data/pojmy.json'), j('kapitoly.json'), j('data/dejiny.json'), j('novinky.json')]).then(function (d) {
      var vse = [];
      d[0].forEach(function (o) { vse.push({ t: o.jmeno, p: o.role + (o.narozeni && o.narozeni !== 'neznámo' ? ' · ' + o.narozeni : ''), u: ZAKLAD + 'osobnosti/' + o.id + '/', k: 'Osoba' }); });
      d[1].forEach(function (u) { vse.push({ t: u.titul, p: (u.datum || Math.floor(u.rok)) + '', u: ZAKLAD + 'casova-osa/#' + u.id, k: 'Událost' }); });
      (d[2] || []).forEach(function (p) { vse.push({ t: p.termin, p: p.vysvetleni, u: ZAKLAD + 'encyklopedie/#pojmy', k: 'Pojem' }); });
      (d[3] || []).forEach(function (k) { vse.push({ t: k.title, p: k.popis || '', u: ZAKLAD + 'kapitoly/' + k.slug + '/', k: 'Kapitola' }); });
      (d[4] || []).forEach(function (k) { vse.push({ t: (k.rim ? k.rim + '. ' : '') + k.title, p: (k.rozpeti || '') + (k.era ? ' · ' + k.era : ''), u: ZAKLAD + 'dejiny/' + k.hraj + '/', k: 'Dějiny' }); });
      ((d[5] && d[5].polozky) || []).forEach(function (n) {
        var u = ZAKLAD + String(n.cesta || '').replace(/^\//, '');
        if (n.druh === 'heslo') vse.push({ t: n.nazev, p: n.perex || '', u: u, k: 'Heslo' });
        else if (n.druh === 'rasa') vse.push({ t: n.nazev, p: n.perex || '', u: u, k: 'Rasa' });
      });
      vse.forEach(function (x) { x.n = bezDiakritiky(x.t); x.h = x.n + ' ' + bezDiakritiky(x.p); });
      return vse;
    });
    return index;
  }
  hp.addEventListener('focus', nactiIndex);
  hp.addEventListener('input', function () {
    var q = bezDiakritiky(hp.value.trim());
    if (q.length < 2) { vys.hidden = true; return; }
    nactiIndex().then(function (vse) {
      var slova = q.split(/\s+/), vsechny = vse.filter(function (x) { return slova.every(function (s) { return x.h.indexOf(s) >= 0; }); });
      // Pořadí: název začíná dotazem → název obsahuje všechna slova → shoda jen v popisu
      function skore(x) { return x.n.indexOf(q) === 0 ? 0 : (slova.every(function (s) { return x.n.indexOf(s) >= 0; }) ? 1 : 2); }
      vsechny.sort(function (a, b) { return skore(a) - skore(b); });
      var nal = vsechny.slice(0, 12);
      vys.innerHTML = nal.length ? nal.map(function (x) {
        return '<a href="' + x.u + '"><span class="v-druh">' + x.k + '</span><b>' + esc(x.t) + '</b><span class="v-pop">' + esc(x.p.slice(0, 90)) + (x.p.length > 90 ? '…' : '') + '</span></a>';
      }).join('') + (vsechny.length > 12 ? '<p class="v-nic">a dalších ' + (vsechny.length - 12) + ' – zpřesni hledání</p>' : '') : '<p class="v-nic">Nic jsme nenašli.</p>';
      vys.hidden = false;
    });
  });
  hp.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { vys.hidden = true; hp.blur(); }
    if (e.key === 'Enter') { var a = vys.querySelector('a'); if (a) a.click(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.hledani')) vys.hidden = true; else if (e.target.closest('.vysledky a')) { vys.hidden = true; hp.value = ''; } });
  function bezDiakritiky(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Vysvětlivky pojmů v textu ---------- */
  var pojmy = null;
  function nactiPojmy() {
    if (pojmy) return pojmy;
    pojmy = fetch(ZAKLAD + 'data/pojmy.json?v=' + (document.body.dataset.verze || '')).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (p) {
      var s = []; (p || []).forEach(function (x) { (x.tvary || [x.termin]).forEach(function (f) { if (f && f.length > 2) s.push([f, x.vysvetleni, x.termin]); }); });
      return s.sort(function (a, b) { return b[0].length - a[0].length; });
    });
    return pojmy;
  }
  var pismeno = /[\p{L}\p{N}]/u;
  function vysvetli(root) {
    if (!root || root.dataset.vysvetleno) return;
    var oblasti = root.querySelectorAll('.text-pojmy, .os-text, .ud-telo p, .kapitola-text p, .prolinkovat p, .era-uvod, .enc-text');
    if (!oblasti.length) return;
    root.dataset.vysvetleno = '1';
    nactiPojmy().then(function (seznam) {
      var pouzite = {};
      [].forEach.call(oblasti, function (el) {
        seznam.forEach(function (p) {
          if (pouzite[p[2]]) return;
          var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
          while ((n = w.nextNode())) {
            if (n.parentNode.closest('a, .pojem, h1, h2, h3')) continue;
            var t = n.nodeValue, i = t.indexOf(p[0]);
            if (i < 0) continue;
            if ((i > 0 && pismeno.test(t[i - 1])) || pismeno.test(t[i + p[0].length] || '')) continue;
            var sp = document.createElement('span');
            sp.className = 'pojem'; sp.tabIndex = 0; sp.dataset.v = p[1]; sp.textContent = p[0];
            var za = n.splitText(i); za.nodeValue = t.slice(i + p[0].length); n.parentNode.insertBefore(sp, za);
            pouzite[p[2]] = 1; break;
          }
        });
      });
    });
  }

  /* ---------- Jména osob v textech jako odkazy na jejich stránku ---------- */
  var osobyRe = null;
  function nactiOsoby() {
    if (osobyRe) return osobyRe;
    osobyRe = fetch(ZAKLAD + 'data/osoby.json?v=' + (document.body.dataset.verze || '')).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (os) {
      var kmen = function (w) { return w.length > 4 && /[aeiouyáéíóúůý]$/i.test(w) ? w.slice(0, -1) : w; };
      return os.map(function (o) {
        var slova = o.jmeno.replace(/\./g, '').split(/\s+/).filter(function (w) { return !/^[IVXL]+$/.test(w); });
        if (slova.length < 2) return null;
        var vzor = slova.map(function (w) { return kmen(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[a-záčďéěíňóřšťúůýž]{0,3}'; }).join('\\s+');
        return { id: o.id, re: new RegExp('(^|[^\\p{L}])(' + vzor + ')(?![\\p{L}])', 'u') };
      }).filter(Boolean);
    });
    return osobyRe;
  }
  function prolinkuj(root) {
    var oblasti = root.querySelectorAll('.prolinkovat p, .kapitola-text p, .osoba-detail .text p');
    if (!oblasti.length) return;
    nactiOsoby().then(function (seznam) {
      var ja = location.pathname;
      seznam.forEach(function (o) {
        var cil = ZAKLAD + 'osobnosti/' + o.id + '/';
        if (ja === cil) return;
        for (var k = 0; k < oblasti.length; k++) {
          var w = document.createTreeWalker(oblasti[k], NodeFilter.SHOW_TEXT, null), n, hotovo = false;
          while ((n = w.nextNode())) {
            if (n.parentNode.closest('a, .pojem, .dr-kdo')) continue;
            var m = o.re.exec(n.nodeValue); if (!m) continue;
            var i = m.index + m[1].length, a = document.createElement('a');
            a.className = 'os-odkaz'; a.href = cil; a.textContent = m[2];
            var za = n.splitText(i); za.nodeValue = za.nodeValue.slice(m[2].length); n.parentNode.insertBefore(a, za);
            hotovo = true; break;
          }
          if (hotovo) break;
        }
      });
    });
  }

  poNacteni();
})();
