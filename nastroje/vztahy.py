#!/usr/bin/env python3
"""Sestaví data pro Síť osobností (data/vztahy.json).

Vazba vznikne, když medailonek nebo text „Podrobněji“ jedné osobnosti jmenuje jinou osobnost.
U každé vazby se uloží věta, ve které zmínka stojí (aby šla na webu ověřit), a hrubý typ
podle slov ve větě: rodina, protivník, nástupnictví, jinak spolupráce / souvislost.
Polohy uzlů se počítají předem: vodorovně podle roku (pole `rad`), svisle silovým rozložením.

Spouští se z kořene repozitáře:  python3 nastroje/vztahy.py
(GitHub Action „Náhledy“ ho po změně obsahu na main spouští také.)
"""
import json
import math
import random
import re
from pathlib import Path

import yaml

KOREN = Path(__file__).resolve().parent.parent
P = 'A-Za-zÀ-ž'
TYPY = [
    ('rodina', r'\b(syn|syna|synem|synovi|dcer\w*|otc\w*|otec|matk\w*|matce|bratr\w*|sestr\w*|manžel\w*|vnuk\w*|vnučk\w*|děd\w*|babičk\w*|strýc\w*|synov\w*|neteř\w*|potom\w*|sňat\w*|vdov\w*|švagr\w*|rodič\w*|dvojč\w*|sourozen\w*)\b'),
    ('protivnik', r'\b(zabil\w*|zavraždil\w*|vražd\w*|otrávil\w*|svrhl\w*|porazil\w*|proti|obvinil\w*|zatkl\w*|popravil\w*|soupeř\w*|nepřít\w*|zradil\w*|odsoudil\w*|vzbouř\w*|pronásled\w*|uvěznil\w*|zajal\w*|sesadil\w*)\b'),
    ('nastupce', r'\b(nástupc\w*|předchůdc\w*|vystřídal\w*|nahradil\w*|převzal\w*|na trůn\w*|po smrti)\b'),
]
NAZVY_TYPU = {'rodina': 'Rodina', 'spoluprace': 'Spolupráce', 'protivnik': 'Protivníci a spory', 'nastupce': 'Nástupnictví', 'vliv': 'Vliv a inspirace', 'souvislost': 'Souvislost'}


def front_matter(p):
    t = p.read_text(encoding='utf-8')
    m = re.match(r'---\s*\n(.*?)\n---\s*\n?(.*)', t, re.S)
    return ((yaml.safe_load(m.group(1)) or {}), m.group(2)) if m else ({}, t)


def ciste(t):
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', str(t or ''))
    t = re.sub(r'[#*_>`]', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def kmen(w):
    return w[:-1] if len(w) > 4 and w[-1].lower() in 'aeiouyáéíóúůý' else w


def vzory(o, prijmeni_pocet, mista):
    """Celé jméno se skloňováním; „Jméno VI.“ u panovníků; samotné příjmení jen tehdy,
    když je mezi osobnostmi jedinečné a nejde zároveň o název soustavy nebo planety."""
    cela = o['jmeno'].replace('.', '').split()
    slova = [w for w in cela if not re.fullmatch(r'[IVXL]+', w)]
    cislo = next((w for w in cela if re.fullmatch(r'[IVXL]+', w)), None)
    out = []
    if cislo and slova:
        out.append((re.escape(kmen(slova[0])) + r'[a-záčďéěíňóřšťúůýž]{0,3}\s+' + cislo + r'\.', True))
    if len(slova) >= 2:
        out.append((r'\s+'.join(re.escape(kmen(w)) + r'[a-záčďéěíňóřšťúůýž]{0,3}' for w in slova), True))
        pr = slova[-1]
        if prijmeni_pocet.get(pr, 0) == 1 and len(pr) >= 4 and pr.lower() not in mista:
            out.append((re.escape(kmen(pr)) + r'[a-záčďéěíňóřšťúůýž]{0,3}', False))
    elif slova and len(slova[0]) >= 5:
        out.append((re.escape(kmen(slova[0])) + r'[a-záčďéěíňóřšťúůýž]{0,3}', True))
    return [(re.compile(rf'(?<![{P}]){v}(?![{P}])'), plne) for v, plne in out]


def vety(text):
    return [v.strip() for v in re.split(r'(?<=[.!?…])\s+(?=[A-ZÁ-Ž„“"])', text) if v.strip()]


def typ_vety(v):
    for t, r in TYPY:
        if re.search(r, v, re.I):
            return t
    return 'spoluprace'


def pasy(osoby, ery):
    """Vodorovná osa po obdobích: každé období má šířku podle počtu osob, uvnitř se řadí podle roku."""
    poradi = ['mimo'] + [e['id'] for e in ery]
    pocet = {k: sum(1 for o in osoby if o['obdobi'] == k) for k in poradi}
    out, x = [], 0.0
    for k in poradi:
        if not pocet[k]:
            continue
        sirka = 160 + 55 * pocet[k] ** 0.8
        cleni = [o for o in osoby if o['obdobi'] == k]
        lo, hi = min(o['rok'] for o in cleni), max(o['rok'] for o in cleni)
        e = next((e for e in ery if e['id'] == k), None)
        if e:
            lo, hi = min(lo, e['od']), max(hi, e['do'])
        for o in cleni:
            o['x'] = round(x + 50 + (o['rok'] - lo) / max(1, hi - lo) * (sirka - 100), 1)
        out.append({'id': k, 'nazev': e['nazev'] if e else 'Xi’anské dějiny', 'barva': e['barva'] if e else '#6fd3a0',
                    'rozsah': (e.get('rozsah') or f"{int(e['od'])}–{int(e['do'])}") if e else 'xi’anský letopočet',
                    'x0': round(x, 1), 'x1': round(x + sirka, 1)})
        x += sirka
    return out


def rozlozeni(osoby, vazby):
    """x = období a rok (viz pasy), y = silové rozložení (odpuzování uzlů, pružiny vazeb, slabá gravitace k ose)."""
    rnd = random.Random(42)
    idx = {o['id']: i for i, o in enumerate(osoby)}
    X = [float(o['x']) for o in osoby]
    Y = [rnd.uniform(-1, 1) * 150 for _ in osoby]
    hrany = [(idx[v['a']], idx[v['b']]) for v in vazby]
    for krok in range(600):
        teplota = 6 * (1 - krok / 600) + 0.3
        F = [0.0] * len(osoby)
        for i in range(len(osoby)):
            for j in range(i + 1, len(osoby)):
                dx = (X[i] - X[j]) * 1.0
                if abs(dx) > 140:
                    continue
                dy = Y[i] - Y[j]
                d2 = dx * dx + dy * dy + 1
                f = 40000 / d2
                d = math.sqrt(d2)
                F[i] += f * dy / d
                F[j] -= f * dy / d
        for a, b in hrany:
            dy = Y[b] - Y[a]
            F[a] += dy * 0.04
            F[b] -= dy * 0.04
        for i in range(len(osoby)):
            F[i] -= Y[i] * 0.006
            Y[i] += max(-teplota * 4, min(teplota * 4, F[i]))
    for o, y in zip(osoby, Y):
        o['y'] = round(y, 1)


def main():
    ery = yaml.safe_load((KOREN / '_data/ery.yml').read_text(encoding='utf-8'))
    osoby, texty = [], {}
    for p in sorted((KOREN / '_osoby').glob('*.md')):
        fm, telo = front_matter(p)
        try:
            rok = float(str(fm.get('rad')).split()[0])
        except Exception:
            continue
        osoby.append({'id': p.stem, 'jmeno': fm.get('jmeno', p.stem), 'role': fm.get('role', ''),
                      'obdobi': fm.get('obdobi', ''), 'kategorie': fm.get('kategorie', ''),
                      'narozeni': str(fm.get('narozeni', '') or ''), 'umrti': str(fm.get('umrti', '') or ''),
                      'rok': rok, 'ilustrace': bool(fm.get('ilustrace'))})
        texty[p.stem] = ciste(f"{fm.get('medailonek', '')} {telo}")
    prijmeni = {}
    for o in osoby:
        slova = [w for w in o['jmeno'].replace('.', '').split() if not re.fullmatch(r'[IVXL]+', w)]
        if len(slova) >= 2:
            prijmeni[slova[-1]] = prijmeni.get(slova[-1], 0) + 1
    geo = json.loads((KOREN / 'nastroje/mapa_soustavy.json').read_text(encoding='utf-8'))
    mista = {s['nazev'].lower() for s in geo['soustavy']} | {'perry', 'terra', 'levski', 'orison', 'lorville', 'area18', 'cathcart', 'croshaw'}
    re_osob = {o['id']: vzory(o, prijmeni, mista) for o in osoby}

    par = {}
    for a in osoby:
        for v in vety(texty[a['id']]):
            for b in osoby:
                if b['id'] == a['id']:
                    continue
                shody = [plne for r, plne in re_osob[b['id']] if r.search(v)]
                if not shody:
                    continue
                klic = tuple(sorted((a['id'], b['id'])))
                z = par.setdefault(klic, {'a': klic[0], 'b': klic[1], 'vety': [], 'plne': False})
                z['plne'] = z['plne'] or any(shody)
                if len(z['vety']) < 3 and all(x['v'] != v for x in z['vety']):
                    z['vety'].append({'z': a['id'], 'v': v if len(v) <= 420 else v[:417] + '…'})
    rucne = yaml.safe_load((KOREN / '_data/vztahy.yml').read_text(encoding='utf-8')) or {}
    overene, vyradit = rucne.get('vazby') or {}, set(rucne.get('vyradit') or [])
    vazby = []
    for k, r in overene.items():
        a, b = sorted(k.split('|'))
        par.setdefault((a, b), {'a': a, 'b': b, 'vety': [], 'plne': True})
    for klic, z in par.items():
        k = '|'.join(klic)
        if k in vyradit or klic[0] not in texty or klic[1] not in texty:
            continue
        if k in overene:
            z['typ'], z['popis'] = overene[k]['typ'], overene[k].get('popis', '')
        elif z['plne']:
            z['typ'], z['popis'] = 'souvislost', ''   # zatím neověřeno ručně
            z['neovereno'] = True
        else:
            continue
        z.pop('plne', None)
        vazby.append(z)
    vazby.sort(key=lambda v: (v['a'], v['b']))
    osoby = [o for o in osoby if o['obdobi'] in {e['id'] for e in ery} | {'mimo'}]
    pasma = pasy(osoby, ery)
    rozlozeni(osoby, vazby)
    vystup = {'typy': NAZVY_TYPU, 'pasma': pasma,
              'osoby': osoby, 'vazby': vazby}
    (KOREN / 'data').mkdir(exist_ok=True)
    (KOREN / 'data/vztahy.json').write_text(json.dumps(vystup, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    spojene = {v['a'] for v in vazby} | {v['b'] for v in vazby}
    (KOREN / '_data/vztahy_index.yml').write_text('# Osobnosti, které mají v Síti osobností aspoň jednu vazbu (generuje nastroje/vztahy.py)\n'
                                                 + ''.join(f'- {i}\n' for i in sorted(spojene)), encoding='utf-8')
    pocty = {}
    for v in vazby:
        pocty[v['typ']] = pocty.get(v['typ'], 0) + 1
    print(f'Síť osobností: {len(osoby)} osob, {len(vazby)} vazeb {pocty}, bez vazby {len(osoby) - len(spojene)}.')


if __name__ == '__main__':
    main()
