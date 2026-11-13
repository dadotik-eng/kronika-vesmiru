#!/usr/bin/env python3
"""Strojová kontrola obsahu Hvězdné kroniky (běží u každé žádosti o změnu od bota).

Kontroluje soubory v _kapitoly, _osoby, _udalosti, _zasobnik a _data:
  - žádné HTML, skripty ani podezřelé odkazy (bot smí psát jen čistý text),
  - platná hlavička (front matter) a povinná pole,
  - období (obdobi) jen z _data/ery.yml, roky jako čísla,
  - shoda let s tím, co už na webu je (stejná událost / osoba nesmí mít jiný rok),
  - jména v textu, která chybí v rejstříku výslovnosti (jen upozornění).

Použití:  python3 nastroje/kontrola.py [--ostry] [soubory…]   (bez souborů zkontroluje vše)
  --ostry = pravidla ostrého webu (main): každá kapitola musí mít overeni: OK.
Návratový kód 1 = chyba (žádost o změnu se nesmí schválit), 0 = v pořádku.
"""
import glob, os, re, sys, yaml

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOREN)

OSTRY = '--ostry' in sys.argv
if OSTRY: sys.argv.remove('--ostry')
chyby, varovani = [], []
def chyba(soubor, zprava): chyby.append(f"CHYBA  {soubor}: {zprava}")
def varuj(soubor, zprava): varovani.append(f"POZOR  {soubor}: {zprava}")

HTML = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
NEBEZPECNE = re.compile(r"javascript:|data:text/html|on[a-z]+\s*=|<\s*script|<\s*iframe|\{%|\{\{", re.I)
POVINNE = {
    '_osoby': ['jmeno', 'role', 'kategorie', 'medailonek', 'obdobi'],
    '_udalosti': ['rok', 'titul', 'text'],
    '_kapitoly': ['title', 'herni_rok'],
    '_zasobnik': [],
    '_encyklopedie': ['nazev', 'sekce', 'perex'],
    '_rasy': ['nazev', 'perex', 'biologie'],
}
ERY = {e['id'] for e in yaml.safe_load(open('_data/ery.yml', encoding='utf-8'))} | {'mimo'}   # mimo = mimo lidské dějiny (xi’anští císaři…)

def nacti(soubor):
    s = open(soubor, encoding='utf-8').read()
    if not s.startswith('---'):
        return None, s
    casti = s.split('---', 2)
    if len(casti) < 3:
        return None, s
    return yaml.safe_load(casti[1]) or {}, casti[2]

def projdi_text(soubor, hodnota, kde):
    if isinstance(hodnota, dict):
        for k, v in hodnota.items(): projdi_text(soubor, v, f"{kde}.{k}")
    elif isinstance(hodnota, list):
        for i, v in enumerate(hodnota): projdi_text(soubor, v, f"{kde}[{i}]")
    elif isinstance(hodnota, str):
        if NEBEZPECNE.search(hodnota):
            chyba(soubor, f"nebezpečný obsah v {kde}: {NEBEZPECNE.search(hodnota).group(0)!r}")
        elif HTML.search(hodnota):
            chyba(soubor, f"HTML značka v {kde}: {HTML.search(hodnota).group(0)!r} – bot smí psát jen čistý text")
        if kde.endswith('url') and hodnota and not hodnota.startswith('https://'):
            chyba(soubor, f"odkaz {kde} musí začínat https://")

def zkontroluj(soubor):
    slozka = soubor.split('/')[0]
    try:
        fm, telo = nacti(soubor)
    except yaml.YAMLError as e:
        chyba(soubor, f"neplatná hlavička YAML: {e}"); return None
    if fm is None:
        chyba(soubor, "chybí hlavička (--- … ---)"); return None
    projdi_text(soubor, fm, 'hlavička')
    projdi_text(soubor, telo, 'text')
    for pole in POVINNE.get(slozka, []):
        if fm.get(pole) in (None, ''):
            chyba(soubor, f"chybí povinné pole '{pole}'")
    if slozka == '_kapitoly':
        for pr in fm.get('prameny') or []:
            if isinstance(pr, dict) and not pr.get('url'):
                varovani.append(f"UPOZORNĚNÍ  {soubor}: pramen '{pr.get('nazev')}' nemá odkaz (url)")
    if slozka == '_kapitoly' and fm.get('overeni') not in (None, 'OK', 'neověřeno'):
        chyba(soubor, f"pole 'overeni' musí být OK nebo neověřeno, je {fm.get('overeni')!r}")
    if OSTRY and slozka == '_kapitoly' and fm.get('overeni') != 'OK':
        chyba(soubor, "na ostrý web smí jen ověřená kapitola (overeni: OK) – zůstává v betě, dokud ji Daniel neověří")
    if 'obdobi' in fm and fm['obdobi'] not in ERY:
        chyba(soubor, f"neznámé období '{fm['obdobi']}' (povolené: {', '.join(sorted(ERY))})")
    for pole in ('rok', 'herni_rok', 'rad'):
        if slozka == '_zasobnik': break   # v zásobníku je rok jen orientační text („2792–2800“, „neuvedeno“)
        if pole in fm and not isinstance(fm[pole], (int, float)):
            chyba(soubor, f"pole '{pole}' musí být číslo, je {fm[pole]!r}")
    return fm

def main():
    soubory = [s for s in sys.argv[1:] if s.endswith('.md') and s.split('/')[0] in POVINNE] or \
              [s for d in POVINNE for s in sorted(glob.glob(f'{d}/*.md'))]
    for s in sys.argv[1:]:
        if s.endswith(('.yml', '.yaml')) and s.startswith('_data/'):
            try: projdi_text(s, yaml.safe_load(open(s, encoding='utf-8')), 'data')
            except yaml.YAMLError as e: chyba(s, f"neplatný YAML: {e}")
    nove = {s: zkontroluj(s) for s in soubory if os.path.exists(s)}

    # Shoda let: stejný titul události / stejné jméno osoby nesmí mít jiný rok než ostatní soubory.
    vse = {}
    for d in ('_udalosti', '_osoby'):
        for s in glob.glob(f'{d}/*.md'):
            try: fm, _ = nacti(s)
            except yaml.YAMLError: continue
            if fm: vse[s] = fm
    for s, fm in nove.items():
        if not fm: continue
        if s.startswith('_udalosti/'):
            for jiny, f2 in vse.items():
                if jiny != s and jiny.startswith('_udalosti/') and f2.get('titul') == fm.get('titul') and int(float(f2.get('rok', 0))) != int(float(fm.get('rok', 0))):
                    chyba(s, f"událost '{fm.get('titul')}' má rok {fm.get('rok')}, ale {jiny} uvádí {f2.get('rok')}")
        if s.startswith('_osoby/'):
            for jiny, f2 in vse.items():
                if jiny != s and jiny.startswith('_osoby/') and f2.get('jmeno') == fm.get('jmeno'):
                    chyba(s, f"osoba '{fm.get('jmeno')}' už existuje v {jiny}")

    # Jména bez výslovnosti (jen upozornění pro Režiséra)
    rejstrik = ' '.join(str(x.get('psano', '')) for x in yaml.safe_load(open('_data/vyslovnost.yml', encoding='utf-8')))
    for s, fm in nove.items():
        if not fm or not s.startswith('_kapitoly/'): continue
        _, telo = nacti(s)
        for slovo in sorted(set(re.findall(r"\b[A-Z][a-z]*[A-Z]?[a-z]+(?:[’'][A-Z]?[a-z]+)?\b", telo))):
            if re.search(r'[wqxWQX]|th|sh|ck|ee|oo|ou|ay|ey', slovo) and slovo[:4] not in rejstrik:
                varuj(s, f"cizí jméno bez výslovnosti v rejstříku: {slovo}")

    for r in chyby + varovani: print(r)
    print(f"\nZkontrolováno souborů: {len(nove)} · chyb: {len(chyby)} · upozornění: {len(varovani)}")
    sys.exit(1 if chyby else 0)

if __name__ == '__main__':
    main()
