# Reakce na komentáře

## Cíl

Každý komentář pod úkolem může nést emoji reakce. Reakce se nikdy nevloží jako
nový komentář: zůstává přímo pod zprávou, na kterou odpovídá. Stejná emoji od
více lidí se sloučí do jedné reakce s počtem.

## Data a oprávnění

- `commentReactions` drží jednu souhrnnou řádku pro kombinaci komentáře a emoji.
  `userIds` určuje počet i to, zda už reagoval právě přihlášený člověk.
- Index `by_comment_emoji` zaručí jediný souhrn pro jedno emoji; `by_task`
  načte všechny reakce proudu jedním ohraničeným dotazem a slouží i mazání.
- `commentReactions.toggle` načte komentář a znovu ověří přístup přes
  `requireTaskAccess`. Kliknutí stejného člověka stejné emoji odebere.
- Komentář může nést nejvýš 20 různých emoji. Počet lidí u jedné reakce se
  neomezuje na malý UI limit, takže se běžně zobrazí i 50, 80 nebo 150.
- Smazání komentáře, úkolu nebo organizace vezme reakce s sebou.

## Rozhraní

- Existující reakce jsou v jednom řádku přímo pod tělem a přílohami komentáře.
- Každé emoji se zobrazuje jednou s počtem. Vlastní aktivní reakce používá
  akcentní okraj; kliknutí ji přepne.
- Tlačítko reakce otevře malý výběr běžných emoji a vstup pro libovolné jiné
  emoji. Telefon použije svou emoji klávesnici, desktop systémový výběr nebo
  vložení emoji.
- Chyba zůstane u původního komentáře a zobrazí českou toast zprávu. Úspěch je
  tichý; reaktivní dotaz aktualizuje počty všem otevřeným uživatelům.

## Okrajové stavy

- Prázdná hodnota, text nebo více samostatných emoji server odmítne.
- Odstranění posledního člověka smaže celý souhrn, takže nezůstane reakce s
  nulou.
- Současná přidání se zpracují v jedné Convex transakci nad stejnou řádkou.
- Člověk bez přístupu k projektu reakce neuvidí ani nezmění.

## Ověření

- Backendové testy pokryjí sloučení, počty, přepnutí vlastní reakce, různá
  emoji, oprávnění a kaskádové mazání.
- V prohlížeči se ověří rychlá i vlastní reakce, změna počtu a umístění přímo
  pod komentářem.
- Finální brána: lint, TypeScript, testy, audit, Convex dev push a build.
