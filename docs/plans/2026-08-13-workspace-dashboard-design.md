# Centrální pracovní plocha

## Cíl

Výchozí obrazovka `/` zůstane přehledem projektů aktuální organizace. Z běžného
sidebaru půjde otevřít volitelný pracovní režim `/prace`, podobný T3 Code: vlevo
úkoly ze všech viditelných projektů všech organizací, uprostřed otevřený detail
úkolu. Člověk tak může přepínat úkoly, upravovat je a psát komentáře bez
otevírání jednotlivých nástěnek.

## Data

- Nový index `tasks.by_project_updated_at` řadí úkoly projektu podle poslední
  aktivity bez filtrování tabulky.
- Nový dotaz `workspace.listTasks` načte omezenou stránku z každého viditelného
  projektu, výsledky sloučí a seřadí podle `updatedAt` sestupně.
- Dotaz odvodí všechna členství na serveru, vrátí jen projekty, které smí
  uživatel otevřít, a vynechá archivované.
- Každá položka obsahuje projekt, stav, řešitele a náhled posledního komentáře.
- Ruční limit a `hasMore` drží dotaz ohraničený; další položky se načtou na
  vyžádání.

## Obrazovka

- `/` i jeho běžný projektový rail zůstanou beze změny; přibude jen nenápadný
  vstup „Pracovní režim“.
- Na `/prace` nahradí běžný rail širší pracovní rail. Nebude v něm přepínač
  organizace, upozornění ani projektová navigace.
- Pod značkou a návratem na přehled bude hledání, přepínač „Všechny / Moje“ a
  hustý seznam úkolů přes celou zbývající výšku sidebaru.
- Aktivní řádek označí krátká limetková linka, ne karta ani další barevná plocha.
- Střed používá stávající `TaskDetailPanel` v široké variantě. Bez vybraného
  úkolu ukáže klidný prázdný stav.
- Na telefonu je stejný rail v existujícím levém draweru.

## Chování

- Bez parametru se otevře nejnověji aktivní úkol.
- Výběr se zapisuje do `?ukol=<id>` pomocí mělké změny historie, takže odkaz lze
  zkopírovat a detail se přepíná bez nové navigace.
- Hledání a filtr „Moje“ mění pouze rail; otevřený úkol zůstává otevřený.
- Kliknutí na název projektu v detailu otevře jeho stávající Kanban nástěnku.

## Oprávnění a okrajové stavy

- Server vždy odvodí viditelné projekty z členství; klient nic nedofiltruje jako
  bezpečnostní pravidlo.
- Člen s omezeným přístupem nikdy neuvidí úkol z jiného projektu.
- Účet bez projektů nebo úkolů dostane konkrétní prázdný stav.
- Smazaný nebo nově nepřístupný úkol se v detailu zobrazí jako nedostupný a po
  obnovení seznamu z railu zmizí.

## Ověření

- Test řazení napříč organizacemi a náhledu posledního komentáře.
- Test omezeného člena, který vidí jen přidělený projekt.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, jednorázový
  push Convexu a `pnpm build`.
- Desktop a mobilní průchod v lokálním prohlížeči.
