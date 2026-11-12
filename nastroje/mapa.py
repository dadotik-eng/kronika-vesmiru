#!/usr/bin/env python3
"""Sestaví data Hvězdné mapy (data/mapa.json).

Vstupy:
- nastroje/mapa_soustavy.json – poloha, příslušnost a skoky soustav (výtah ze Star Map, archiv Archiváře)
- _data/mapa_popisy.yml        – krátké české popisy soustav
- obsah kroniky (kapitoly, Dějiny, události, osobnosti, hesla, rasy) – hledá, kde se která soustava zmiňuje

Spouští se z kořene repozitáře:  python3 nastroje/mapa.py
(GitHub Action „Náhledy“ ho po změně obsahu na main spouští také.)
"""
import json
import re
from pathlib import Path

import yaml

KOREN = Path(__file__).resolve().parent.parent
PISMENO = 'A-Za-zÀ-ž'

# Názvy, které mají i jiný význam (loď, osoba, slovo) – počítají se jen se slovem „soustava“ poblíž.
NEJEDNOZNACNE = {
    'MIN', 'NUL', 'TAL', 'OSO', 'KINS', 'ODIN', 'CANO', 'KIEL', 'NEMO', 'CROSHAW', 'BAKER', 'HADRIAN',
    'MAGNUS', 'ELLIS', 'GOSS', 'HORUS', 'HELIOS', 'ORION', 'INDRA', 'GENESIS', 'VECTOR', 'VIKING', 'VOLT',
    'VOODOO', 'VULTURE', 'VANGUARD', 'VERITAS', 'VIRGO', 'VESPER', 'VAGABOND', 'VENDETTA', 'VERMILION',
    'SOL', 'CHRONOS', 'CATHCART', 'BRANAUGH', 'TAMSA', 'ELLIS', 'KILIAN', 'LEIR', 'FERRON', 'OSIRIS', 'ELYSIUM', 'BANSHEE', 'NEXUS', 'TYROL', 'CENTAURI', 'BACCHUS',
}


# Perryho linie – osm sporných soustav za studené války s Xi'any (Galactapedie: Perry Line).
PERRY = ['GURZIL', 'HORUS', 'OYA', 'TOHIL', 'HADUR', 'INDRA', 'PALLAS', 'VIRTUS']

# Dějiny na mapě: rok, kdy lidstvo soustavu objevilo (Galactapedie „System“ / Star Map),
# u soustav Banu a Xi'anů rok prvního kontaktu. None = rok neznámý.
OBJEV = {
    'SOL': 2075, 'CROSHAW': 2271, 'RHETOR': 2287, 'NUL': 2290, 'CALIBAN': 2341, 'NEMO': 2362, 'CENTAURI': 2365,
    'VEGA': 2402, 'VIRGIL': 2412, 'DAVIEN': 2430, 'CATHCART': 2438, 'BREMEN': 2441, 'NEXUS': 2445, 'COREL': 2449,
    'FERRON': 2460, 'CANO': 2463, 'FORA': 2463, 'KILIAN': 2463, 'MIN': 2473, 'TIBER': 2474, 'TARANIS': 2478,
    'ORETANI': 2481, 'IDRIS': 2493, 'PYRO': 2493, 'MAGNUS': 2499, 'HADES': 2515, 'TERRA': 2516, 'BAKER': 2522,
    'HADUR': 2529, 'HELIOS': 2529, 'CHARON': 2538, 'GURZIL': 2539, 'CASTRA': 2544, 'NYX': 2582, 'LEIR': 2677,
    'TOHIL': 2716, 'GARRON': 2784, 'OSIRIS': 2788, 'KELLOG': 2811, 'GENESIS': 2812, 'TYROL': 2823, 'STANTON': 2851,
    'OSO': 2861, 'KALLIS': 2921, 'TAMSA': 2943,
}
KONTAKT = {'banu': 2438, 'xian': 2530}      # soustavy Banu a Xi'anů lidstvo zná od prvního kontaktu
ZTRACENO = {'ORION': 2712, 'TIBER': 2736, 'VIRGIL': 2737, 'CALIBAN': 2884}   # padly Vanduulům
POSTOUPENO = {'HADUR': 2793, 'INDRA': 2793, 'PALLAS': 2793, 'VIRTUS': 2793}  # Pakt o Perryho linii → Xi'ani
MILNIKY = [
    [2075, 'Začíná lidské dobývání Sluneční soustavy.'],
    [2125, 'Tragédie na Marsu – zhroutí se rozestavěná atmosféra.'],
    [2271, 'Nick Croshaw objevuje první skokový bod – lidstvo opouští Sol.'],
    [2380, 'Vznikají Spojené národy Země; Project Far Star žene průzkum dál.'],
    [2438, 'První kontakt: Banu v soustavě Davien.'],
    [2530, 'První setkání s Xi\'any v soustavě Pallas – začíná studená válka.'],
    [2542, 'Generál Armistead Perry zavádí Perryho linii – osm sporných soustav.'],
    [2546, 'Ivar Messer se chápe moci – začíná éra Messerů.'],
    [2681, 'Vanduulové vypálí kolonii na Armitage v Orionu.'],
    [2712, 'Vanduulská invaze – UEE se vzdává Orionu.'],
    [2736, 'Po letech obléhání padá Tiber.'],
    [2737, 'Vanduulové plení Virgil; Vega se ocitá na hranici.'],
    [2792, 'Masakr na Garronu II svrhne Messery.'],
    [2793, 'Pakt o Perryho linii: polovina soustav připadá Xi\'anům.'],
    [2851, 'Objev soustavy Stanton – později ji vláda prodá korporacím.'],
    [2884, 'Pád Calibanu.'],
    [2945, 'Vanduulové útočí na Vegu II.'],
    [2956, 'Dnešek kroniky.'],
]

# Ruční doplnění tam, kde se jméno soustavy kryje se jménem osoby (text ho nedokáže odlišit).
DOPLNIT = {
    'CROSHAW': ['/dejiny/kap-2/', '/osobnosti/nick-croshaw/'],
}


def front_matter(p):
    t = p.read_text(encoding='utf-8')
    m = re.match(r'---\s*\n(.*?)\n---\s*\n?(.*)', t, re.S)
    if not m:
        return {}, t
    return (yaml.safe_load(m.group(1)) or {}), m.group(2)


def varianty(s):
    """Tvary názvu, pod kterými se soustava může v textu objevit."""
    jm = {s['nazev']}
    m = re.match(r"^(.*?)\s*\((.*?)\)$", s['nazev'])
    if m:
        jm |= {m.group(1), m.group(2)}
    jm.add(s['kod'].replace('_', '').title())
    return {j.strip() for j in jm if len(j.strip()) >= 3}


def vzor(jmeno):
    """Regulární výraz pro název včetně českých pádových koncovek (Caliban → Calibanu, Vega → Vegy)."""
    if jmeno[-1].lower() in 'aeiouy' and len(jmeno) >= 4:
        kmen, konc = jmeno[:-1], '(?:[aeiouyáéěíóúůý]m?|ou)'   # Vega → Vegy, Vegou; Pyro → Pyru, Pyrem
    else:
        kmen, konc = jmeno, '[a-zá-ž]{0,3}'                   # Caliban → Calibanu, Calibanem
    return re.compile(rf'(?<![{PISMENO}]){re.escape(kmen)}{konc}(?![{PISMENO}])')


def zminky(s, text):
    if not text:
        return False
    if s['kod'] == 'SOL' and re.search(r'Sluneční soustav', text):
        return True
    for j in varianty(s):
        for m in vzor(j).finditer(text):
            if s['kod'] not in NEJEDNOZNACNE:
                return True
            okoli = text[max(0, m.start() - 40):m.start()]
            if re.search(r'soustav\w*\s+(?:\S+\s+){0,3}$', okoli, re.I):
                return True
    return False


def obsah():
    """Všechny texty kroniky: (druh, titulek, url, rok, text)."""
    out = []
    for p in sorted((KOREN / '_kapitoly').glob('*.md')):
        fm, telo = front_matter(p)
        out.append(('kapitola', fm.get('title', p.stem), f'/kapitoly/{p.stem}/', fm.get('herni_rok'),
                    ' '.join([str(fm.get('system') or ''), str(fm.get('popis') or ''), telo])))
    texty = yaml.safe_load((KOREN / '_data/texty.yml').read_text(encoding='utf-8')) or {}
    for k in yaml.safe_load((KOREN / '_data/dejiny.yml').read_text(encoding='utf-8')):
        t = texty.get(k['hraj'])
        t = json.dumps(t, ensure_ascii=False) if t else ''
        out.append(('dejiny', f'{k.get("rim", "")}. {k["title"]}', f'/dejiny/{k["hraj"]}/', k.get('herni_rok'), t))
    for p in sorted((KOREN / '_udalosti').glob('*.md')):
        fm, telo = front_matter(p)
        out.append(('udalost', fm.get('titul', p.stem), f'/casova-osa/#{p.stem}', fm.get('rok'),
                    f"{fm.get('titul', '')} {fm.get('text', '')} {telo}"))
    for p in sorted((KOREN / '_osoby').glob('*.md')):
        fm, telo = front_matter(p)
        out.append(('osoba', fm.get('jmeno', p.stem), f'/osobnosti/{p.stem}/', fm.get('rad'),
                    f"{fm.get('medailonek', '')} {telo}"))
    for p in sorted((KOREN / '_encyklopedie').glob('*.md')):
        fm, telo = front_matter(p)
        out.append(('heslo', fm.get('nazev', p.stem), f'/encyklopedie/{p.stem}/', None, f"{fm.get('perex', '')} {telo}"))
    for p in sorted((KOREN / '_rasy').glob('*.md')):
        fm, telo = front_matter(p)
        out.append(('rasa', fm.get('nazev', p.stem), f'/rasy/{p.stem}/', None,
                    f"{fm.get('domov', '')} {fm.get('perex', '')} {fm.get('biologie', '')} {telo}"))
    return out


def cislo(r):
    try:
        return float(str(r).split()[0])
    except Exception:
        return 9999


def main():
    geo = json.loads((KOREN / 'nastroje/mapa_soustavy.json').read_text(encoding='utf-8'))
    popisy = yaml.safe_load((KOREN / '_data/mapa_popisy.yml').read_text(encoding='utf-8')) or {}
    texty = obsah()
    LIMIT = {'kapitola': 20, 'dejiny': 10, 'udalost': 10, 'osoba': 10, 'heslo': 8, 'rasa': 7}
    propojeno = 0
    for s in geo['soustavy']:
        s['popis'] = popisy.get(s['kod'], '')
        nalez = {}
        for druh, titul, url, rok, text in texty:
            if zminky(s, text) or url in DOPLNIT.get(s['kod'], []):
                nalez.setdefault(druh, []).append({'t': titul, 'u': url, 'r': rok})
        for druh, sez in nalez.items():
            if druh in ('udalost', 'osoba', 'kapitola'):
                sez.sort(key=lambda x: cislo(x['r']))
            for x in sez:
                if x['r'] is None or druh not in ('udalost',):
                    x.pop('r', None)
            nalez[druh] = sez[:LIMIT[druh]]
        s['kronika'] = nalez
        if nalez:
            propojeno += 1
    telesa = json.loads((KOREN / 'nastroje/mapa_telesa.json').read_text(encoding='utf-8'))
    CESKY = {'Mercury': 'Merkur', 'Venus': 'Venuše', 'Earth': 'Země', 'Uranus': 'Uran', 'Neptune': 'Neptun',
             'Ganymede': 'Ganymedes', 'Luna': 'Měsíc'}
    for s in geo['soustavy']:
        tl = telesa.get(s['kod'])
        if tl:
            for pl in tl['planety']:
                pl['n'] = CESKY.get(pl['n'], pl['n'])
                pl['m'] = sorted(CESKY.get(m, m) for m in pl['m'])
            s['telesa'] = tl
    geo['perry'] = PERRY
    geo['milniky'] = MILNIKY
    for s in geo['soustavy']:
        s['objeven'] = OBJEV.get(s['kod']) or KONTAKT.get(s['frakce'])
        if s['kod'] in ZTRACENO:
            s['ztraceno'] = ZTRACENO[s['kod']]
        if s['kod'] in POSTOUPENO:
            s['postoupeno'] = POSTOUPENO[s['kod']]
    # obrácený rejstřík pro odkazy „Na hvězdné mapě“ na ostatních stránkách: url → [[kód, název], …]
    rejstrik = {}
    for s in geo['soustavy']:
        kratky = re.sub(r'\s*\(.*\)$', '', s['nazev'])
        for sez in s['kronika'].values():
            for x in sez:
                rejstrik.setdefault(x['u'], []).append([s['kod'], kratky])
    rejstrik = {u: v[:5] for u, v in sorted(rejstrik.items())}
    (KOREN / '_data/mapa_odkazy.json').write_text(json.dumps(rejstrik, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
    (KOREN / 'data').mkdir(exist_ok=True)
    (KOREN / 'data/mapa.json').write_text(json.dumps(geo, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Mapa: {len(geo["soustavy"])} soustav, {len(geo["skoky"])} skoků, {propojeno} soustav propojeno s kronikou.')


if __name__ == '__main__':
    main()
