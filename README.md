# Star Kronika

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
| `index.html` | Úvodní stránka (6 nejnovějších kapitol) |
| `casova-osa.html` | Kapitoly seřazené podle herního roku |
| `o-projektu.md` | Jak kapitoly vznikají + upozornění |

## Přidání kapitoly

Nový soubor `_kapitoly/<nazev-bez-diakritiky>.md` podle `SABLONA-KAPITOLY.md`.
Název souboru = adresa stránky (`pad-calibanu.md` → `/kapitoly/pad-calibanu/`).

Kapitoly sem bude ukládat Archivář (n8n) – až po Danielově schválení.
