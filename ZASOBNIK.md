# Zásobník příběhů – Kronika Vesmíru

Interní seznam kandidátů na převyprávěné nebo dramatizované příběhy pro web. Data jsou v souboru `pribehy.yml`; vše pochází výhradně z databáze Archivář (`archivar.sqlite`) – každá položka odkazuje na `record_key` a `rsi_url` zdrojových záznamů. Podle pravidla kroniky má jako zdroj přednost Galactapedia, Comm-Linky jsou doplněk.

## Přehled

- **Kandidátů celkem:** 150
- **Stav:** 129× nápad, 21× na webu
- **Priorita:** 14 položek (4 rozpracované „připravuje se“ + 10 mých top tipů)

### Podle éry

| Éra | Počet |
|---|---|
| Úsvit Sluneční soustavy | 11 |
| Věk skoků | 5 |
| Spojené národy Země | 7 |
| Spojené planety Země | 17 |
| Éra Messerů | 38 |
| Věk nápravy | 19 |
| Válka s Vanduuly / současnost | 53 |

### Podle typu

| Typ | Počet |
|---|---|
| bitva | 18 |
| katastrofa | 8 |
| zločin | 10 |
| objev | 18 |
| politika | 17 |
| osobní příběh | 20 |
| záhada | 19 |
| povídka | 35 |
| korporace | 5 |

Poznámka: xi'anské a pravěké události (Velký rozkol, Duchovní války, vymření Hadesianů) jsou kvůli chybějící vhodné kategorii zařazeny do éry „Úsvit Sluneční soustavy“. Povídky bez uvedeného roku mají `rok: "neuvedeno"` a jsou zařazeny do současnosti.

## Top 15

1. **Bitva o Fabelu: dobrá lež** (2825, `battle-of-fabela`) – Připravuje se – silný příběh o pravdě, vině a zapomenutém hrdinovi.
2. **Kellarův útěk** (2931, `kellars-run`) – Připravuje se – akční honička napříč soustavami s jasným koncem.
3. **Adelaide Lorris a maršál Cathcart** (2438, `adelaide-lorris-cathcart`) – Připravuje se – vtipná pomsta pronásledovateli; zdroje jsou ale stručné.
4. **Zmizení guvernéra Assana Kierena** (2638–2639, `assan-kieren-disappearance`) – Připravuje se – politický thriller s nevyřešeným koncem.
5. **Artemis a umělá inteligence Janus** (2232–2237, `artemis-janus`) – Zmizelá kolonizační loď a podezřelá AI – nejsilnější záhada raných dějin.
6. **Masakr na stanici Demien** (2935, `walzer-massacre`) – Čtrnáctiletý Arjun Walzer padesát minut hlásí matce útok na stanici – napětí i dojetí.
7. **Pamatuji si domov** (2911–2914, `laurence-kiefly`) – Mrtvý pilot doručený rodičům v bedně s nápisem „Pamatuji si domov“.
8. **Loď duchů z Iapetu** (2255, `ghost-ship-iapetus`) – Zeus C-6 pod ledem Iapetu bez posádky, se skafandrem 300 mil špatným směrem.
9. **Cesta k Prvnímu občanovi** (2546, `path-to-prime-citizen`) – Historička odhaluje, že Ivar Messer mohl sám zosnovat atentáty v Jatě.
10. **Chlapec, který odmítl pracovat** (2757, `anthony-tanaka`) – Dvanáctiletý dělník, jehož „ne“ odstartovalo pád Messerů.
11. **Pád Virgilu a poslední let Letky 214** (2737, `fall-of-virgil`) – Letka 214 se vrací pro další uprchlíky, zatímco Cyrene hoří.
12. **Torpéda do prázdna** (2791, `squadron-78-refusal`) – Velitelka Cahillier pošle torpéda místo do obydleného měsíce do prázdna.
13. **Zmizení Fiony Messer** (2792, `fiona-messer`) – Zrádkyně vlastního bratra, která zmizela uprostřed revoluce.
14. **Dítě z Marsu** (2157, `abeni-okon`) – První člověk narozený na Marsu a břemeno slávy, kterou si nevybrala.
15. **Od zloděje k senátorovi** (2919–2946, `suj-kossi`) – Tevarinský zloděj, který se stal hrdinou a prvním tevarinským senátorem.

## Jak s položkami pracovat

Každý příběh prochází stavy:

**nápad → rozpracováno → ověřeno → na webu**

- **nápad** – kandidát vybraný ze zdrojů; shrnutí je jen orientační a příběh ještě nikdo nezpracovával.
- **rozpracováno** – vzniká český text nebo scénář. Před zahájením je nutné přečíst *celé* zdrojové texty (u seriálových povídek všechny díly), protože shrnutí v zásobníku zachycuje často jen úvod.
- **ověřeno** – každé tvrzení v textu je dohledatelné ve zdrojích ze seznamu `zdroje`; jména, data a místa jsou zkontrolovaná proti Galactapedii. Nic se nedomýšlí.
- **na webu** – příběh je publikovaný (případně namluvený) a v zásobníku slouží jen jako evidence, aby se neduplikoval.

Při změně stavu stačí přepsat pole `stav` v `pribehy.yml`. Pole `priorita: true` označuje, co zpracovat jako první.
