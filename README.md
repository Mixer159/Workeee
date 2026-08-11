# Workeee

Workeee je česká týmová aplikace pro tok **organizace → projekty → úkoly**.
Obsahuje kanban s vlastními stavy, blokový editor, přílohy, komentáře se
zmínkami, správu rolí a jednorázové pozvánky pro celou organizaci nebo vybraný
projekt.

Produkční aplikace: [workeee.vercel.app](https://workeee.vercel.app)

## Stack

- Next.js 16, React 19, TypeScript a Tailwind CSS 4
- Convex pro databázi, serverové funkce a úložiště
- Better Auth pro registraci, přihlášení a relace
- Vitest a `convex-test` pro automatické testy

## Lokální spuštění

Požadován je Node.js `>=20.9 <25` a pnpm. Zkopírujte `.env.example` do
`.env.local`, připojte vlastní vývojový Convex deployment a spusťte oba procesy:

```bash
corepack enable
pnpm install
pnpm dev:convex
pnpm dev
```

Frontend poběží na `http://localhost:3000`. Na `/` je samotná aplikace,
veřejná stránka na `/o-aplikaci`. `pnpm dev:convex` běží souběžně v druhém terminálu
a při prvním spuštění doplní adresy deploymentu.

## Proměnné prostředí

Next.js potřebuje:

| Proměnná | Význam |
|---|---|
| `CONVEX_DEPLOYMENT` | vývojový deployment pro Convex CLI |
| `NEXT_PUBLIC_CONVEX_URL` | veřejné API Convex deploymentu |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | HTTP endpoint Convex deploymentu |
| `NEXT_PUBLIC_SITE_URL` | přesný veřejný origin aplikace bez koncového `/` |

Convex deployment potřebuje vlastní serverové proměnné:

```bash
pnpm exec convex env set BETTER_AUTH_SECRET
pnpm exec convex env set SITE_URL http://localhost:3000
```

`BETTER_AUTH_SECRET` musí být dlouhý náhodný klíč. `SITE_URL` a
`NEXT_PUBLIC_SITE_URL` se musí shodovat se skutečným originem; jinak auth odmítne
požadavek nebo pozvánky odkážou na špatnou adresu. Skutečné hodnoty a tajné
klíče nepatří do Gitu.

## Ověření změn

Stejné brány běží v GitHub Actions:

```bash
pnpm audit --prod
pnpm lint
pnpm typecheck
pnpm test
pnpm exec convex dev --once
pnpm build
```

Testy pokrývají přístupová práva, role, jednorázové pozvánky, úkoly, komentáře,
přílohy, izolaci úložiště mezi tenanty a mazání organizace.

## Nasazení

Produkční frontend běží na Vercelu a backend na Convexu. Backend nasadíte přes
`pnpm exec convex deploy`; frontend přes Vercel nebo propojení GitHub repozitáře
s Vercel projektem. Produkční Convex deployment musí mít nastavené
`BETTER_AUTH_SECRET` a `SITE_URL=https://workeee.vercel.app`; Vercel musí mít
veřejné adresy produkčního Convex deploymentu a
`NEXT_PUBLIC_SITE_URL=https://workeee.vercel.app`.

## Struktura a pravidla

Backend je v `convex/`, frontend v `src/` a CI v `.github/workflows/ci.yml`.
Úplný kontrakt projektu — verze stacku, auth a přístupový model, schéma,
designové tokeny a roadmapa — je v [`CLAUDE.md`](./CLAUDE.md). Při změně
dokumentovaného faktu aktualizujte ve stejném commitu i tento soubor. Změnu,
které si všimne uživatel, zapište i do `src/lib/changelog.ts`; vykresluje se na
veřejné stránce a na `/zmeny`.

## Licence

Kód je pod licencí [MIT](./LICENSE). Forky i pull requesty jsou vítané.
