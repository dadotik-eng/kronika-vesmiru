# Šablony souborů pro bota

Každá osoba, událost a položka zásobníku je **samostatný soubor**. Název souboru = id (malá písmena bez diakritiky, slova oddělená pomlčkou). Bot zakládá nové soubory a upravuje existující – nikdy nepřepisuje celé seznamy.

Přehled toho, co už existuje (bot čte před přidáním, aby nevznikly duplicity):
- https://dadotik-eng.github.io/kronika-vesmiru/data/osoby.json
- https://dadotik-eng.github.io/kronika-vesmiru/data/udalosti.json
- https://dadotik-eng.github.io/kronika-vesmiru/data/zasobnik.json

## Osoba – `_osoby/<id>.md`
```yaml
---
jmeno: Erin Toi
narozeni: '2746'          # vždy v uvozovkách; neznámo → 'neznámo'
umrti: '2873'             # 'žije' nebo 'neznámo'
role: první imperátorka UEE po pádu Messerů
kategorie: vladari        # vladari | politika | armada | objevitele | veda-technika | korporace | kultura | zlocin | xiani-tevarini
medailonek: 3–5 vět česky, vlastními slovy, jen fakta ze zdroje.
zdroje:
- nazev: Erin Toi
  typ: Galactapedie       # Galactapedie | Comm-Link
  url: https://robertsspaceindustries.com/galactapedia/article/...
kapitoly: [kap-8]         # kap-1 … kap-10, letka; jinak []
rozpor: nepovinné – když si prameny odporují
rad: 2746                 # číslo pro řazení: rok narození, jinak přibližný rok, kdy byl činný
rod: messer               # jen u Messerů
---
```

## Událost na časové ose – `_udalosti/<id>.md`
id ve tvaru `r<rok>` (další událost téhož roku `r<rok>b`, `r<rok>c`).
```yaml
---
rok: 2438                 # číslo; pro řazení v rámci roku lze desetinné (2438.8 = říjen)
datum: 12. června 2438    # nepovinné, zobrazí se místo roku
titul: První kontakt
text: 1–2 věty česky.
kap: 3                    # číslo kapitoly v archivu, nepovinné
klic: true                # jen zlomové události (velký zlatý bod)
---
```

## Položka zásobníku příběhů – `_zasobnik/<id>.md`
```yaml
---
nazev: Bitva u Fabely
nazev_en: Battle of Fabela
rok: '2825'
rok_od: 2825              # číslo pro řazení (př. n. l. záporně); u neuvedeno vynech
era: Věk nápravy          # Před lidskou expanzí | Úsvit Sluneční soustavy | Věk skoků | Spojené národy Země | Spojené planety Země | Éra Messerů | Věk nápravy | Válka s Vanduuly / současnost
typ: bitva                # bitva | katastrofa | zločin | objev | politika | osobní příběh | záhada | povídka | korporace
shrnuti: 2–3 věty česky.
postavy: [Paul Barlow, Ignacio Assaf]
zdroje:
- record_key: commlink:17862
  rsi_url: https://robertsspaceindustries.com/...
forma: dramatizace        # dramatizace | vyprávění
hodnoceni: 5
hodnoceni_proc: jedna věta proč
stav: nápad               # nápad → rozpracováno → ověřeno → na webu
priorita: true
---
```
Při změně stavu bot přepíše jen řádek `stav:` (soubor načte, upraví, uloží celý).
