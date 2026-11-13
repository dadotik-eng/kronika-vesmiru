# Hvězdná kronika

Neoficiální česká kronika dějin vesmíru Star Citizen.
Web: https://dadotik-eng.github.io/kronika-vesmiru/

Web staví GitHub Pages sám (Jekyll) – nic se neinstaluje. Každá změna v úložišti se na webu projeví zhruba za 1–2 minuty.

## Struktura

| Cesta | Co to je |
|---|---|
| `_kapitoly/` | Kapitoly kroniky – jeden soubor `.md` = jedna kapitola |
| `_layouts/` | Šablony stránek (obecná, kapitola) |
| `_includes/` | Hlavička a patička (včetně upozornění, že nejde o oficiální web CIG) |
| `assets/css/styl.css` | Vzhled |
| `index.html` | Úvodní stránka |
| `casova-osa.html` | Kapitoly seřazené podle herního roku |
| `o-projektu.md` | Jak kapitoly vznikají + upozornění |

## Přidání kapitoly

Nový soubor `_kapitoly/<nazev-bez-diakritiky>.md` podle `SABLONA-KAPITOLY.md`.
Název souboru = adresa stránky (`pad-calibanu.md` → `/kapitoly/pad-calibanu/`).

Kapitoly sem bude ukládat Archivář (n8n) – až po Danielově schválení.

## Generované soubory (ručně neupravovat)
Vyrábějí je skripty v `nastroje/`, většinou automaticky GitHub Action **Náhledy** po změně na `main`. Ruční úprava by se při dalším běhu přepsala.

| Soubor | Vyrábí |
|---|---|
| `assets/nahledy/*.jpg`, `assets/nahledy/otisky.json` | `nastroje/nahledy.py` |
| `data/mapa.json`, `_data/mapa_odkazy.json` | `nastroje/mapa.py` |
| `data/vztahy.json`, `_data/vztahy_index.yml` | `nastroje/vztahy.py` |
| `_data/texty.yml` | `nastroje/texty_z_archivu.py` (ručně, z archivu Archiváře) |

Surová data Archiváře (databáze, RAW JSONy, stažený archiv) do tohoto repozitáře nepatří – zůstávají na Danielově počítači. Sem jdou jen hotové, schválené záznamy.

## Schvalování (beta → ostrý web)
- Bot píše jen do větve `beta`. Na ostrý web (`main`) se dostane až po Danielově schválení.
- Schválení = akce **Beta** s volbou `schvalit`: nejdřív `nastroje/kontrola.py --ostry` (kapitola musí mít `overeni: OK`), teprve pak sloučení do `main` a spuštění Náhledů.
