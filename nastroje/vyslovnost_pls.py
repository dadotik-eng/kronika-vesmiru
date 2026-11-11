#!/usr/bin/env python3
"""Vyrobí ze _data/vyslovnost.yml slovník výslovnosti pro ElevenLabs (.pls, alias pravidla).

Použití:  python3 nastroje/vyslovnost_pls.py > vyslovnost.pls
Soubor pak nahraj v ElevenLabs (Pronunciation dictionaries) nebo ho pošli přes API.
Skloňované tvary se generují z nejčastějších českých koncovek, nepravidelné bere z pole `tvary`.
"""
import sys, yaml
from xml.sax.saxutils import escape

KONCOVKY = ['', 'a', 'u', 'em', 'e', 'ovi', 'ové', 'ů', 'ům', 'y', 'ech', 'ská', 'ský', 'ské', 'ského', 'skou', 'ští']

def lexemy(zaznam):
    psano, cti = str(zaznam['psano']), str(zaznam['cti'])
    if zaznam.get('cele') or ' ' in psano:
        yield psano, cti
    else:
        for k in KONCOVKY:
            yield psano + k, cti + k
            if psano[0].isupper():
                yield (psano[0].lower() + psano[1:] + k), (cti[0].lower() + cti[1:] + k)
    for a, b in (zaznam.get('tvary') or {}).items():
        yield a, b

def main():
    data = yaml.safe_load(open('_data/vyslovnost.yml', encoding='utf-8'))
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon" alphabet="ipa" xml:lang="cs-CZ">']
    videno = set()
    # delší výrazy první – ElevenLabs bere první shodu
    pary = sorted((p for z in data for p in lexemy(z)), key=lambda p: -len(p[0]))
    for g, a in pary:
        if g in videno or g == a:
            continue
        videno.add(g)
        out.append(f'  <lexeme><grapheme>{escape(g)}</grapheme><alias>{escape(a)}</alias></lexeme>')
    out.append('</lexicon>')
    sys.stdout.write('\n'.join(out) + '\n')

if __name__ == '__main__':
    main()
