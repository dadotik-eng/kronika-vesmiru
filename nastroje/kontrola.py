#!/usr/bin/env python3
"""Strojová kontrola obsahu Hvězdné kroniky (běží u každé žádosti o změnu od bota).

Kontroluje soubory v _kapitoly, _osoby, _udalosti, _zasobnik a _data:
  - žádné HTML, skripty ani podezřelé odkazy (bot smí psát jen čistý text),
  - platná hlavička (front matter) a povinná pole,
  - období (obdobi) jen z _data/ery.yml, roky jako čísla,
  - shoda let s tím, co už na webu je (stejná událost / osoba nesmí mít jiný rok),
  - jména v textu, která chybí v rejstříku výslovnosti (jen upozornění),
  - formát v2 (claude/format-zaznamu.md): zdroje {record_key, typ, nazev, url, hash} jen z povolených domén,
    record_key sedí s adresou, žádný zdroj dvakrát; obdobi / soustava / vazby odkazují na existující záznamy.
    Staré názvy polí (era, system, prameny) jsou v betě upozornění, na ostrém webu chyba.

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
import json
SOUSTAVY = set(json.load(open('_data/soustavy.json', encoding='utf-8'))) if os.path.exists('_data/soustavy.json') else set()
ID = {d: {os.path.basename(s)[:-3] for s in glob.glob(f'_{d}/*.md')} for d in ('osoby', 'rasy', 'udalosti', 'kapitoly', 'encyklopedie')}
PREDPONY = {'galactapedia', 'commlink', 'system', 'object', 'location', 'scwiki'}
POVOLENE = re.compile(r'^https://(?:robertsspaceindustries\.com/|web\.archive\.org/web/\d+/https?://(?:www\.)?robertsspaceindustries\.com/)')
TYPY_KAPITOL = {'kronika', 'dramatizace', 'dokument'}
STARA_POLE = {'era': 'obdobi (id období)', 'system': 'soustava (kód ze Star Map)', 'prameny': 'zdroje'}

def zkontroluj_zdroje(soubor, zdroje):
    videne = set()
    for i, z in enumerate(zdroje or []):
        if not isinstance(z, dict):
            chyba(soubor, f"zdroj {i + 1} není položka {{record_key, typ, nazev, url}}"); continue
        url, klic = z.get('url') or z.get('rsi_url') or '', z.get('record_key')
        if 'rsi_url' in z:
            (chyba if OSTRY else varuj)(soubor, f"zdroj {i + 1}: pole rsi_url → url (formát v2)")
        if url and not POVOLENE.match(url):
            chyba(soubor, f"zdroj {i + 1}: nepovolená doména ({url[:60]}) – jen robertsspaceindustries.com nebo archivní kopie RSI na web.archive.org")
        if not klic:
            (chyba if OSTRY else varuj)(soubor, f"zdroj {i + 1} ({z.get('nazev')}): chybí record_key")
        else:
            predpona, _, ident = str(klic).partition(':')
            if predpona not in PREDPONY or not ident:
                chyba(soubor, f"zdroj {i + 1}: neplatný record_key {klic!r}")
            elif url and predpona in ('galactapedia', 'commlink') and ident not in url:
                chyba(soubor, f"zdroj {i + 1}: record_key {klic} nesedí s adresou {url[:70]}")
        for k in (klic, url):
            if k and k in videne: chyba(soubor, f"zdroj {k} je uvedený dvakrát")
            if k: videne.add(k)

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
    for stare, nove in STARA_POLE.items():
        if stare in fm and (slozka != '_osoby' or stare != 'era'):
            (chyba if OSTRY else varuj)(soubor, f"staré pole '{stare}' → {nove} (formát v2)")
    if slozka == '_zasobnik' and 'era' in fm:
        pass
    zkontroluj_zdroje(soubor, fm.get('zdroje') or fm.get('prameny'))
    for z in fm.get('zdroje') or fm.get('prameny') or []:
        if isinstance(z, dict) and not (z.get('url') or z.get('rsi_url')):
            varovani.append(f"UPOZORNĚNÍ  {soubor}: zdroj '{z.get('nazev')}' nemá odkaz (url)")
    if fm.get('soustava') and SOUSTAVY and fm['soustava'] not in SOUSTAVY:
        chyba(soubor, f"neznámá soustava '{fm['soustava']}' (kód ze Star Map, např. CALIBAN)")
    vazby = fm.get('vazby') or {}
    if not isinstance(vazby, dict):
        chyba(soubor, "vazby musí být {osoby: [...], systemy: [...], rasy: [...], udalosti: [...]}"); vazby = {}
    for druh, seznam in vazby.items():
        platne = SOUSTAVY if druh == 'systemy' else ID.get(druh)
        if platne is None:
            chyba(soubor, f"neznámý druh vazby '{druh}' (osoby, systemy, rasy, udalosti)"); continue
        for x in seznam or []:
            if platne and x not in platne:
                chyba(soubor, f"vazba {druh}: '{x}' neexistuje")
    if slozka == '_kapitoly':
        if fm.get('typ') and fm['typ'] not in TYPY_KAPITOL:
            chyba(soubor, f"typ kapitoly musí být {', '.join(sorted(TYPY_KAPITOL))}, je {fm['typ']!r}")
        if OSTRY:
            for pole in ('id', 'typ', 'obdobi'):
                if not fm.get(pole): chyba(soubor, f"chybí pole '{pole}' (formát v2)")
            if fm.get('id') and fm['id'] != os.path.basename(soubor)[:-3]:
                chyba(soubor, f"id '{fm['id']}' se musí shodovat s názvem souboru")
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
    if not sys.argv[1:] or '_data/dejiny.yml' in sys.argv[1:]:
        for k in yaml.safe_load(open('_data/dejiny.yml', encoding='utf-8')):
            kde = f"_data/dejiny.yml ({k.get('hraj')})"
            if (OSTRY or 'obdobi' in k) and k.get('obdobi') not in ERY: chyba(kde, f"neznámé období {k.get('obdobi')!r}")
            if 'era' in k or 'prameny' in k: (chyba if OSTRY else varuj)(kde, "staré pole era/prameny (formát v2)")
            zkontroluj_zdroje(kde, k.get('zdroje') or k.get('prameny'))

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
