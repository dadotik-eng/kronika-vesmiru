/* Živé obrázky – jemný pohyb nad ilustrací (WebGL + částice). Bez WebGL nebo při
   „omezit pohyb“ zůstane obyčejný obrázek. Maska: R/G/B kanály = oblasti efektů. */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var NOISE = 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}' +
    'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}';
  var R = Math.random;
  var SCENY = {
    letka: {
      cam: [.6, .42, .07, 45],
      fs: 'void main(){vec2 u=(v-cam.xy)/cam.z+cam.xy;vec4 m=texture2D(M,u);float sky=smoothstep(.62,.3,u.y);vec2 o=vec2(0);' +
        'o+=sky*(vec2(fb(u*3.+vec2(t*.012,0)),fb(u*3.+vec2(4.,t*.01)))-.5)*.006;' +
        'vec2 q=u*vec2(7.,5.)+vec2(t*.02,-t*.09);o+=m.g*(vec2(fb(q),fb(q+7.3))-.5)*.022+m.g*vec2(0.,-.002);' +
        'float hf=texture2D(M,u+vec2(0.,.035)).r+texture2D(M,u+vec2(0.,.02)).r;' +
        'o+=clamp(hf,0.,1.)*(vec2(n(u*vec2(90.,40.)+vec2(0.,-t*3.)),n(u*vec2(80.,60.)+vec2(3.,-t*2.5)))-.5)*.004;' +
        'o.x+=m.b*(sin(u.y*900.+t*1.8)*.6+n(u*vec2(30.,400.)+t*.5)-.5)*.0025;' +
        'vec3 col=texture2D(I,u+o).rgb;vec4 m2=texture2D(M,u+o);' +
        'float fl=fb(u*vec2(40.,25.)+vec2(0.,-t*2.2))*.9+.25*sin(t*11.+u.x*80.);' +
        'col+=col*m2.r*(fl-.35)*.9+vec3(1.,.45,.12)*m2.r*max(fl-.3,0.)*.35;' +
        'col+=vec3(.25,.08,.02)*(1.-sky)*(.6+.4*fb(vec2(t*.6,u.x*3.)))*smoothstep(.55,.85,u.y)*.25;' +
        'float eye=exp(-(pow((u.x-.7583)/.0146,2.)+pow((u.y-.1759)/.0222,2.)));' +
        'col+=vec3(1.,.15,.03)*eye*(.25+.35*(.5+.5*sin(t*2.3)))*1.4;' +
        'gl_FragColor=vec4(col,1.);}',
      init: function (s) {
        s.lode = []; s.jiskry = [];
        for (var i = 0; i < 70; i++) s.lode.push({ x: .3 + R() * .33, y: .27 + R() * .05, vx: (R() - .3) * .004, vy: .006 + R() * .01, s: .6 + R() * .9, f: R() * 6 });
        s.ohniska = [[.45, .7], [.55, .66], [.72, .62], [.88, .7], [.95, .74], [.62, .72], [.36, .71]];
        s.nova = function () { var o = s.ohniska[(R() * s.ohniska.length) | 0]; return { x: o[0] + (R() - .5) * .06, y: o[1] + R() * .03, vx: (R() - .3) * .01, vy: -(.02 + R() * .04), l: 0, L: 2 + R() * 3 }; };
        for (i = 0; i < 60; i++) { var j = s.nova(); j.l = R() * j.L; s.jiskry.push(j); }
      },
      krok: function (s, dt, t) {
        s.lode.forEach(function (l) { l.x += l.vx * dt; l.y += l.vy * dt; l.f += dt * 3; if (l.y > .62) { l.x = .3 + R() * .33; l.y = .27 + R() * .04; } });
        s.jiskry.forEach(function (j, i) { j.x += j.vx * dt + Math.sin(t * 2 + i) * .0004; j.y += j.vy * dt; j.l += dt; if (j.l > j.L) s.jiskry[i] = s.nova(); });
      },
      kresli: function (s, fx, P, z, k) {
        s.lode.forEach(function (l) {
          var p = P(l.x, l.y), al = Math.min(1, (l.y - .27) * 12) * Math.min(1, (.62 - l.y) * 10) * .75;
          fx.fillStyle = 'rgba(25,18,16,' + al + ')'; fx.beginPath(); fx.ellipse(p[0], p[1], 1.1 * l.s * z * k, .65 * l.s * z * k, .5, 0, 7); fx.fill();
          if (Math.sin(l.f) > .92) { fx.fillStyle = 'rgba(255,120,60,' + al * .8 + ')'; fx.fillRect(p[0] - .5 * k, p[1] - .5 * k, k, k); }
        });
        fx.globalCompositeOperation = 'lighter';
        s.jiskry.forEach(function (j) {
          var p = P(j.x, j.y), al = Math.sin(Math.PI * j.l / j.L), r = 1.3 * z * k;
          var g = fx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
          g.addColorStop(0, 'rgba(255,210,140,' + al + ')'); g.addColorStop(1, 'rgba(255,90,20,0)');
          fx.fillStyle = g; fx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
        });
        fx.globalCompositeOperation = 'source-over';
      }
    },
    'dite-z-marsu': {
      cam: [.33, .45, .06, 50],
      fs: 'void main(){vec2 u=(v-cam.xy)/cam.z+cam.xy;vec4 m=texture2D(M,u);vec2 o=vec2(0);' +
        'o+=m.r*(vec2(fb(u*vec2(4.,6.)+vec2(t*.03,0.)),fb(u*vec2(4.,6.)+vec2(5.,t*.02)))-.5)*.012+m.r*vec2(-.002*sin(t*.1),0.);' +
        'o+=m.g*(vec2(n(u*vec2(70.,30.)+vec2(0.,-t*1.6)),n(u*vec2(60.,40.)+vec2(4.,-t*1.3)))-.5)*.0025;' +
        'vec3 col=texture2D(I,u+o).rgb;float gx=fract(t/14.)*2.2-.6;' +
        'col+=vec3(1.,.95,.85)*exp(-pow((u.x+u.y*.5-gx-.3)/.04,2.))*m.b*.16;col*=1.+.03*sin(t*.4);' +
        'gl_FragColor=vec4(col,1.);}',
      init: function (s) {
        var Z = [[481, 172, 1], [585, 205, .6], [836, 192, .8], [903, 168, 1]].map(function (a) { return { x: a[0] / 960, y: a[1] / 540, s: a[2] }; });
        Z.push({ x: 622 / 960, y: 458 / 540, s: .7, hrnek: 1 });
        s.puf = function (z) { return { z: z, x: z.x + (R() - .5) * .003, y: z.y, vx: z.hrnek ? (R() - .5) * .004 : .004 + R() * .004, vy: -(z.hrnek ? .012 + R() * .01 : .008 + R() * .008), r: (z.hrnek ? 2 : 3) * z.s, l: 0, L: z.hrnek ? 2.5 + R() * 1.5 : 4 + R() * 3 }; };
        s.pary = []; Z.forEach(function (z) { for (var i = 0; i < 14; i++) { var q = s.puf(z); q.l = R() * q.L; s.pary.push(q); } });
        s.prach = []; for (var i = 0; i < 45; i++) s.prach.push({ x: .35 + R() * .25, y: .05 + R() * .6, vx: (R() - .5) * .004, vy: (R() - .5) * .003, f: R() * 7, s: .6 + R() });
      },
      krok: function (s, dt, t) {
        s.pary.forEach(function (q, i) { q.x += q.vx * dt + (q.z.hrnek ? Math.sin(t * 3 + i) * .0006 : 0); q.y += q.vy * dt; q.l += dt; if (q.l > q.L) s.pary[i] = s.puf(q.z); });
        s.prach.forEach(function (d) { d.x += d.vx * dt + Math.sin(t * .5 + d.f) * .0002; d.y += d.vy * dt + Math.cos(t * .4 + d.f) * .0002; d.f += dt; if (d.x < .33 || d.x > .62 || d.y < .02 || d.y > .7) { d.x = .35 + R() * .25; d.y = .05 + R() * .6; } });
      },
      kresli: function (s, fx, P, z, k) {
        s.pary.forEach(function (q) {
          var p = P(q.x, q.y), e = q.l / q.L, al = Math.sin(Math.PI * Math.min(1, e * 1.4)) * (q.z.hrnek ? .28 : .5) * (1 - e), r = q.r * (1 + e * 3.5) * z * k;
          var c = q.z.hrnek ? '255,255,255' : '240,240,245', g = fx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
          g.addColorStop(0, 'rgba(' + c + ',' + al + ')'); g.addColorStop(1, 'rgba(' + c + ',0)'); fx.fillStyle = g; fx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
        });
        fx.globalCompositeOperation = 'lighter';
        s.prach.forEach(function (d) { var p = P(d.x, d.y); fx.fillStyle = 'rgba(255,235,200,' + (.25 + .25 * Math.sin(d.f * 1.3)) + ')'; fx.beginPath(); fx.arc(p[0], p[1], .65 * d.s * z * k, 0, 7); fx.fill(); });
        fx.globalCompositeOperation = 'source-over';
      }
    }
  };
  function nahraj(src) { return new Promise(function (ok, chyba) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = chyba; i.src = src; }); }
  function spust(fig) {
    var sc = SCENY[fig.getAttribute('data-zivy')], img = fig.querySelector('img');
    if (!sc || !img) return;
    var obal = document.createElement('div'); obal.className = 'zivy-obal';
    img.parentNode.insertBefore(obal, img); obal.appendChild(img);
    var c = document.createElement('canvas'), f2 = document.createElement('canvas');
    c.className = f2.className = 'zivy-platno'; c.setAttribute('aria-hidden', 'true'); f2.setAttribute('aria-hidden', 'true');
    var g = c.getContext('webgl', { alpha: false, premultipliedAlpha: false });
    if (!g) return obal.parentNode.insertBefore(img, obal), obal.remove();
    var fx = f2.getContext('2d');
    Promise.all([nahraj(img.currentSrc || img.src), nahraj(fig.getAttribute('data-maska'))]).then(function (I) {
      function sh(t, s) { var x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x); return x; }
      var pr = g.createProgram();
      g.attachShader(pr, sh(g.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0,1);}'));
      g.attachShader(pr, sh(g.FRAGMENT_SHADER, 'precision highp float;varying vec2 v;uniform sampler2D I,M;uniform float t;uniform vec3 cam;' + NOISE + sc.fs));
      g.linkProgram(pr); if (!g.getProgramParameter(pr, g.LINK_STATUS)) return;
      g.useProgram(pr);
      g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer()); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      var pl = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(pl); g.vertexAttribPointer(pl, 2, g.FLOAT, false, 0, 0);
      I.forEach(function (im, u) {
        g.activeTexture(g.TEXTURE0 + u); g.bindTexture(g.TEXTURE_2D, g.createTexture());
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, im);
        [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T].forEach(function (w) { g.texParameteri(g.TEXTURE_2D, w, g.CLAMP_TO_EDGE); });
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.uniform1i(g.getUniformLocation(pr, u ? 'M' : 'I'), u);
      });
      var uT = g.getUniformLocation(pr, 't'), uC = g.getUniformLocation(pr, 'cam'), s = {}; sc.init(s);
      obal.appendChild(c); obal.appendChild(f2); obal.classList.add('bezi');
      var tl = document.createElement('button'); tl.type = 'button'; tl.className = 'zivy-pauza'; tl.textContent = '\u275A\u275A';
      tl.setAttribute('aria-label', 'Zastavit pohyb obr\u00e1zku'); obal.appendChild(tl);
      var stoj = false, vidim = false, tp = 0, last = 0, bezi = false;
      tl.onclick = function () { stoj = !stoj; tl.textContent = stoj ? '\u25B6' : '\u275A\u275A'; tl.setAttribute('aria-label', stoj ? 'Rozpohybovat obr\u00e1zek' : 'Zastavit pohyb obr\u00e1zku'); if (!stoj) tik(); };
      function rozmer() { var d = Math.min(2, window.devicePixelRatio || 1), w = Math.min(1920, Math.round(obal.clientWidth * d)); var h = Math.round(w * I[0].height / I[0].width); if (c.width !== w) { c.width = f2.width = w; c.height = f2.height = h; } }
      function snimek(now) {
        bezi = false; if (stoj || !vidim) return;
        var dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; tp += dt; rozmer();
        var t = tp, cm = sc.cam, z = 1.02 + cm[2] * (.5 - .5 * Math.cos(t * Math.PI * 2 / cm[3])), W = c.width, H = c.height, k = W / 960;
        g.viewport(0, 0, W, H); g.uniform1f(uT, t); g.uniform3f(uC, cm[0], cm[1], z); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
        sc.krok(s, dt, t); fx.clearRect(0, 0, W, H);
        sc.kresli(s, fx, function (x, y) { return [((x - cm[0]) * z + cm[0]) * W, ((y - cm[1]) * z + cm[1]) * H]; }, z, k);
        tik();
      }
      function tik() { if (!bezi) { bezi = true; requestAnimationFrame(snimek); } }
      new IntersectionObserver(function (e) { vidim = e[0].isIntersecting; last = 0; if (vidim) tik(); }).observe(obal);
    }).catch(function () {});
  }
  function start() { document.querySelectorAll('[data-zivy]').forEach(spust); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
