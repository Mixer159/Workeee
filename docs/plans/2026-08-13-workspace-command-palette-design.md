# Příkazová paleta pracovního režimu

## Cíl

V `/prace` půjde vytvořit úkol bez odchodu na projektovou nástěnku. Viditelný
řádek „Nový úkol“ otevře výběr projektu; `⌘K` otevře obecnou příkazovou paletu
ve stylu dodané reference.

## Tok

1. Paleta nabízí akci „Nový úkol…“ a poslední úkoly pro rychlé otevření.
2. Akce zobrazí vyhledávatelný seznam všech projektů, které smí člověk otevřít,
   napříč jeho organizacemi.
3. Po volbě projektu se zadá název. Enter vytvoří úkol ve výchozím `todo` stavu
   projektu a otevře jeho detail uprostřed pracovní plochy.
4. Šipky mění výběr, Enter potvrzuje, Backspace na prázdném poli vrací o krok a
   Escape paletu zavře.

## Data a oprávnění

- `workspace.listTasks` doplní seznam viditelných projektů včetně projektů bez
  úkolů, jejich ikon a názvů organizací.
- Seznam vzniká až po serverovém vyhodnocení členství a omezeného přístupu.
- Samotné vytvoření používá existující `tasks.create`, které přístup k projektu
  i příslušnost stavu znovu ověřuje serverově.
- Stavy se načtou jen pro právě vybraný projekt; paleta vezme jeho základní
  `todo`, případně první dostupný stav.

## Rozhraní

- Paleta používá stávající `Dialog`, tokeny Workeee a ikony Lucide.
- Horní vstup, skupiny výsledků, jeden zvýrazněný řádek a spodní nápověda
  kopírují strukturu reference; fialovou nahrazuje jediný akcent Workeee.
- Na telefonu se dialog vejde do viewportu a seznam uvnitř se posouvá.
- Probíhající vytvoření zakáže opakované potvrzení; chyba zůstane v paletě a
  zobrazí českou toast zprávu.

## Ověření

- Backendový test ověří, že výběr obsahuje i prázdný projekt a nikdy nevrátí
  projekt mimo omezené členství.
- V prohlížeči se ověří otevření `⌘K`, šipky, Enter, návrat a vytvoření úkolu.
- Finální brána: lint, TypeScript, testy, audit, Convex dev push a build.
