#!/usr/bin/env python3
"""Vytvoří masky pro „živé obrázky“ a seznam assets/zive/seznam.js.
Obecná maska (scéna 'zakladni'):  R = plápolající světla/oheň, G = třpytivé body (hvězdy, světla), B = 0.
Ruční masky (letka, dite-z-marsu, pad-calibanu, goodman) se nepřepisují, pokud existují.
Spuštění: python3 nastroje/zive_masky.py"""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zive_osoby import OSOBY, CHRAN, prevod
from PIL import ImageDraw
import numpy as np
from PIL import Image, ImageFilter

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOREN)
VYNECHAT = set()
MW, MH = 480, 270


def nacti(f):
    a = np.asarray(Image.open(f).convert('RGB').resize((MW * 2, MH * 2), Image.LANCZOS)).astype(float)
    return a[..., 0], a[..., 1], a[..., 2]


def uloz(kanaly, cil):
    ch = [Image.fromarray((np.clip(k, 0, 1) * 255).astype('uint8')).resize((MW, MH), Image.LANCZOS) for k in kanaly]
    os.makedirs(os.path.dirname(cil), exist_ok=True)
    Image.merge('RGB', ch).save(cil, optimize=True)


def blur(m, r):
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(r))).astype(float) / 255


def body(R, G, B):
    """Izolované jasné body (hvězdy, vzdálená světla). Čáry a lemy oblečení se vyřadí,
    protože u nich je vždy aspoň jeden soused stejně jasný."""
    L = (R + G + B) / 3
    sous = np.zeros_like(L)
    for dy, dx in [(-3, 0), (3, 0), (0, -3), (0, 3), (-2, -2), (2, 2), (-2, 2), (2, -2)]:
        sous = np.maximum(sous, np.roll(np.roll(L, dy, 0), dx, 1))
    okoli = np.asarray(Image.fromarray(L.astype('uint8')).filter(ImageFilter.GaussianBlur(8))).astype(float)
    m = np.clip((L - sous - 14) / 35, 0, 1) * np.clip((L - 110) / 60, 0, 1) * np.clip((95 - okoli) / 40, 0, 1)
    return blur(m, .8)


def ohen(R, G, B):
    L = (R + G + B) / 3
    m = np.clip((R - 200) / 40, 0, 1) * np.clip((R - B - 100) / 50, 0, 1) * np.clip((L - 130) / 50, 0, 1)
    return blur(m, 2)


def povoleni(R, G, B, jm):
    """B kanál: kde se smí obraz deformovat (mraky, voda, vír). Chrání ostré hrany a ruční oblasti."""
    H, W = R.shape
    L = (R + G + B) / 3
    Ls = np.asarray(Image.fromarray(L.astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))).astype(float)
    gy, gx = np.gradient(Ls)
    hrany = np.clip((np.hypot(gx, gy) - 6) / 8, 0, 1)
    hrany = np.asarray(Image.fromarray((hrany * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4))).astype(float) / 255
    m = 1 - hrany
    k = OSOBY.get(jm, {})
    vir = Image.new('L', (W, H), 0); dv = ImageDraw.Draw(vir)
    for e in k.get('ef', []):
        if e[0] == 'vir':
            x0, y0, x1, y1 = e[1]; dv.ellipse([x0 * W, y0 * H, x1 * W, y1 * H], fill=255)
    m = np.maximum(m, np.asarray(vir).astype(float) / 255)
    ch = Image.new('L', (W, H), 0); dc = ImageDraw.Draw(ch)
    for c in CHRAN.get(jm, []):
        if isinstance(c, tuple):
            dc.rectangle([c[0] * W, c[1] * H, c[2] * W, c[3] * H], fill=255)
        else:
            dc.polygon([(x * W, y * H) for x, y in c], fill=255)
    ch = np.asarray(ch.filter(ImageFilter.GaussianBlur(5))).astype(float) / 255
    return blur(m * (1 - ch), 2)


def obecna(f, cil, jm=None):
    R, G, B = nacti(f)
    uloz([ohen(R, G, B), body(R, G, B), povoleni(R, G, B, jm) if jm in OSOBY else np.zeros_like(R)], cil)


def pad_calibanu(f, cil):
    R, G, B = nacti(f)
    H, W = R.shape
    yy = np.arange(H)[:, None] * np.ones((1, W))
    L = (R + G + B) / 3
    fire = np.clip((R - 150) / 60, 0, 1) * np.clip((R - B - 50) / 50, 0, 1)
    smoke = np.clip(1 - yy / (H * .5), 0, 1) * np.clip((110 - L) / 60, 0, 1)
    uloz([blur(fire, 3), blur(smoke, 8), body(R, G, B)], cil)


def goodman(f, cil):
    R, G, B = nacti(f)
    L = (R + G + B) / 3
    sat = (np.max([R, G, B], 0) - np.min([R, G, B], 0))
    cary = np.clip((L - 170) / 50, 0, 1) * np.clip((40 - sat) / 30, 0, 1)
    uloz([blur(cary, 1.5), body(R, G, B) + blur(np.clip((L - 150) / 60, 0, 1) * np.clip((sat - 40) / 40, 0, 1), 1), np.zeros_like(R)], cil)


SPECIALNI = {'pad-calibanu': pad_calibanu, 'goodman': goodman}
seznam = {}
for f in sorted(glob.glob('assets/kapitoly/*.webp')):
    jm = os.path.basename(f)[:-5]
    cil = f'assets/zive/{jm}-maska.png'
    if jm in SPECIALNI:
        SPECIALNI[jm](f, cil)
    elif not os.path.exists(cil):
        obecna(f, cil)
    seznam['/' + f] = {'s': jm if jm in ('ztracena-letka', 'dite-z-marsu', 'pad-calibanu', 'goodman') else 'zakladni', 'm': f'/{cil}'}
for f in sorted(glob.glob('assets/osoby/*.webp')):  # rasy se neanimují (přání Daniela)
    jm = os.path.basename(f)[:-5]
    if jm in VYNECHAT:
        continue
    slozka = f.split('/')[1]
    cil = f'assets/zive/{slozka}/{jm}.png'
    obecna(f, cil, jm)
    if jm in OSOBY:
        seznam['/' + f] = {'s': 'osoba', 'm': '/' + cil, 'k': prevod(OSOBY[jm])}
    else:
        print('Bez ručního nastavení (obecný pohyb):', jm)
        seznam['/' + f] = {'s': 'zakladni', 'm': '/' + cil}
with open('assets/zive/seznam.js', 'w') as o:
    o.write('/* Vytvořeno nastroje/zive_masky.py – neupravovat ručně. */\nwindow.ZIVE_SEZNAM=' + json.dumps(seznam, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(seznam), 'obrázků')
