"""Vytáhne texty kapitol a dramatizací ze scén v archiv/index.html do _data/texty.yml,
aby šly číst na webu (/dejiny/kap-N/, /pribehy/ztracena-letka/). Spouštět po každé úpravě textů v archivu."""
import json, yaml
s = open('archiv/index.html', encoding='utf-8').read()
i = s.index('const D=') + len('const D=')
D, _ = json.JSONDecoder().raw_decode(s[i:])
out = {}
for sc in D['scenes']:
    if not (sc['id'].startswith('kap-') or sc['id'] in ('letka', 'prolog')):
        continue
    odst, posl, byl_p = [], None, False
    for l in sc['lines']:
        kdo, t = l.get('who', 'ARCHIVÁŘ'), l['t']
        if sc['id'].startswith('kap-') and 'p' not in l and not byl_p:
            continue  # úvodní věta „Kapitola první. …“
        if 'p' in l: byl_p = True
        # věta bez čísla odstavce po začátku kapitoly = pokračování předchozího odstavce (kap. IX)
        if kdo == 'ARCHIVÁŘ' and 'p' not in l and byl_p and posl is not None and posl['kdo'] == 'ARCHIVÁŘ':
            posl['text'] += ' ' + t
            continue
        if kdo == 'ARCHIVÁŘ' and 'p' in l and posl is not None and posl.get('p') == l['p'] and posl['kdo'] == 'ARCHIVÁŘ':
            posl['text'] += ' ' + t
            continue
        posl = {'kdo': kdo, 'text': t}
        if 'p' in l: posl['p'] = l['p']
        if l.get('radio'): posl['radio'] = True
        odst.append(posl)
    for o in odst: o.pop('p', None)
    out[sc['id']] = {'nazev': sc['label'], 'podtitul': sc.get('sub', ''), 'poznamka': sc.get('note', ''), 'odstavce': odst}
open('_data/texty.yml', 'w', encoding='utf-8').write(
    '# Vygenerováno nástrojem nastroje/texty_z_archivu.py ze scén v archiv/index.html – needitovat ručně.\n'
    + yaml.safe_dump(out, allow_unicode=True, sort_keys=False, width=1000))
print({k: len(v['odstavce']) for k, v in out.items()})
