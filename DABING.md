# Dabing Hvězdné kroniky – pravidla pro texty k namluvení

Platí pro Spisovatele, Redaktora, Režiséra (agenty v n8n) i pro ruční úpravy.

## Psaný a mluvený text
- **t** – psaný text (co se zobrazí na webu). Žádné režijní značky.
- **v** – mluvený text (co se namluví). Smí obsahovat režijní značky níže.
- U kapitol od bota se **v** vytvoří automaticky z **t** podle rejstříku výslovnosti (`_data/vyslovnost.yml`). Ručně se píše jen tehdy, když je potřeba režie.

## Režijní značky (v mluveném textu)
| Značka | Význam | Převod pro ElevenLabs |
|---|---|---|
| `[vážně]` | vážný, pomalejší tón | `[serious]` |
| `[šeptem]` | šepot | `[whispers]` |
| `[napjatě]` | napětí, zrychlení | `[tense]` |
| `[s ironií]` | ironie | `[sarcastic]` |
| `[smutně]` | smutek | `[sad]` |
| `[pauza]` | znatelná odmlka | `…` (výpustka; ElevenLabs v3/v4 nepodporuje SSML pauzy) |
| `*slovo*` | důraz na slovo | slovo VELKÝMI PÍSMENY |

- Značka platí od místa, kde stojí, do konce věty.
- Šetřit: nanejvýš jedna značka tónu na větu, důraz jen na klíčová slova. Většinu práce má dělat interpunkce a stavba věty.
- Náhledový hlas prohlížeče značky vynechá (`[pauza]` přečte jako krátkou odmlku).

## Rejstřík výslovnosti
- `_data/vyslovnost.yml` – jak se čtou cizí jména a pojmy (Vanduul → Vandúl, Xi’an → Šian…).
- Kmen platí i pro skloňované tvary; nepravidelné tvary v poli `tvary`; víceslovné názvy a zkratky `cele: true`.
- Nové jméno, které v rejstříku chybí → Režisér navrhne výslovnost a Daniel ji schválí (pole `pozn: ověřit`, dokud není potvrzená).
- Export pro ElevenLabs: `python3 nastroje/vyslovnost_pls.py > vyslovnost.pls` (alias pravidla).

## Hlasy (rejstřík hlasů – doplní se po výběru)
| Role (`who`) | Hlas | Poznámka |
|---|---|---|
| ARCHIVÁŘ | **Honza Bílek** (ElevenLabs, voice_id `kOWmvbNszhdJeaeyEzJB`, model `eleven_v4`) | vypravěč: mužský, starší, klidný, s vahou – vybráno 14. 11. 2026 |
| rádiová hlášení (`radio`) | (vybere se) | jiný hlas, rádiový filtr |
| postavy v citacích | podle potřeby | |

## Nahrávky na webu (od 14. 11. 2026)
- Soubory: `assets/audio/<scéna>/<věta>-<otisk>.mp3` a seznam `assets/audio/<scéna>/index.json` = `[{i, f, v}]`.
- Přehrávač (`archiv/index.html`) přehraje nahrávku, jen když její `v` souhlasí se současným mluveným textem věty; jinak použije hlas prohlížeče. Po úpravě textu se tak stará nahrávka nepustí a stačí scénu namluvit znovu – přenamluví se jen změněné věty.
- Vyrábí je workflow n8n **„Namluvit scénu (Hvězdná kronika)“** (`jWsIlOB021Lqo5lX`): načte scénu z přehrávače, vynechá hotové věty, každou pošle do ElevenLabs a mp3 uloží přes GitHub API. Vstup `scena` (prolog, kap-1 … kap-10, letka).
- Zatím jen ARCHIVÁŘ; rádiová hlášení a postavy v dramatizaci (letka) mluví dál hlasem prohlížeče, dokud pro ně nevybereme hlasy.
- Cena: zhruba 1 kredit ElevenLabs za znak (celá kronika ≈ 15 000 kreditů).
