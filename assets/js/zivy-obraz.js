/* Živé obrázky – jemný pohyb nad ilustracemi webu.
   Seznam obrázků a jejich masek je v assets/zive/seznam.js (vytváří nastroje/zive_masky.py).
   Jeden sdílený WebGL kontext vykresluje všechny obrázky, které jsou právě vidět.
   Bez WebGL, při „omezit pohyb“ nebo po stisku pauzy zůstanou obyčejné obrázky. */
(function () {
  'use strict';
  var SEZNAM = window.ZIVE_SEZNAM;
  if (!SEZNAM || !window.IntersectionObserver) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var KLIC = 'zive-stop', stop = false;
  try { stop = localStorage.getItem(KLIC) === '1'; } catch (e) {}
  var R = Math.random;

  var NOISE = 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}' +
    'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}' +
    'float tw(vec2 u){return sin(t*2.4+h(floor(u*480.))*6.283)*.5+.5;}';
  var HLAVA = 'precision highp float;varying vec2 v;uniform sampler2D I,M;uniform float t,sd;uniform vec3 cam;uniform vec4 cr;uniform vec4 eA[8],eB[8],eC[8];' + NOISE + 'vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}' +
    'void main(){vec2 u=cr.xy+v*cr.zw;u=(u-cam.xy)/cam.z+cam.xy;vec4 m=texture2D(M,u);vec2 o=vec2(0);';

  /* ---------- scény ---------- */
  function prach(s, n, x0, x1, y0, y1) {
    s.prach = [];
    for (var i = 0; i < n; i++) s.prach.push({ x: x0 + R() * (x1 - x0), y: y0 + R() * (y1 - y0), vx: (R() - .5) * .004, vy: (R() - .5) * .003, f: R() * 7, s: .6 + R(), b: [x0, x1, y0, y1] });
  }
  function prachKrok(s, dt, t) {
    s.prach.forEach(function (d) {
      d.x += d.vx * dt + Math.sin(t * .5 + d.f) * .0002; d.y += d.vy * dt + Math.cos(t * .4 + d.f) * .0002; d.f += dt;
      if (d.x < d.b[0] || d.x > d.b[1] || d.y < d.b[2] || d.y > d.b[3]) { d.x = d.b[0] + R() * (d.b[1] - d.b[0]); d.y = d.b[2] + R() * (d.b[3] - d.b[2]); }
    });
  }
  function prachKresli(s, fx, P, z, k, sila) {
    fx.globalCompositeOperation = 'lighter';
    s.prach.forEach(function (d) { var p = P(d.x, d.y); fx.fillStyle = 'rgba(255,235,200,' + (sila * (.5 + .5 * Math.sin(d.f * 1.3))) + ')'; fx.beginPath(); fx.arc(p[0], p[1], Math.max(.6, .65 * d.s * z * k), 0, 7); fx.fill(); });
    fx.globalCompositeOperation = 'source-over';
  }
  function zar(fx, p, r, al, c0, c1) {
    var g = fx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    g.addColorStop(0, 'rgba(' + c0 + ',' + al + ')'); g.addColorStop(1, 'rgba(' + c1 + ',0)');
    fx.fillStyle = g; fx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
  }

  function novaLod(c, f) { return { f: f, v: 1 / (25 + R() * 35), ox: (R() - .5) * .04, oy: (R() - .5) * .04, s: .6 + R() * .8, bl: R() * 5 }; }
  function novaPara(c) { var s = c[3] || 1; return { x: c[1] + (R() - .5) * .004, y: c[2], vx: (R() - .3) * .006, vy: -(.01 + R() * .01), r: 2.5 * s, l: 0, L: 3 + R() * 3 }; }
  function novaJiskra(c) { return { x: c[1] + (R() - .5) * .03, y: c[2] + R() * .02, vx: (R() - .3) * .01, vy: -(.02 + R() * .04), l: 0, L: 1.5 + R() * 2.5 }; }
  function novaBublina(c, dole) { return { x: c[1] + R() * (c[3] - c[1]), y: dole ? c[4] : c[2] + R() * (c[4] - c[2]), v: .01 + R() * .02, s: .5 + R() * .8, f: R() * 7 }; }
  function novyLupen(c, kde) { var b = ['rgba(255,250,235,.75)', 'rgba(210,235,170,.7)', 'rgba(255,215,225,.7)'][(R() * 3) | 0]; return { x: c[1] + R() * (c[3] - c[1]), y: kde ? c[2] + R() * (c[4] - c[2] + .6) : c[2] - R() * .1, v: .02 + R() * .025, vx: .006 + R() * .01, s: .6 + R() * .8, f: R() * 7, bar: b }; }

  var SCENY = {

    /* Obecná scéna pro portréty: R = plápolající světla, G = třpytivé body. */
    zakladni: {
      cam: function (sd) { return [.35 + sd * .3, .42, .09, 30 + sd * 10]; },
      pan: .025,
      fs: 'vec3 col=texture2D(I,u).rgb;' +
        'col+=col*m.g*(tw(u)-.3)*2.6;' +
        'float fl=fb(u*vec2(40.,25.)+vec2(sd*9.,-t*2.4))*.9+.25*sin(t*10.+u.x*60.);col+=col*m.r*(fl-.4)*1.2;' +
        'float gx=fract((t+sd*20.)/16.)*2.6-.8;col+=vec3(1.,.95,.85)*exp(-pow((u.x+u.y*.45-gx-.3)/.09,2.))*.09;' +
        'float mlha=fb(u*vec2(2.5,3.5)+vec2(t*.035+sd*5.,t*.012));col+=vec3(.9,.85,.75)*smoothstep(.45,.85,mlha)*.06;' +
        'col*=1.+.04*sin(t*.5+sd*6.);gl_FragColor=vec4(col,1.);}',
      init: function (s) { prach(s, 30, .03, .97, .03, .95); },
      krok: prachKrok,
      kresli: function (s, fx, P, z, k) { prachKresli(s, fx, P, z, k * 1.6, .4); }
    },

    /* Portrét s ručním nastavením (nastroje/zive_osoby.py). */
    osoba: {
      cam: function (sd, k) { return k.kam; },
      pan: .012,
      fs: 'float T=8.;float pa=fract(t/T),pb=fract(t/T+.5);vec2 oa=vec2(0),ob=vec2(0);vec3 ad=vec3(0);float bm=0.;' +
        'for(int i=0;i<8;i++){vec4 A=eA[i],B=eB[i],C=eC[i];if(B.x<.5)break;' +
        'vec2 c=(A.xy+A.zw)*.5,r=max((A.zw-A.xy)*.5,vec2(.001));vec2 q=(u-c)/r;float d=length(q);float e=smoothstep(1.,.55,d);' +
        'if(B.x<1.5){float f=pow(max(1.-d,0.),1.3);oa+=c+rot(q,(pa-.5)*T*B.y*f)*r-u;ob+=c+rot(q,(pb-.5)*T*B.y*f)*r-u;}' +
        'else if(B.x<2.5){vec2 nz=(vec2(fb(u*6.+vec2(t*.05,0.)),fb(u*6.+vec2(3.,t*.04)))-.5)*B.w;oa+=e*(-B.yz*(pa-.5)*T+nz);ob+=e*(-B.yz*(pb-.5)*T+nz);}' +
        'else if(B.x<3.5){vec2 w=vec2((sin(u.y*700.+t*1.7)*.5+n(u*vec2(25.,300.)+t*.6)-.5)*B.y,0.);oa+=e*w;ob+=e*w;}' +
        'else if(B.x<4.5){float s=B.w>.5?step(.55,fract(t*B.y*.5)):(.5+.5*sin(t*B.y));ad+=C.rgb*exp(-d*d*2.5)*B.z*(.35+.65*s);}' +
        'else if(B.x<5.5){bm+=e*(n(vec2(u.x*14.-t*B.z,t*.2))-.5)*2.*B.y;}' +
        'else if(B.x<6.5){float an=atan(q.y,q.x);float df=mod(mod(t*B.y*6.283,6.283)-an+6.283,6.283);ad+=C.rgb*exp(-df*2.5)*step(d,1.)*(1.-d*.5)*.35;}' +
        'else{vec2 w=(vec2(n(u*vec2(90.,40.)+vec2(0.,-t*2.5)),n(u*vec2(80.,60.)+vec2(3.,-t*2.)))-.5)*B.y;oa+=e*w;ob+=e*w;}}' +
        'float wa=1.-abs(2.*pa-1.);oa*=m.b;ob*=m.b;vec3 c0=texture2D(I,u).rgb;' +
        'vec3 ca=mix(c0,texture2D(I,u+oa).rgb,texture2D(M,u+oa).b),cb=mix(c0,texture2D(I,u+ob).rgb,texture2D(M,u+ob).b);vec3 col=mix(cb,ca,wa);' +
        'float lu=dot(col,vec3(.3,.59,.11));col*=1.+bm*smoothstep(.25,.8,lu);' +
        'col+=col*m.g*(tw(u)-.3)*2.4;' +
        'float fl=fb(u*vec2(40.,25.)+vec2(sd*9.,-t*2.4))*.9+.25*sin(t*10.+u.x*60.);col+=col*m.r*(fl-.4)*1.1;' +
        'col+=ad*(1.-lu*.5);col*=1.+.03*sin(t*.5+sd*6.);gl_FragColor=vec4(col,1.);}',
      init: function (s, pol) {
        s.sys = [];
        (pol.def.k.cast || []).forEach(function (c) {
          var typ = c[0], o = { typ: typ, c: c, p: [] }, i;
          if (typ === 'lode') for (i = 0; i < c[5]; i++) o.p.push(novaLod(c, R()));
          if (typ === 'para') for (i = 0; i < 12; i++) { var q = novaPara(c); q.l = R() * q.L; o.p.push(q); }
          if (typ === 'jiskry') for (i = 0; i < 18; i++) { var j = novaJiskra(c); j.l = R() * j.L; o.p.push(j); }
          if (typ === 'prach') prach(o, c[5], c[1], c[3], c[2], c[4]);
          if (typ === 'bubliny') for (i = 0; i < c[5]; i++) o.p.push(novaBublina(c, 0));
          if (typ === 'lupeny') for (i = 0; i < c[5]; i++) o.p.push(novyLupen(c, 1));
          if (typ === 'popel') for (i = 0; i < c[1]; i++) o.p.push({ x: R(), y: R(), vx: .01 + R() * .015, vy: .02 + R() * .03, s: .5 + R() * 1.2, f: R() * 7, sv: R() < .3 });
          s.sys.push(o);
        });
      },
      krok: function (s, dt, t) {
        s.sys.forEach(function (o) {
          var c = o.c;
          if (o.typ === 'lode') o.p.forEach(function (l, i) { l.f += l.v * dt; l.bl += dt; if (l.f > 1) o.p[i] = novaLod(c, 0); });
          if (o.typ === 'para') o.p.forEach(function (q, i) { q.x += q.vx * dt; q.y += q.vy * dt; q.l += dt; if (q.l > q.L) o.p[i] = novaPara(c); });
          if (o.typ === 'jiskry') o.p.forEach(function (j, i) { j.x += j.vx * dt + Math.sin(t * 2 + i) * .0003; j.y += j.vy * dt; j.l += dt; if (j.l > j.L) o.p[i] = novaJiskra(c); });
          if (o.typ === 'prach') prachKrok(o, dt, t);
          if (o.typ === 'bubliny') o.p.forEach(function (b, i) { b.y -= b.v * dt; b.f += dt; if (b.y < c[2]) o.p[i] = novaBublina(c, 1); });
          if (o.typ === 'lupeny') o.p.forEach(function (b, i) { b.y += b.v * dt; b.x += (b.vx + Math.sin(t * .8 + b.f) * .01) * dt; b.f += dt; if (b.y > c[4] + .6) o.p[i] = novyLupen(c, 0); });
          if (o.typ === 'popel') o.p.forEach(function (a) { a.x += (a.vx + Math.sin(t + a.f) * .004) * dt; a.y += a.vy * dt; a.f += dt; if (a.y > 1.02 || a.x > 1.02) { a.x = R() * 1.1 - .1; a.y = -.02; } });
        });
      },
      kresli: function (s, fx, P, z, k) {
        s.sys.forEach(function (o) {
          var c = o.c;
          if (o.typ === 'lode') o.p.forEach(function (l) {
            var x = c[1] + (c[3] - c[1]) * l.f + l.ox, y = c[2] + (c[4] - c[2]) * l.f + l.oy, p = P(x, y), al = Math.min(1, l.f * 8, (1 - l.f) * 8) * .85;
            var a0 = P(c[1], c[2]), a1 = P(c[3], c[4]), ang = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), d = Math.max(1.2, 2.6 * c[6] * l.s * k);
            fx.save(); fx.translate(p[0], p[1]); fx.rotate(ang);
            fx.fillStyle = c[7] ? 'rgba(200,205,215,' + al * .8 + ')' : 'rgba(22,20,24,' + al + ')';
            fx.beginPath(); fx.ellipse(0, 0, d, d * .38, 0, 0, 7); fx.fill();
            fx.globalCompositeOperation = 'lighter';
            var r = d * .9, g = fx.createRadialGradient(-d, 0, 0, -d, 0, r);
            g.addColorStop(0, c[7] ? 'rgba(170,210,255,' + al + ')' : 'rgba(255,150,70,' + al * .9 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
            fx.fillStyle = g; fx.fillRect(-d - r, -r, r * 2, r * 2);
            if (Math.sin(l.bl * 3) > .9) { fx.fillStyle = 'rgba(255,90,80,' + al + ')'; fx.fillRect(d * .6, -.5, Math.max(1, k), Math.max(1, k)); }
            fx.globalCompositeOperation = 'source-over'; fx.restore();
          });
          if (o.typ === 'para') o.p.forEach(function (q) { var e = q.l / q.L; zar(fx, P(q.x, q.y), Math.max(1.5, q.r * (1 + e * 3.5) * z * k), Math.sin(Math.PI * Math.min(1, e * 1.4)) * .35 * (1 - e), '245,245,248', '245,245,248'); });
          if (o.typ === 'jiskry') { fx.globalCompositeOperation = 'lighter'; o.p.forEach(function (j) { zar(fx, P(j.x, j.y), Math.max(1, 1.2 * z * k), Math.sin(Math.PI * j.l / j.L), '255,210,140', '255,90,20'); }); fx.globalCompositeOperation = 'source-over'; }
          if (o.typ === 'prach') prachKresli(o, fx, P, z, k * 1.4, .4);
          if (o.typ === 'bubliny') o.p.forEach(function (b) {
            var h = c[4] - c[2], p = P(b.x + Math.sin(b.f * 1.5) * .004, b.y), r = Math.max(1, c[6] * b.s * k), al = Math.max(0, Math.min(1, (b.y - c[2]) / h * 4, (c[4] - b.y) / h * 6 + .2)) * .55;
            fx.strokeStyle = 'rgba(255,245,225,' + al + ')'; fx.lineWidth = Math.max(.6, r * .12); fx.beginPath(); fx.arc(p[0], p[1], r, 0, 7); fx.stroke();
            fx.fillStyle = 'rgba(255,255,255,' + al * .5 + ')'; fx.beginPath(); fx.arc(p[0] - r * .35, p[1] - r * .35, r * .22, 0, 7); fx.fill();
          });
          if (o.typ === 'lupeny') o.p.forEach(function (b) {
            var p = P(b.x, b.y), d = Math.max(1, 1.6 * b.s * k); fx.save(); fx.translate(p[0], p[1]); fx.rotate(b.f * 1.7);
            fx.fillStyle = b.bar; fx.beginPath(); fx.ellipse(0, 0, d, d * .45 * Math.abs(Math.sin(b.f * 2)) + .3, 0, 0, 7); fx.fill(); fx.restore();
          });
          if (o.typ === 'popel') o.p.forEach(function (a) {
            var p = P(a.x, a.y); fx.fillStyle = a.sv ? 'rgba(170,165,160,.35)' : 'rgba(20,18,18,.55)';
            fx.save(); fx.translate(p[0], p[1]); fx.rotate(a.f); fx.fillRect(-a.s * k, -a.s * k * .5, Math.max(1, a.s * 2 * k), Math.max(.6, a.s * k)); fx.restore();
          });
        });
      }
    },

    'ztracena-letka': {
      cam: function () { return [.6, .42, .07, 45]; },
      fs: 'float sky=smoothstep(.62,.3,u.y);' +
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
        'col+=vec3(1.,.15,.03)*eye*(.25+.35*(.5+.5*sin(t*2.3)))*1.4;gl_FragColor=vec4(col,1.);}',
      init: function (s) {
        s.lode = []; s.jiskry = [];
        for (var i = 0; i < 70; i++) s.lode.push({ x: .3 + R() * .33, y: .27 + R() * .05, vx: (R() - .3) * .004, vy: .006 + R() * .01, s: .6 + R() * .9, f: R() * 6 });
        var oh = [[.45, .7], [.55, .66], [.72, .62], [.88, .7], [.95, .74], [.62, .72], [.36, .71]];
        s.nova = function () { var o = oh[(R() * oh.length) | 0]; return { x: o[0] + (R() - .5) * .06, y: o[1] + R() * .03, vx: (R() - .3) * .01, vy: -(.02 + R() * .04), l: 0, L: 2 + R() * 3 }; };
        for (i = 0; i < 60; i++) { var j = s.nova(); j.l = R() * j.L; s.jiskry.push(j); }
      },
      krok: function (s, dt, t) {
        s.lode.forEach(function (l) { l.x += l.vx * dt; l.y += l.vy * dt; l.f += dt * 3; if (l.y > .62) { l.x = .3 + R() * .33; l.y = .27 + R() * .04; } });
        s.jiskry.forEach(function (j, i) { j.x += j.vx * dt + Math.sin(t * 2 + i) * .0004; j.y += j.vy * dt; j.l += dt; if (j.l > j.L) s.jiskry[i] = s.nova(); });
      },
      kresli: function (s, fx, P, z, k) {
        s.lode.forEach(function (l) {
          var p = P(l.x, l.y), al = Math.min(1, (l.y - .27) * 12) * Math.min(1, (.62 - l.y) * 10) * .75;
          fx.fillStyle = 'rgba(25,18,16,' + al + ')'; fx.beginPath(); fx.ellipse(p[0], p[1], Math.max(.5, 1.1 * l.s * z * k), Math.max(.4, .65 * l.s * z * k), .5, 0, 7); fx.fill();
          if (Math.sin(l.f) > .92) { fx.fillStyle = 'rgba(255,120,60,' + al * .8 + ')'; fx.fillRect(p[0] - .5 * k, p[1] - .5 * k, Math.max(1, k), Math.max(1, k)); }
        });
        fx.globalCompositeOperation = 'lighter';
        s.jiskry.forEach(function (j) { zar(fx, P(j.x, j.y), Math.max(1, 1.3 * z * k), Math.sin(Math.PI * j.l / j.L), '255,210,140', '255,90,20'); });
        fx.globalCompositeOperation = 'source-over';
      }
    },

    'dite-z-marsu': {
      cam: function () { return [.33, .45, .06, 50]; },
      fs: 'o+=m.r*(vec2(fb(u*vec2(4.,6.)+vec2(t*.03,0.)),fb(u*vec2(4.,6.)+vec2(5.,t*.02)))-.5)*.012+m.r*vec2(-.002*sin(t*.1),0.);' +
        'o+=m.g*(vec2(n(u*vec2(70.,30.)+vec2(0.,-t*1.6)),n(u*vec2(60.,40.)+vec2(4.,-t*1.3)))-.5)*.0025;' +
        'vec3 col=texture2D(I,u+o).rgb;float gx=fract(t/14.)*2.2-.6;' +
        'col+=vec3(1.,.95,.85)*exp(-pow((u.x+u.y*.5-gx-.3)/.04,2.))*m.b*.16;col*=1.+.03*sin(t*.4);gl_FragColor=vec4(col,1.);}',
      init: function (s) {
        var Z = [[481, 172, 1], [585, 205, .6], [836, 192, .8], [903, 168, 1]].map(function (a) { return { x: a[0] / 960, y: a[1] / 540, s: a[2] }; });
        Z.push({ x: 622 / 960, y: 458 / 540, s: .7, hrnek: 1 });
        s.puf = function (z) { return { z: z, x: z.x + (R() - .5) * .003, y: z.y, vx: z.hrnek ? (R() - .5) * .004 : .004 + R() * .004, vy: -(z.hrnek ? .012 + R() * .01 : .008 + R() * .008), r: (z.hrnek ? 2 : 3) * z.s, l: 0, L: z.hrnek ? 2.5 + R() * 1.5 : 4 + R() * 3 }; };
        s.pary = []; Z.forEach(function (z) { for (var i = 0; i < 14; i++) { var q = s.puf(z); q.l = R() * q.L; s.pary.push(q); } });
        prach(s, 45, .35, .6, .05, .65);
      },
      krok: function (s, dt, t) {
        s.pary.forEach(function (q, i) { q.x += q.vx * dt + (q.z.hrnek ? Math.sin(t * 3 + i) * .0006 : 0); q.y += q.vy * dt; q.l += dt; if (q.l > q.L) s.pary[i] = s.puf(q.z); });
        prachKrok(s, dt, t);
      },
      kresli: function (s, fx, P, z, k) {
        s.pary.forEach(function (q) {
          var e = q.l / q.L, al = Math.sin(Math.PI * Math.min(1, e * 1.4)) * (q.z.hrnek ? .28 : .5) * (1 - e);
          zar(fx, P(q.x, q.y), Math.max(1.5, q.r * (1 + e * 3.5) * z * k), al, '245,245,248', '245,245,248');
        });
        prachKresli(s, fx, P, z, k, .5);
      }
    },

    /* Pád Calibanu (obrázek CIG): R = ohně, G = kouř na obloze, B = světla v dálce. Padá popel. */
    'pad-calibanu': {
      cam: function () { return [.55, .45, .05, 45]; },
      fs: 'vec2 q=u*vec2(5.,6.)+vec2(t*.03,-t*.02);o+=m.g*(vec2(fb(q),fb(q+5.1))-.5)*.016;' +
        'float hf=texture2D(M,u+vec2(0.,.06)).r;o+=hf*(vec2(n(u*vec2(90.,40.)+vec2(0.,-t*3.)),n(u*vec2(80.,60.)+vec2(3.,-t*2.5)))-.5)*.005;' +
        'vec3 col=texture2D(I,u+o).rgb;vec4 m2=texture2D(M,u+o);' +
        'float fl=fb(u*vec2(50.,30.)+vec2(0.,-t*2.6))*.9+.25*sin(t*12.+u.x*90.);' +
        'col+=col*m2.r*(fl-.35)*1.1+vec3(1.,.45,.12)*m2.r*max(fl-.3,0.)*.3;col+=col*m.b*(tw(u)-.4);' +
        'col+=vec3(.06,.05,.05)*fb(u*vec2(3.,5.)+vec2(-t*.05,t*.02))*smoothstep(.2,.7,u.y)*.6;' +
        'gl_FragColor=vec4(col,1.);}',
      init: function (s) {
        var Z = [[880, 35], [462, 128], [185, 20], [410, 315], [850, 280]].map(function (a) { return [a[0] / 1118, a[1] / 351]; });
        s.nova = function () { var o = Z[(R() * Z.length) | 0]; return { x: o[0] + (R() - .5) * .02, y: o[1], vx: (R() - .3) * .01, vy: -(.03 + R() * .05), l: 0, L: 1.5 + R() * 2.5 }; };
        s.jiskry = []; for (var i = 0; i < 40; i++) { var j = s.nova(); j.l = R() * j.L; s.jiskry.push(j); }
        s.popel = []; for (i = 0; i < 90; i++) s.popel.push({ x: R(), y: R(), vx: .01 + R() * .015, vy: .02 + R() * .03, s: .5 + R() * 1.2, f: R() * 7, sv: R() < .3 });
      },
      krok: function (s, dt, t) {
        s.jiskry.forEach(function (j, i) { j.x += j.vx * dt; j.y += j.vy * dt; j.l += dt; if (j.l > j.L) s.jiskry[i] = s.nova(); });
        s.popel.forEach(function (a) { a.x += (a.vx + Math.sin(t + a.f) * .004) * dt; a.y += a.vy * dt; a.f += dt; if (a.y > 1.02 || a.x > 1.02) { a.x = R() * 1.1 - .1; a.y = -.02; } });
      },
      kresli: function (s, fx, P, z, k) {
        s.popel.forEach(function (a) {
          var p = P(a.x, a.y); fx.fillStyle = a.sv ? 'rgba(170,165,160,.35)' : 'rgba(20,18,18,.55)';
          fx.save(); fx.translate(p[0], p[1]); fx.rotate(a.f); fx.fillRect(-a.s * k, -a.s * k * .5, Math.max(1, a.s * 2 * k), Math.max(.6, a.s * k)); fx.restore();
        });
        fx.globalCompositeOperation = 'lighter';
        s.jiskry.forEach(function (j) { zar(fx, P(j.x, j.y), Math.max(1, 1.3 * z * k), Math.sin(Math.PI * j.l / j.L), '255,210,140', '255,90,20'); });
        fx.globalCompositeOperation = 'source-over';
      }
    },

    /* Goodman (obrázek CIG): G = hvězdy, R = vyznačená trasa a popisky. */
    goodman: {
      cam: function () { return [.4, .55, .05, 50]; },
      fs: 'vec3 col=texture2D(I,u).rgb;col+=col*m.g*(tw(u)-.3)*1.5;' +
        'float puls=.5+.5*sin(t*1.6-u.x*6.);col+=vec3(.6,.85,1.)*m.r*puls*.35;' +
        'col+=vec3(.5,.7,1.)*exp(-(pow((u.x-.7675)/.03,2.)+pow((u.y-.7464)/.07,2.)))*(.15+.15*sin(t*.9));' +
        'col+=vec3(.15,.2,.35)*fb(u*vec2(3.,4.)+vec2(t*.03,0.))*.12;gl_FragColor=vec4(col,1.);}',
      init: function (s) { prach(s, 25, 0, 1, 0, 1); },
      krok: prachKrok,
      kresli: function (s, fx, P, z, k) { prachKresli(s, fx, P, z, k, .3); }
    }
  };

  /* ---------- sdílený WebGL ---------- */
  var glc = document.createElement('canvas'), g = glc.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!g) return;
  var programy = {}, buf = null;
  function shader(typ, src) { var x = g.createShader(typ); g.shaderSource(x, src); g.compileShader(x); return x; }
  function program(jm) {
    if (programy[jm] !== undefined) return programy[jm];
    var p = g.createProgram();
    g.attachShader(p, shader(g.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0,1);}'));
    g.attachShader(p, shader(g.FRAGMENT_SHADER, HLAVA + SCENY[jm].fs));
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) return (programy[jm] = null);
    var u = {}; ['t', 'sd', 'cam', 'cr', 'I', 'M', 'eA', 'eB', 'eC'].forEach(function (k) { u[k] = g.getUniformLocation(p, k); });
    if (!buf) { buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW); }
    return (programy[jm] = { p: p, u: u, a: g.getAttribLocation(p, 'p') });
  }
  function textura(im) {
    var x = g.createTexture(); g.bindTexture(g.TEXTURE_2D, x);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, im);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    return x;
  }
  function nahraj(src) { return new Promise(function (ok, chyba) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = chyba; i.src = src; }); }

  /* ---------- obrázky na stránce ---------- */
  var ZAKLAD = (document.querySelector('script[src*="zivy-obraz.js"]') || {}).src || '';
  ZAKLAD = ZAKLAD.replace(/assets\/js\/zivy-obraz\.js.*$/, '');
  var polozky = [], aktivni = [];
  function cesta(src) { try { var p = new URL(src, location.href).pathname; var i = p.indexOf('/assets/'); return i < 0 ? null : p.slice(i); } catch (e) { return null; } }

  function priprav(img) {
    if (img.__zivy) return;
    var c = cesta(img.currentSrc || img.src), def = c && SEZNAM[c];
    if (!def || !SCENY[def.s]) return;
    img.__zivy = 1;
    var pol = { img: img, def: def, sc: SCENY[def.s], sd: R(), s: {}, tp: R() * 30, vidim: false, cv: null, nacteno: null };
    pol.sc.init(pol.s, pol);
    polozky.push(pol);
    pozoruj.observe(img);
  }
  function vytvorPlatno(pol) {
    var img = pol.img, rodic = img.parentNode;
    if (getComputedStyle(rodic).position === 'static') rodic.style.position = 'relative';
    var cv = document.createElement('canvas'); cv.className = 'zivy-platno'; cv.setAttribute('aria-hidden', 'true'); cv.style.position = 'absolute'; cv.style.pointerEvents = 'none';
    var st = getComputedStyle(img); cv.style.borderRadius = st.borderRadius;
    rodic.insertBefore(cv, img.nextSibling);
    pol.cv = cv; pol.ctx = cv.getContext('2d');
    if (img.offsetWidth >= 480) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'zivy-pauza';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); prepni(); });
      rodic.insertBefore(b, cv.nextSibling); pol.btn = b;
    }
    popisTlacitek();
  }
  function umistiTlacitko(pol) {
    if (pol.btn) { pol.btn.style.left = (pol.img.offsetLeft + 8) + 'px'; pol.btn.style.top = (pol.img.offsetTop + 8) + 'px'; }
  }
  function rozmer(pol) {
    var img = pol.img, w = img.offsetWidth, h = img.offsetHeight;
    if (!w || !h) return false;
    var cv = pol.cv, st = cv.style;
    st.left = img.offsetLeft + 'px'; st.top = img.offsetTop + 'px'; st.width = w + 'px'; st.height = h + 'px';
    umistiTlacitko(pol);
    var d = Math.min(1.5, window.devicePixelRatio || 1), W = Math.min(1600, Math.round(w * d)), H = Math.round(W * h / w);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var iw = pol.nacteno.iw, ih = pol.nacteno.ih, fit = getComputedStyle(img).objectFit, ra = w / h, ri = iw / ih, sx = 1, sy = 1;
    if (fit === 'cover') { if (ra > ri) sy = ri / ra; else sx = ra / ri; }
    pol.cr = [(1 - sx) / 2, (1 - sy) / 2, sx, sy];
    return true;
  }
  function nacti(pol) {
    if (pol.nacteno || pol.nacita) return;
    pol.nacita = 1;
    Promise.all([nahraj(pol.img.currentSrc || pol.img.src), nahraj(ZAKLAD + pol.def.m.slice(1))]).then(function (I) {
      pol.nacteno = { I: textura(I[0]), M: textura(I[1]), iw: I[0].naturalWidth, ih: I[0].naturalHeight };
      pol.nacita = 0; if (!pol.cv) vytvorPlatno(pol); spust();
    }).catch(function () { pol.nacita = 0; pol.chyba = 1; });
  }
  function uvolni(pol) {
    if (!pol.nacteno) return;
    g.deleteTexture(pol.nacteno.I); g.deleteTexture(pol.nacteno.M); pol.nacteno = null;
    if (pol.ctx) pol.ctx.clearRect(0, 0, pol.cv.width, pol.cv.height);
    if (pol.cv) pol.cv.classList.remove('zivy-bezi');
  }
  var pozoruj = new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) {
      var pol = polozky.filter(function (p) { return p.img === z.target; })[0]; if (!pol) return;
      pol.vidim = z.isIntersecting && z.target.offsetWidth >= 200;
      if (pol.vidim && !stop && !pol.chyba) nacti(pol);
    });
    aktivni = polozky.filter(function (p) { return p.vidim; });
    polozky.forEach(function (p) { if (!p.vidim && p.nacteno && aktivni.length + 6 < polozky.filter(function (q) { return q.nacteno; }).length) uvolni(p); });
    spust();
  }, { rootMargin: '150px' });

  function efekty(pol) {
    if (pol.E) return pol.E;
    var a = new Float32Array(32), b = new Float32Array(32), c = new Float32Array(32);
    ((pol.def.k && pol.def.k.ef) || []).slice(0, 8).forEach(function (e, i) {
      a.set([e[1], e[2], e[3], e[4]], i * 4); b.set([e[0], e[5], e[6], e[7]], i * 4); c.set([e[8], e[9], e[10], 0], i * 4);
    });
    return (pol.E = [a, b, c]);
  }

  /* ---------- smyčka ---------- */
  var bezi = false, last = 0;
  function spust() { if (!bezi && !stop && aktivni.length) { bezi = true; last = 0; requestAnimationFrame(snimek); } }
  function snimek(now) {
    if (stop || !aktivni.length || document.hidden) { bezi = false; return; }
    var dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
    aktivni.forEach(function (pol) {
      if (!pol.nacteno || !pol.cv || pol.img.offsetParent === null || !rozmer(pol)) return;
      var pr = program(pol.def.s); if (!pr) return;
      var W = pol.cv.width, H = pol.cv.height;
      if (glc.width < W) glc.width = W; if (glc.height < H) glc.height = H;
      pol.tp += dt; var t = pol.tp, cm = pol.sc.cam(pol.sd, pol.def.k), z = 1.02 + cm[2] * (.5 - .5 * Math.cos(t * Math.PI * 2 / cm[3])), cr = pol.cr;
      if (pol.sc.pan) { var ph = Math.sin(t * Math.PI * 2 / (cm[3] * 1.7)); cm = [cm[0] + pol.sc.pan * ph, cm[1] + pol.sc.pan * .4 * Math.cos(t * Math.PI * 2 / (cm[3] * 2.3)), cm[2], cm[3]]; }
      g.useProgram(pr.p); g.bindBuffer(g.ARRAY_BUFFER, buf); g.enableVertexAttribArray(pr.a); g.vertexAttribPointer(pr.a, 2, g.FLOAT, false, 0, 0);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, pol.nacteno.I); g.uniform1i(pr.u.I, 0);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, pol.nacteno.M); g.uniform1i(pr.u.M, 1);
      g.uniform1f(pr.u.t, t); g.uniform1f(pr.u.sd, pol.sd); g.uniform3f(pr.u.cam, cm[0], cm[1], z); g.uniform4f(pr.u.cr, cr[0], cr[1], cr[2], cr[3]);
      if (pr.u.eA) { var E = efekty(pol); g.uniform4fv(pr.u.eA, E[0]); g.uniform4fv(pr.u.eB, E[1]); g.uniform4fv(pr.u.eC, E[2]); }
      g.viewport(0, 0, W, H); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      var fx = pol.ctx; fx.clearRect(0, 0, W, H); fx.drawImage(glc, 0, glc.height - H, W, H, 0, 0, W, H);
      pol.sc.krok(pol.s, dt, t);
      var k = W / (pol.nacteno.iw * cr[2]) * (pol.nacteno.iw / 960);
      pol.sc.kresli(pol.s, fx, function (x, y) { return [(((x - cm[0]) * z + cm[0]) - cr[0]) / cr[2] * W, (((y - cm[1]) * z + cm[1]) - cr[1]) / cr[3] * H]; }, z, k);
      if (!pol.cv.classList.contains('zivy-bezi')) pol.cv.classList.add('zivy-bezi');
    });
    requestAnimationFrame(snimek);
  }

  /* ---------- pauza (platí pro celý web) ---------- */
  function popisTlacitek() {
    polozky.forEach(function (p) {
      if (!p.btn) return;
      p.btn.textContent = stop ? '▶' : '❚❚';
      p.btn.setAttribute('aria-label', stop ? 'Rozpohybovat obrázky' : 'Zastavit pohyb obrázků');
    });
  }
  function prepni() {
    stop = !stop; try { localStorage.setItem(KLIC, stop ? '1' : '0'); } catch (e) {}
    polozky.forEach(function (p) { if (p.cv) p.cv.classList.toggle('zivy-stop', stop); if (!stop && p.vidim) nacti(p); });
    popisTlacitek(); spust();
  }
  /* Když je pohyb vypnutý, ukážeme aspoň tlačítko u velkých obrázků, aby šel zase zapnout. */
  function tlacitkaBezPohybu() {
    if (!stop) return;
    polozky.forEach(function (p) { if (!p.cv && p.img.offsetWidth >= 480) { vytvorPlatno(p); p.cv.classList.add('zivy-stop'); umistiTlacitko(p); } });
  }

  document.addEventListener('visibilitychange', spust);
  function start() {
    document.querySelectorAll('img').forEach(priprav);
    tlacitkaBezPohybu();
    new MutationObserver(function (m) {
      m.forEach(function (z) { z.addedNodes.forEach(function (n) { if (n.nodeType !== 1) return; if (n.tagName === 'IMG') priprav(n); else if (n.querySelectorAll) n.querySelectorAll('img').forEach(priprav); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
