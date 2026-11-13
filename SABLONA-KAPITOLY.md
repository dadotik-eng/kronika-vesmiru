---
id: pad-calibanu            # = název souboru (slug), po zveřejnění se nemění
title: Název kapitoly
date: 2026-11-10            # den uložení (reálné datum) – řadí "Nejnovější kapitoly"
typ: kronika                # kronika | dramatizace | dokument
herni_rok: 2884             # herní rok hlavní události – řadí časovou osu (jen číslo)
obdobi: naprava             # id z _data/ery.yml: usvit, skoky, une, upe, messerove, naprava, valka; mimo = mimo lidské dějiny
soustava: CALIBAN           # volitelné; kód soustavy ze Star Map (stejný jako na /mapa/#CALIBAN)
popis: Jedna až dvě věty pro náhled a vyhledávače.
vazby:                      # na co kapitola odkazuje – jen existující ID
  osoby: [sylvie-randall]   # názvy souborů v _osoby
  systemy: [CALIBAN]        # kódy soustav
  rasy: [vanduulove]        # názvy souborů v _rasy
  udalosti: [r2884]         # názvy souborů v _udalosti
stitky: [Vanduulové, Caliban]   # volitelné, jen pro zobrazení
overeni: OK                 # OK | neověřeno – na ostrý web smí jen OK
overeno_kdy: 2026-11-11
overeno_kym: Kontrolor      # Kontrolor | Daniel
overeni_poznamka:           # volitelné, vidí jen Daniel v betě
audio:                      # volitelné, odkaz na namluvenou verzi (mp3/ogg)
zdroje:                     # formát v2 – stejný ve všech záznamech
  - record_key: galactapedia:0Gz5DNryvE   # klíč v databázi Archiváře (galactapedia:<id z adresy>, commlink:<číslo>)
    typ: Galactapedie       # Galactapedie | Comm-Link | Star Map | Komunitní wiki (jen když oficiální text chybí; url https://starcitizen.tools/<Stránka>, record_key scwiki:<Stránka>)
    nazev: Fall of Caliban
    url: https://robertsspaceindustries.com/galactapedia/article/0Gz5DNryvE-fall-of-caliban
    hash:                   # volitelné; content_hash verze, podle které se ověřovalo (doplní Archivář)
---
Text kapitoly. Odstavce oddělené prázdným řádkem.
