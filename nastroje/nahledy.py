#!/usr/bin/env python3
"""Vyrobí náhledové karty (1200×630 JPEG) pro sdílení odkazů na sociálních sítích.

Pro každou osobnost, heslo encyklopedie, rasu, kapitolu a kapitolu Dějin vznikne
assets/nahledy/<klic>.jpg, plus obecná karta webu (web.jpg). Karta se přegeneruje
jen tehdy, když se změnil její obsah (otisk je v assets/nahledy/otisky.json).

Spouští se z kořene repozitáře:  python3 nastroje/nahledy.py
(GitHub Action „Náhledy“ to dělá sama po každé změně obsahu na main.)
"""
import hashlib
import json
import random
import re
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFilter, ImageFont

KOREN = Path(__file__).resolve().parent.parent
CIL = KOREN / 'assets' / 'nahledy'
PISMA = KOREN / 'assets' / 'fonts'
SIRKA, VYSKA = 1200, 630
VERZE = '2'  # změna vzhledu → zvýšit, aby se přegenerovalo všechno

POZADI = (7, 15, 31)
TEXT = (240, 245, 247)
TLUMENE = (179, 196, 212)
AKCENT = (246, 189, 75)


# ---------- písma (sady latin + latin-ext jsou ve zvláštních souborech) ----------
class Pismo:
    def __init__(self, nazev, rez, velikost):
        self.sady = [ImageFont.truetype(str(PISMA / f'{nazev}-{s}-{rez}.woff2'), velikost)
                     for s in ('latin', 'latin-ext')]
        self.velikost = velikost
        self._prazdne = [self._maska(f, '') for f in self.sady]
        self._cache = {}

    @staticmethod
    def _maska(f, z):
        m = f.getmask(z)
        return (m.size, bytes(m))

    def pro_znak(self, z):
        if z in self._cache:
            return self._cache[z]
        vyber = self.sady[-1]
        if z.isspace():
            vyber = self.sady[0]
        else:
            for f, prazdna in zip(self.sady, self._prazdne):
                if self._maska(f, z) != prazdna:
                    vyber = f
                    break
        self._cache[z] = vyber
        return vyber

    def sirka(self, text):
        return sum(self.pro_znak(z).getlength(z) for z in text)

    def kresli(self, d, xy, text, barva):
        x, y = xy
        for z in text:
            f = self.pro_znak(z)
            d.text((x, y), z, font=f, fill=barva)
            x += f.getlength(z)


def zalom(pismo, text, max_sirka, max_radku):
    slova, radky, radek = text.split(), [], ''
    for s in slova:
        zkus = (radek + ' ' + s).strip()
        if pismo.sirka(zkus) <= max_sirka:
            radek = zkus
        else:
            if radek:
                radky.append(radek)
            radek = s
    if radek:
        radky.append(radek)
    if len(radky) > max_radku:
        radky = radky[:max_radku]
        while radky[-1] and pismo.sirka(radky[-1] + '…') > max_sirka:
            radky[-1] = radky[-1].rsplit(' ', 1)[0] if ' ' in radky[-1] else radky[-1][:-1]
        radky[-1] = radky[-1].rstrip(',;:—– ') + '…'
    return radky


def hex_rgb(h, vychozi=AKCENT):
    try:
        h = h.strip().lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return vychozi


# ---------- kresba karty ----------
def pozadi(seed):
    img = Image.new('RGB', (SIRKA, VYSKA), POZADI)
    # jemný přechod do modra vpravo nahoře
    gr = Image.new('L', (SIRKA, VYSKA))
    gd = ImageDraw.Draw(gr)
    for i in range(0, 700, 4):
        gd.ellipse((SIRKA - 300 - i, -300 - i, SIRKA + 300 + i, 300 + i), fill=max(0, 70 - i // 10))
    img = Image.composite(Image.new('RGB', img.size, (18, 53, 95)), img, gr.filter(ImageFilter.GaussianBlur(60)))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(140):
        x, y = rnd.randrange(SIRKA), rnd.randrange(VYSKA)
        b = rnd.randint(90, 230)
        if x < 1060 and 140 < y < 510:
            b = b // 3  # pod textem jen slabé hvězdy
        r = rnd.choice((0, 0, 0, 1))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(b, b, min(255, b + 15)))
    return img


def karta(klic, stitek, nazev, perex, barva, obrazek=None):
    img = pozadi(klic)
    sirka_textu = 1040
    if obrazek and obrazek.exists():
        il = Image.open(obrazek).convert('RGB')
        w = 560
        h = int(il.height * w / il.width)
        if h < VYSKA:
            h = VYSKA
            w = int(il.width * h / il.height)
        il = il.resize((w, h), Image.LANCZOS)
        il = il.crop(((w - 560) // 2, (h - VYSKA) // 2, (w - 560) // 2 + 560, (h - VYSKA) // 2 + VYSKA))
        maska = Image.new('L', (560, VYSKA))
        md = ImageDraw.Draw(maska)
        for x in range(560):
            md.line((x, 0, x, VYSKA), fill=int(255 * min(1, x / 260)))
        img.paste(il, (SIRKA - 560, 0), maska)
        sirka_textu = 620
    d = ImageDraw.Draw(img)
    # zlatý rámeček a barevný pruh období
    d.rectangle((24, 24, SIRKA - 25, VYSKA - 25), outline=AKCENT + (0,), width=2)
    d.rectangle((64, 150, 70, 150 + 110), fill=barva)

    Pismo('cinzel', '700-normal', 26).kresli(d, (64, 64), 'HVĚZDNÁ KRONIKA', AKCENT)
    p_st = Pismo('saira-condensed', '600-normal', 30)
    p_st.kresli(d, (92, 150), stitek.upper(), barva)

    p_n = Pismo('cinzel', '700-normal', 64 if len(nazev) < 28 else 52)
    radky = zalom(p_n, nazev, sirka_textu - 92, 2)
    y = 196
    for r in radky:
        p_n.kresli(d, (92, y), r, TEXT)
        y += int(p_n.velikost * 1.18)

    if perex:
        p_p = Pismo('spectral', '400-normal', 30)
        y += 18
        for r in zalom(p_p, perex, sirka_textu - 92, 4 if len(radky) == 1 else 3):
            p_p.kresli(d, (92, y), r, TLUMENE)
            y += 42

    Pismo('saira-condensed', '400-normal', 24).kresli(
        d, (64, VYSKA - 70), 'Česká kronika dějin vesmíru · z oficiálních pramenů', TLUMENE)
    return img


# ---------- data ----------
def front_matter(p):
    t = p.read_text(encoding='utf-8')
    m = re.match(r'---\s*\n(.*?)\n---', t, re.S)
    return (yaml.safe_load(m.group(1)) if m else {}) or {}


def ciste(t):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>|\*\*|__', '', str(t or ''))).strip()


def polozky():
    ery = {e['id']: e for e in yaml.safe_load((KOREN / '_data/ery.yml').read_text(encoding='utf-8'))}
    ery_nazev = {e['nazev']: e for e in ery.values()}
    out = []
    for p in sorted((KOREN / '_osoby').glob('*.md')):
        fm, slug = front_matter(p), p.stem
        era = ery.get(fm.get('obdobi'))
        il = KOREN / 'assets/osoby' / f'{slug}.webp' if fm.get('ilustrace') else None
        out.append(dict(klic=f'osoby-{slug}', stitek='Osobnost' + (f' · {era["nazev"]}' if era else ''),
                        nazev=fm.get('jmeno', slug), perex=ciste(fm.get('role')),
                        barva=hex_rgb(era['barva']) if era else AKCENT, obrazek=il))
    sekce = {'korporace': 'Společnost', 'svatky': 'Svátek', 'pojmy': 'Pojem'}
    for p in sorted((KOREN / '_encyklopedie').glob('*.md')):
        fm = front_matter(p)
        out.append(dict(klic=f'encyklopedie-{p.stem}',
                        stitek='Encyklopedie · ' + (fm.get('stitek') or sekce.get(fm.get('sekce'), 'Heslo')),
                        nazev=fm.get('nazev', p.stem), perex=ciste(fm.get('perex')), barva=AKCENT, obrazek=None))
    for p in sorted((KOREN / '_rasy').glob('*.md')):
        fm = front_matter(p)
        ob = fm.get('obrazek')
        out.append(dict(klic=f'rasy-{p.stem}', stitek='Mimozemská rasa', nazev=fm.get('nazev', p.stem),
                        perex=ciste(fm.get('perex')), barva=hex_rgb(fm.get('barva', '#f6bd4b')),
                        obrazek=(KOREN / ob.lstrip('/')) if ob else None))
    for p in sorted((KOREN / '_kapitoly').glob('*.md')):
        fm = front_matter(p)
        era = ery.get(fm.get('obdobi')) or ery_nazev.get(fm.get('era'))
        out.append(dict(klic=f'kapitoly-{p.stem}',
                        stitek='Kapitola' + (f' · rok {fm["herni_rok"]}' if fm.get('herni_rok') else ''),
                        nazev=fm.get('title', p.stem), perex=ciste(fm.get('popis')),
                        barva=hex_rgb(era['barva']) if era else AKCENT, obrazek=None))
    for k in yaml.safe_load((KOREN / '_data/dejiny.yml').read_text(encoding='utf-8')):
        era = ery.get(k.get('obdobi')) or ery_nazev.get(k.get('era'))
        out.append(dict(klic=f'dejiny-{k["hraj"]}', stitek=f'Dějiny · {k.get("rim", "")}. kapitola · {k.get("rozpeti", "")}',
                        nazev=k['title'], perex=ciste(era['nazev'] if era else k.get('era')),
                        barva=hex_rgb(era['barva']) if era else AKCENT, obrazek=None))
    out.append(dict(klic='web', stitek='Kronika dějin vesmíru', nazev='Hvězdná kronika',
                    perex='Od terraformace Marsu po válku s Vanduuly – kapitoly, osobnosti, '
                          'časová osa a encyklopedie, vyprávěné česky z oficiálních pramenů.',
                    barva=AKCENT, obrazek=None))
    return out


def otisk(pol):
    data = {k: v for k, v in pol.items() if k != 'obrazek'}
    data['v'] = VERZE
    h = hashlib.sha1(json.dumps(data, ensure_ascii=False, sort_keys=True, default=str).encode())
    ob = pol.get('obrazek')
    if ob and Path(ob).exists():
        h.update(Path(ob).read_bytes())
    return h.hexdigest()[:16]


def main():
    CIL.mkdir(parents=True, exist_ok=True)
    soubor_otisku = CIL / 'otisky.json'
    otisky = json.loads(soubor_otisku.read_text()) if soubor_otisku.exists() else {}
    nove, platne = 0, set()
    for pol in polozky():
        klic = pol['klic']
        platne.add(klic)
        o = otisk(pol)
        cesta = CIL / f'{klic}.jpg'
        if otisky.get(klic) == o and cesta.exists():
            continue
        karta(klic, pol['stitek'], pol['nazev'], pol['perex'], pol['barva'], pol['obrazek']).save(
            cesta, 'JPEG', quality=84, optimize=True, progressive=True)
        otisky[klic] = o
        nove += 1
    # karty smazaných stránek uklidit
    for p in CIL.glob('*.jpg'):
        if p.stem not in platne:
            p.unlink()
            otisky.pop(p.stem, None)
    soubor_otisku.write_text(json.dumps(dict(sorted(otisky.items())), indent=0, ensure_ascii=False) + '\n')
    print(f'Náhledy: {nove} nových nebo změněných, celkem {len(platne)}.')


if __name__ == '__main__':
    sys.exit(main())
