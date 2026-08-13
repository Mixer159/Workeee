# Design QA: příkazová paleta pracovního režimu

Datum: 2026-08-13

## Reference

- `/Users/maximkudela/.t3/userdata/attachments/0e1361fb-b63a-4104-8ebb-af790dc9d4e8-f7006ef9-c335-409f-837f-f5d4e2e4a5ba.png`
- `/Users/maximkudela/.t3/userdata/attachments/0e1361fb-b63a-4104-8ebb-af790dc9d4e8-77e80532-31e6-4f31-9868-b7c613601a58.png`

## Ověřená implementace

- Skutečná přihlášená stránka `/prace`, viewport 1280 × 800, dark mode.
- `Cmd+K` otevřel paletu a zabránil výchozí akci prohlížeče.
- První porovnání odhalilo příliš úzký dialog. Po opravě byl vycentrovaný na
  1152 × 768 px, vstup dostal focus a první akce `Nový úkol…` byla aktivní.
- Enter otevřel projektový krok se všemi čtyřmi viditelnými projekty a názvem
  organizace. Šipka dolů změnila aktivní projekt.
- Enter otevřel zadání názvu; po napsání názvu se povolilo vytvoření.
- Prázdný Backspace se vrátil na projektový krok. Test nevytvořil žádná data.
- Kořen palety a výběr projektů byly porovnány vedle příslušné reference.
  Pro snímek se použila stejná prezentační komponenta s bezpečnými smyšlenými
  daty; dočasná náhledová route byla po kontrole odstraněna.
- Vzhled používá stejné tokeny, typografii, focus ringy a projektové ikony jako
  zbytek Workeee; strukturu reference přebírá bez její fialové palety a s hustší
  sazbou odpovídající zbytku aplikace.

## Výsledek

**PASSED.** Struktura, rozměry, oba hlavní stavy, focus a klávesový průchod
odpovídají záměru reference a design systému Workeee. Kontrola nevytvořila ani
nezměnila žádná uživatelská data.
