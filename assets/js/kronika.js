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
      if (!frame.getAttribute('src')) frame.setAttribute('src', ZAKLAD + 'archiv/?embed=1#domu');
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
      w.KRONIKA.play(id, veta || 0);
    });
  }
  function otevritArchiv(sekce) {
    odemkni(); rozbal(true);
    pripravFrame().then(function (w) { if (w) { w.__kvViditelny = true; w.KRONIKA.fit(); w.KRONIKA.nav(sekce || 'domu'); } });
  }
  window.kronikaStav = function (s) {
    stav = s;
    if (!s || !s.id) { if (s && s.view === 'hub' && !obal.classList.contains('rozbaleny')) {} return; }
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
  // Přehrávač načteme v klidu na pozadí, aby se spustil hned.
  setTimeout(function () { pripravFrame(); }, 1800);

  /* ---------- Ztlumení ---------- */
  var tl = $('#ztlumit');
  function kreslitZtlumeni() {
    var m = cist('kv-mute') === '1';
    tl.classList.toggle('ztlumeno', m);
    tl.setAttribute('aria-label', m ? 'Zapnout zvuk' : 'Ztlumit zvuk'); tl.title = tl.getAttribute('aria-label');
  }
  tl.addEventListener('click', function () {
    var m = cist('kv-mute') !== '1';
    ulozit('kv-mute', m ? '1' : '0'); kreslitZtlumeni();
    var w = okno(); if (w) try { w.KRONIKA.mute(m); } catch (e) {}
  });
  kreslitZtlumeni();

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
    vysvetli($('main'));
    document.dispatchEvent(new CustomEvent('kronika:stranka'));
  }
  var nacitani = 0;
  function jdi(url, bezHistorie) {
    var u = new URL(url, location.href), moje = ++nacitani;
    document.body.classList.remove('menu-otevrene');
    if (u.pathname === location.pathname && u.hash && !bezHistorie) {
      history.pushState(null, '', u.href);
      var c = document.getElementById(decodeURIComponent(u.hash.slice(1)));
      if (c) c.scrollIntoView(); window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    document.body.classList.add('nacita');
    fetch(u.href, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
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
      document.body.classList.remove('nacita');
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
    e.preventDefault(); jdi(u.href);
  });
  window.addEventListener('popstate', function () { jdi(location.href, true); });

  /* ---------- Hledání ---------- */
  var hp = $('#hledat-vse'), vys = $('#vysledky'), index = null;
  function nactiIndex() {
    if (index) return index;
    var j = function (u) { return fetch(ZAKLAD + u).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); };
    index = Promise.all([j('data/osoby.json'), j('data/udalosti.json'), j('data/pojmy.json'), j('kapitoly.json'), j('data/dejiny.json')]).then(function (d) {
      var vse = [];
      d[0].forEach(function (o) { vse.push({ t: o.jmeno, p: o.role + (o.narozeni && o.narozeni !== 'neznámo' ? ' · ' + o.narozeni : ''), u: ZAKLAD + 'osobnosti/#' + o.id, k: 'Osoba' }); });
      d[1].forEach(function (u) { vse.push({ t: u.titul, p: (u.datum || Math.floor(u.rok)) + '', u: ZAKLAD + 'casova-osa/#' + u.id, k: 'Událost' }); });
      (d[2] || []).forEach(function (p) { vse.push({ t: p.termin, p: p.vysvetleni, u: ZAKLAD + 'encyklopedie/#pojmy', k: 'Pojem' }); });
      (d[3] || []).forEach(function (k) { vse.push({ t: k.title, p: k.popis || '', u: ZAKLAD + 'kapitoly/' + k.slug + '/', k: 'Kapitola' }); });
      (d[4] || []).forEach(function (k) { vse.push({ t: (k.rim ? k.rim + '. ' : '') + k.title, p: k.rozpeti || '', u: ZAKLAD + 'archiv/#' + k.hraj, k: 'Poslech' }); });
      vse.forEach(function (x) { x.h = (x.t + ' ' + x.p).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); });
      return vse;
    });
    return index;
  }
  hp.addEventListener('focus', nactiIndex);
  hp.addEventListener('input', function () {
    var q = hp.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (q.length < 2) { vys.hidden = true; return; }
    nactiIndex().then(function (vse) {
      var slova = q.split(/\s+/), nal = vse.filter(function (x) { return slova.every(function (s) { return x.h.indexOf(s) >= 0; }); }).slice(0, 12);
      vys.innerHTML = nal.length ? nal.map(function (x) {
        return '<a href="' + x.u + '"><span class="v-druh">' + x.k + '</span><b>' + esc(x.t) + '</b><span class="v-pop">' + esc(x.p.slice(0, 90)) + '</span></a>';
      }).join('') : '<p class="v-nic">Nic jsme nenašli.</p>';
      vys.hidden = false;
    });
  });
  hp.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { vys.hidden = true; hp.blur(); }
    if (e.key === 'Enter') { var a = vys.querySelector('a'); if (a) a.click(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.hledani')) vys.hidden = true; else if (e.target.closest('.vysledky a')) { vys.hidden = true; hp.value = ''; } });
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Vysvětlivky pojmů v textu ---------- */
  var pojmy = null;
  function nactiPojmy() {
    if (pojmy) return pojmy;
    pojmy = fetch(ZAKLAD + 'data/pojmy.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (p) {
      var s = []; (p || []).forEach(function (x) { (x.tvary || [x.termin]).forEach(function (f) { if (f && f.length > 2) s.push([f, x.vysvetleni, x.termin]); }); });
      return s.sort(function (a, b) { return b[0].length - a[0].length; });
    });
    return pojmy;
  }
  var pismeno = /[\p{L}\p{N}]/u;
  function vysvetli(root) {
    if (!root || root.dataset.vysvetleno) return;
    var oblasti = root.querySelectorAll('.text-pojmy, .os-text, .ud-telo p, .kapitola-text p, .era-uvod, .enc-text');
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

  poNacteni();
})();
