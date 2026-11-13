#!/usr/bin/env python3
"""Převod obsahu na formát záznamů v2 (viz projekt: claude/format-zaznamu.md).

- zdroje všude ve tvaru {record_key, typ, nazev, url, hash}; u kapitol a Dějin místo `prameny`,
  v zásobníku místo {record_key, rsi_url},
- období jako ID (`obdobi: naprava`) místo českého názvu (`era: Věk nápravy`),
- soustava jako kód Star Map (`soustava: CALIBAN`) místo názvu (`system: Caliban`),
- kapitoly: id, typ, vazby (osoby, systemy, rasy), overeno_kdy / overeno_kym.

Hash = content_hash aktuální verze záznamu v databázi Archiváře (když je databáze k dispozici).
Skript je idempotentní – na už převedený soubor nic nezmění.

Použití: python3 nastroje/prevod_v2.py [--db cesta/k/archivar.sqlite] [soubory…]
"""
import glob, json, os, re, sqlite3, sys, yaml

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(KOREN)

TYP_PODLE_KLICE = {'galactapedia': 'Galactapedie', 'commlink': 'Comm-Link', 'system': 'Star Map',
                   'object': 'Star Map', 'location': 'Star Map', 'scwiki': 'Star Citizen Wiki'}


def record_key(url):
    m = re.search(r'galactapedia/article/([A-Za-z0-9]{10})', url or '')
    if m: return 'galactapedia:' + m.group(1)
    m = re.search(r'comm-link/[^/]+/(\d+)', url or '')
    if m: return 'commlink:' + m.group(1)
    return None


class Archivar:
    def __init__(self, cesta):
        self.db = None
        if cesta and os.path.exists(cesta):
            self.db = sqlite3.connect(f'file:{cesta}?mode=ro', uri=True)

    def zaznam(self, klic):
        if not self.db: return None, None
        r = self.db.execute("""select r.title, v.content_hash from records r
                               left join record_versions v on v.record_key = r.record_key and v.version = r.current_version
                               where r.record_key = ?""", (klic,)).fetchone()
        return r if r else (None, None)


def zdroj_v2(z, arch):
    """Jedna položka zdroje → nový tvar (pořadí klíčů je pevné)."""
    url = z.get('url') or z.get('rsi_url') or ''
    klic = z.get('record_key') or record_key(url)
    titul, hash_ = arch.zaznam(klic) if klic else (None, None)
    out = {}
    if klic: out['record_key'] = klic
    out['typ'] = z.get('typ') or TYP_PODLE_KLICE.get((klic or ':').split(':')[0], 'jiné')
    out['nazev'] = z.get('nazev') or re.sub(r'\s+-\s+Roberts Space Industries$', '', titul or '') or klic
    if url: out['url'] = url
    h = z.get('hash') or hash_
    if h: out['hash'] = h
    return out


def dump(data):
    return yaml.dump(data, allow_unicode=True, sort_keys=False, width=100000, default_flow_style=False)


def rozdel(soubor):
    s = open(soubor, encoding='utf-8').read()
    _, hlava, telo = s.split('---', 2)
    return hlava, telo


def nahrad_blok(hlava, klic, novy_klic, hodnota):
    """Nahradí v textu hlavičky jeden klíč nejvyšší úrovně (s jeho odsazeným obsahem) novým klíčem a hodnotou."""
    radky = hlava.split('\n')
    for i, r in enumerate(radky):
        if r.startswith(klic + ':'):
            j = i + 1
            while j < len(radky) and (radky[j].startswith((' ', '-')) or radky[j] == '' and j < len(radky) - 1 and radky[j + 1].startswith((' ', '-'))):
                j += 1
            nove = dump({novy_klic: hodnota}).rstrip('\n').split('\n')
            return '\n'.join(radky[:i] + nove + radky[j:])
    return hlava


def main():
    args = sys.argv[1:]
    db = None
    if '--db' in args:
        i = args.index('--db'); db = args[i + 1]; del args[i:i + 2]
    arch = Archivar(db)
    ery = yaml.safe_load(open('_data/ery.yml', encoding='utf-8'))
    era_id = {e['nazev']: e['id'] for e in ery}
    era_id.update({'Válka s Vanduuly / současnost': 'valka', 'Před lidskou expanzí': 'mimo'})
    soustavy = json.load(open('data/mapa.json', encoding='utf-8'))['soustavy']
    kod_soustavy = {}
    for s in soustavy:
        kod_soustavy[s['nazev'].lower()] = s['kod']
        kod_soustavy[re.sub(r'\s*\(.*\)$', '', s['nazev']).lower()] = s['kod']
    osoby = {}
    for p in glob.glob('_osoby/*.md'):
        fm = yaml.safe_load(rozdel(p)[0]) or {}
        osoby[fm.get('jmeno', '')] = os.path.basename(p)[:-3]
    rasy = {}
    for p in glob.glob('_rasy/*.md'):
        fm = yaml.safe_load(rozdel(p)[0]) or {}
        rid = os.path.basename(p)[:-3]
        for n in (fm.get('nazev'), fm.get('nazev_en')):
            if n: rasy[n.lower()] = rid

    soubory = args or sorted(glob.glob('_osoby/*.md') + glob.glob('_encyklopedie/*.md') + glob.glob('_rasy/*.md')
                             + glob.glob('_zasobnik/*.md') + glob.glob('_kapitoly/*.md') + ['pribehy-ztracena-letka.html'])
    zmeneno = 0
    for p in soubory:
        slozka = p.split('/')[0]
        hlava, telo = rozdel(p)
        fm = yaml.safe_load(hlava) or {}
        nova = hlava
        if slozka == '_kapitoly':
            nova = kapitola(p, fm, telo, arch, era_id, kod_soustavy, osoby, rasy)
        else:
            if fm.get('prameny') and not fm.get('zdroje'):
                nova = nahrad_blok(nova, 'prameny', 'zdroje', [zdroj_v2(z, arch) for z in fm['prameny']])
            if fm.get('zdroje'):
                nova = nahrad_blok(nova, 'zdroje', 'zdroje', [zdroj_v2(z, arch) for z in fm['zdroje']])
            if 'era' in fm and slozka == '_zasobnik':
                nova = nahrad_blok(nova, 'era', 'obdobi', era_id.get(fm['era'], 'mimo'))
        if nova != hlava:
            open(p, 'w', encoding='utf-8').write('---' + nova + '---' + telo)
            zmeneno += 1

    # Dějiny (_data/dejiny.yml): era → obdobi, prameny → zdroje; úvodní komentář zůstává
    s = open('_data/dejiny.yml', encoding='utf-8').read()
    komentar = ''.join(l for l in s.splitlines(True) if l.startswith('#'))
    komentar = komentar.replace('# era = název období přesně podle _data/ery.yml', '# obdobi = id období z _data/ery.yml; zdroje ve formátu v2 (record_key, typ, nazev, url, hash)')
    dejiny = yaml.safe_load(s)
    if any('era' in k or 'prameny' in k for k in dejiny):
        nove = []
        for k in dejiny:
            n = {}
            for kl, v in k.items():
                if kl == 'era': n['obdobi'] = era_id[v]
                elif kl == 'prameny': n['zdroje'] = [zdroj_v2(z, arch) for z in v]
                else: n[kl] = v
            nove.append(n)
        open('_data/dejiny.yml', 'w', encoding='utf-8').write(komentar + dump(nove))
        zmeneno += 1
    print(f'Převedeno souborů: {zmeneno}' + ('' if arch.db else ' (bez databáze Archiváře – hashe nedoplněny)'))


def obdobi_roku(rok):
    for e in yaml.safe_load(open('_data/ery.yml', encoding='utf-8')):
        if rok is not None and e['od'] <= rok < e['do']: return e['id']
    return 'mimo'


def kapitola(p, fm, telo, arch, era_id, kod_soustavy, osoby, rasy):
    slug = os.path.basename(p)[:-3]
    n = {'id': fm.get('id') or slug}
    for k in ('title', 'date'):
        if k in fm: n[k] = fm[k]
    n['typ'] = fm.get('typ', 'kronika')
    n['herni_rok'] = fm.get('herni_rok')
    n['obdobi'] = fm.get('obdobi') or era_id.get(fm.get('era')) or obdobi_roku(fm.get('herni_rok'))
    sous = fm.get('soustava') or kod_soustavy.get(str(fm.get('system') or '').lower())
    if sous: n['soustava'] = sous
    if 'popis' in fm: n['popis'] = fm['popis']
    vazby = fm.get('vazby') or {}
    if not fm.get('vazby'):
        text = ' '.join([telo] + [str(x) for x in fm.get('stitky') or []])
        vo = [oid for jm, oid in osoby.items() if jm and re.search(r'\b' + re.escape(jm) + r'\b', text)]
        vs = sorted({kod_soustavy[s.lower()] for s in fm.get('stitky') or [] if s.lower() in kod_soustavy} | ({sous} if sous else set()))
        vr = sorted({rid for s in fm.get('stitky') or [] for nazev, rid in rasy.items() if s.lower() == nazev})
        vazby = {k: v for k, v in (('osoby', sorted(vo)), ('systemy', vs), ('rasy', vr)) if v}
    if vazby: n['vazby'] = vazby
    if fm.get('stitky'): n['stitky'] = fm['stitky']
    n['overeni'] = fm.get('overeni', 'neověřeno')
    pozn = str(fm.get('overeni_poznamka') or '')
    if fm.get('overeno_kdy'): n['overeno_kdy'] = fm['overeno_kdy']
    elif n['overeni'] == 'OK':
        m = re.search(r'(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d\d)', pozn)
        n['overeno_kdy'] = f'{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}' if m else str(fm.get('date'))
    if fm.get('overeno_kym'): n['overeno_kym'] = fm['overeno_kym']
    elif n['overeni'] == 'OK':
        n['overeno_kym'] = 'Daniel' if 'Daniel' in pozn else 'Kontrolor'
    if pozn: n['overeni_poznamka'] = pozn
    for k, v in fm.items():   # cokoli dalšího (audio, slug…) zachovat
        if k not in n and k not in ('era', 'system', 'prameny', 'zdroje', 'overeni_poznamka'):
            n[k] = v
    n['zdroje'] = [zdroj_v2(z, arch) for z in (fm.get('zdroje') or fm.get('prameny') or [])]
    return '\n' + dump(n)


if __name__ == '__main__':
    main()
