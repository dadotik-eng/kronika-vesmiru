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
    geo['perry'] = PERRY
    (KOREN / 'data').mkdir(exist_ok=True)
    (KOREN / 'data/mapa.json').write_text(json.dumps(geo, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Mapa: {len(geo["soustavy"])} soustav, {len(geo["skoky"])} skoků, {propojeno} soustav propojeno s kronikou.')


if __name__ == '__main__':
    main()
