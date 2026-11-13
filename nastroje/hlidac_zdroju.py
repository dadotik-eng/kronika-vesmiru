#!/usr/bin/env python3
"""Hlídač zdrojů: porovná otisky zdrojů na webu s databází Archiváře.

Každý zdroj na webu (formát v2) nese `hash` = content_hash verze článku, podle které se ověřovalo.
Když má Archivář u téhož record_key jiný aktuální hash, článek se na RSI od ověření změnil
→ hlídač vypíše, které kapitoly / osoby / hesla na něm stojí, aby se daly znovu ověřit.

Seznam zdrojů bere:
  - z ostrého webu (data/zdroje.json) – výchozí; tak běží u Archiváře na Danielově PC, kopie repozitáře není potřeba,
  - nebo z místního repozitáře (--repo) – při vývoji.

Použití:
  python3 hlidac_zdroju.py --db H:/Kronika/Archiv/db/archivar.sqlite
  python3 hlidac_zdroju.py --db archivar.sqlite --repo .          (bez sítě, z místních souborů)
  python3 hlidac_zdroju.py ... --json                              (strojový výstup)

Z Archiváře: from hlidac_zdroju import zkontroluj, report; report(zkontroluj(db_cesta)) → text do Telegramu.
Návratový kód: 0 = vše sedí, 2 = něco ke kontrole.
"""
import glob, json, os, re, sqlite3, sys, urllib.request

WEB = 'https://dadotik-eng.github.io/kronika-vesmiru/'


def zdroje_z_webu(zaklad=WEB):
    req = urllib.request.Request(zaklad + 'data/zdroje.json', headers={'User-Agent': 'HvezdnaKronika-Hlidac/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def zdroje_z_repa(koren):
    import yaml
    out = []
    def fm(p):
        s = open(p, encoding='utf-8').read()
        return yaml.safe_load(s.split('---', 2)[1]) or {} if s.startswith('---') else {}
    for slozka in ('osoby', 'encyklopedie', 'rasy', 'kapitoly', 'zasobnik'):
        for p in sorted(glob.glob(os.path.join(koren, f'_{slozka}', '*.md'))):
            d, slug = fm(p), os.path.basename(p)[:-3]
            titul = d.get('title') or d.get('jmeno') or d.get('nazev') or slug
            for z in d.get('zdroje') or []:
                out.append(dict(z, kde=f'{slozka}/{slug}', titul=titul, odkaz=''))
    for k in yaml.safe_load(open(os.path.join(koren, '_data/dejiny.yml'), encoding='utf-8')):
        for z in k.get('zdroje') or []:
            out.append(dict(z, kde=f"dejiny/{k['hraj']}", titul=k['title'], odkaz=''))
    for p in glob.glob(os.path.join(koren, '*.html')):
        d = fm(p)
        for z in d.get('zdroje') or []:
            out.append(dict(z, kde='stranka/' + os.path.basename(p), titul=d.get('title', ''), odkaz=''))
    return out


def zkontroluj(db_cesta, zdroje=None):
    """Vrátí slovník: zmeneno, odstraneno, nezname, bez_hashe, celkem."""
    if zdroje is None:
        zdroje = zdroje_z_webu()
    db = sqlite3.connect(f'file:{db_cesta}?mode=ro', uri=True)
    def zaznam(klic):
        return db.execute("""select r.title, r.status, r.current_version, v.content_hash, v.fetched_at
                             from records r left join record_versions v
                               on v.record_key = r.record_key and v.version = r.current_version
                             where r.record_key = ?""", (klic,)).fetchone()
    def verze_podle_hashe(klic, h):
        r = db.execute("select version, fetched_at from record_versions where record_key = ? and content_hash = ?", (klic, h)).fetchone()
        return r
    vysledek = {'zmeneno': {}, 'odstraneno': {}, 'nezname': {}, 'bez_hashe': 0, 'celkem': len(zdroje)}
    for z in zdroje:
        klic, h = z.get('record_key'), z.get('hash')
        if not klic:
            continue
        r = zaznam(klic)
        pouziti = {'kde': z.get('kde'), 'titul': z.get('titul'), 'odkaz': z.get('odkaz')}
        if not r:
            vysledek['nezname'].setdefault(klic, {'nazev': z.get('nazev'), 'pouziti': []})['pouziti'].append(pouziti)
            continue
        titul, stav, verze, aktualni, kdy = r
        if stav not in ('active', None):
            vysledek['odstraneno'].setdefault(klic, {'nazev': titul or z.get('nazev'), 'stav': stav, 'pouziti': []})['pouziti'].append(pouziti)
        if not h:
            vysledek['bez_hashe'] += 1
            continue
        if aktualni and aktualni != h:
            puvodni = verze_podle_hashe(klic, h)
            polozka = vysledek['zmeneno'].setdefault(klic, {
                'nazev': titul or z.get('nazev'), 'url': z.get('url'),
                'overeno_proti_verzi': puvodni[0] if puvodni else None,
                'aktualni_verze': verze, 'zmeneno_kdy': kdy, 'pouziti': []})
            polozka['pouziti'].append(pouziti)
    return vysledek


def report(v, max_radku=40):
    radky = []
    if v['zmeneno']:
        radky.append(f"⚠️ Změněné zdroje kroniky: {len(v['zmeneno'])} – tyto záznamy stojí na článku, který se na RSI od ověření změnil:")
        for klic, z in sorted(v['zmeneno'].items(), key=lambda x: x[1]['nazev'] or ''):
            kdy = (z['zmeneno_kdy'] or '')[:10]
            verze = f"v{z['overeno_proti_verzi']} → v{z['aktualni_verze']}" if z['overeno_proti_verzi'] else f"→ v{z['aktualni_verze']}"
            radky.append(f"• {z['nazev']} ({verze}, {kdy})")
            for p in z['pouziti']:
                radky.append(f"    – {p['titul']} [{p['kde']}]")
    if v['odstraneno']:
        radky.append(f"🗑 Zdroje, které RSI stáhlo nebo změnilo stav: {len(v['odstraneno'])}")
        for klic, z in v['odstraneno'].items():
            radky.append(f"• {z['nazev']} ({z['stav']}) – " + ', '.join(p['kde'] for p in z['pouziti']))
    if v['nezname']:
        radky.append(f"❓ Zdroje, které Archivář nezná: {len(v['nezname'])} – " + ', '.join(sorted(v['nezname']))[:300])
    if not radky:
        radky.append(f"✅ Zdroje kroniky: všech {v['celkem']} odpovídá verzím, podle kterých se ověřovalo.")
    elif v['bez_hashe']:
        radky.append(f"(bez otisku, nekontrolováno: {v['bez_hashe']})")
    if len(radky) > max_radku:
        radky = radky[:max_radku] + [f"… a dalších {len(radky) - max_radku} řádků (spusť hlidac_zdroju.py ručně)"]
    return '\n'.join(radky)


def main():
    a = sys.argv[1:]
    def volba(n, vychozi=None):
        if n in a:
            i = a.index(n); return a[i + 1]
        return vychozi
    db = volba('--db')
    if not db:
        print(__doc__); sys.exit(1)
    repo = volba('--repo')
    zdroje = zdroje_z_repa(repo) if repo else zdroje_z_webu(volba('--web', WEB))
    v = zkontroluj(db, zdroje)
    if '--json' in a:
        print(json.dumps(v, ensure_ascii=False, indent=1))
    else:
        print(report(v, max_radku=10 ** 6))
    sys.exit(2 if v['zmeneno'] or v['odstraneno'] or v['nezname'] else 0)


if __name__ == '__main__':
    main()
