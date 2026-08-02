# Workeee — CLAUDE.md

Interní týmová aplikace: organizace → projekty → úkoly. This file is the living
contract for the repo; it overrides generic conventions and must be updated in
the same session as any change to a documented fact.

Follow `crm-app-skill` for everything not stated here (five laws, server-only
authorization, indexed reads, fail-soft queries / throwing mutations, one file
one responsibility, no barrel files).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript 5, strict |
| Backend | Convex (schema, queries/mutations/actions, HTTP router) |
| Auth | **Better Auth** via `@convex-dev/better-auth`, e-mail + password, **self-registration ON** |
| Styling | Tailwind CSS v4, CSS-first tokens in `src/app/globals.css` |
| Components | shadcn/ui on Radix (`radix-nova` style), copied into `src/components/ui/` |
| Icons | `lucide-react` |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` |
| Block editor | **BlockNote** — `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn` |
| Motion | `framer-motion` |
| Toasts | `sonner` |
| Tests | `vitest` + `convex-test` |
| Package manager | **pnpm** (never npm/yarn) |

Version pins that matter:

- `better-auth` is pinned to **exactly `1.6.22`**, the first stable release that
  fixes GHSA-qq9h-g4jm-xgf3. `@convex-dev/better-auth@0.12.5` declares this
  release compatible at runtime, but its exported `AuthClient` alias still
  infers `useSession.data` as `never`; the single documented boundary cast lives
  in `src/components/providers/convex-client-provider.tsx`. Do not move the cast
  or bump auth without re-running typecheck and the real sign-up/session E2E.
- Next.js 16.2.12 still pins vulnerable transitive PostCSS/Sharp releases.
  `package.json#pnpm.overrides` keeps Next on the current stable version while
  forcing `postcss@8.5.25` and `sharp@0.35.3`; `pnpm audit --prod` must stay clean.
- `shadcn` CLI is v4: styles are presets, not `new-york`. This project used
  `shadcn init -b radix -p nova` (Radix primitives, neutral base color).
- BlockNote is pinned to **exactly `0.52.1`** across `@blocknote/core`,
  `@blocknote/react` and `@blocknote/shadcn` — the three must move together, they
  depend on each other by exact minor. 0.52 declares React 18/19 peers and a
  `tailwindcss@^4.1.12` peer, so it is Next 16 / React 19 / Tailwind v4 clean.
  The **shadcn** UI package was chosen over `@blocknote/mantine` because it draws
  its menus with our own tokens (`bg-popover`, `border-input`, `--radius`, the
  `.dark` variant) instead of pulling `@mantine/core` in as a second component
  library. Its cost is two lines in `globals.css`, and they are not
  interchangeable — see **The task body editor**.

## Commands

```bash
pnpm dev            # Next.js on :3000 — must match SITE_URL in the Convex env
pnpm dev:convex     # convex dev (watch). Both processes are required.
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm exec convex dev --once   # one-shot push (never run bare `convex dev` in an agent shell)
```

Verification gate before calling any task done: `pnpm lint && pnpm typecheck && pnpm test`,
plus `pnpm audit --prod`, `pnpm exec convex dev --once` and `pnpm build` for
anything structural.

## Environment

`.env.local` (written by `convex dev`, plus one manual line):

```
CONVEX_DEPLOYMENT=dev:incredible-cobra-806
NEXT_PUBLIC_CONVEX_URL=https://incredible-cobra-806.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://incredible-cobra-806.convex.site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` is also the origin invite links are built from
(`${NEXT_PUBLIC_SITE_URL}/join/<code>`, `src/lib/invites.ts`) and the
`metadataBase` every `og:image` URL is resolved against — it must be the
production URL in production, or people get links to the wrong host and
unfurls that point at `localhost`.

Convex deployment env (`pnpm exec convex env list`):

- `BETTER_AUTH_SECRET` — generated with `openssl rand -base64 32`
- `SITE_URL` — `http://localhost:3000` in dev. **Must equal the origin the app is
  served from**, otherwise Better Auth answers `403 INVALID_ORIGIN`.

Production is separate from development:

```
Convex deployment: rightful-barracuda-439
NEXT_PUBLIC_CONVEX_URL=https://rightful-barracuda-439.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://rightful-barracuda-439.convex.site
NEXT_PUBLIC_SITE_URL=https://workeee.vercel.app
Convex SITE_URL=https://workeee.vercel.app
```

The production `BETTER_AUTH_SECRET` is stored only in the Convex deployment.
Vercel holds the three public `NEXT_PUBLIC_*` values; neither provider secret is
committed. `.env.example` documents the local shape.

## Directory shape

```
convex/
  schema.ts              # app tables + shared validators (single source)
  auth.ts                # Better Auth instance + component client + user triggers
  auth.config.ts         # Convex auth provider config
  convex.config.ts       # component registration
  http.ts                # Better Auth routes on *.convex.site
  users.ts               # users.currentUser
  organizations.ts       # create / listForUser / get / rename / remove /
                         # members / roles
  organizationPurge.ts   # internal: empty a deleted organization, batch by batch
  projects.ts            # create / listVisible / get / assignableMembers /
                         # rename / archive / icon (image or emoji)
  invites.ts             # create / list / revoke / getByCode (public) / accept
  taskStatuses.ts        # list / create / update / reorder / remove
  tasks.ts               # listByProject / get / create / updateTitle /
                         # setAssignee / move / remove (cascades to children)
  taskContent.ts         # get / save — the BlockNote document of a task
  files.ts               # generateUploadUrl / register / listByTask / remove
  comments.ts            # listByTask / create / update / remove
  crons.ts               # scheduled jobs — one entry per job
  fileReaper.ts          # internal: delete blobs nothing points at any more
  migrations.ts          # internal one-off backfills (`pnpm exec convex run`)
  authz.test.ts          # security tests: visibility, invites, role guards
  organizationPurge.test.ts  # owner guard, name confirmation, the whole cascade
  tasks.test.ts          # security + ordering tests for the board
  taskDetail.test.ts     # security + logic tests for body, files, comments
  fileReaper.test.ts     # both reaper branches, the grace period, the batch cap
  svg.test.ts            # the icon SVG gate: what it accepts, and the attacks
  lib/auth.ts            # getAuthUserId / getAuthUser / getUserByAuthId
  lib/access.ts          # the permission matrix — org + project access
  lib/activity.ts        # logActivity (audit trail)
  lib/commentBody.ts     # the comment segment codec (shared with the client)
  lib/files.ts           # blob validation, caps, deletion
  lib/invites.ts         # expiry presets, code generation, status
  lib/ordering.ts        # fractional order helpers for board columns
  lib/projectMembers.ts  # who can open a project (assignees + mentions)
  lib/storage.ts         # global one-blob/one-owner invariant + safe deletion
  lib/svg.ts             # the icon SVG allowlist + `data:` URI (never a blob)
  lib/tasks.ts           # getTaskAccess / requireTaskAccess / touchTask /
                         # deleteTaskChildren (body + files + comments)
  lib/taskStatuses.ts    # core status seed + ordered read
  lib/validation.ts      # normalizeName, normalizeTitle
src/
  app/
    layout.tsx           # fonts, pre-hydration theme script, providers, Toaster,
                         # metadataBase + the OpenGraph / Twitter copy
    icon.svg             # the mark — indigo tile, white letterform W
    favicon.ico          # 16 · 32 · 48, rasterized from icon.svg
    apple-icon.png       # 180, full bleed (iOS rounds it itself)
    opengraph-image.tsx  # the link preview every page inherits
    not-found.tsx        # 404, outside the shell, with its own frame
    (auth)/prihlaseni    # sign in       (?invite=<code> carries a pending invite)
    (auth)/registrace    # sign up       (?invite=<code> likewise)
    (dashboard)/         # AuthGuard + OrganizationProvider + AppShell
    (dashboard)/projekt/[id]            # project board + task drawer (?ukol=<id>)
    (dashboard)/projekt/[id]/ukol/[taskId]  # redirect, keeps older links alive
    (dashboard)/nastaveni/organizace    # organization settings, managers only
    join/[code]/         # PUBLIC invite landing page + its own opengraph-image
    api/auth/[...all]/   # proxy into the Convex deployment
  components/
    ui/                  # shadcn primitives, ours to edit
    auth/                # auth-guard, sign-in-form, sign-up-form
    forms/               # name-form (shared rename control)
    invites/             # invites-panel (org- and project-scoped)
    join/                # join-screen
    layout/              # app-shell, sidebar-content, organization-switcher,
                         # projects-nav, user-menu, wordmark, empty-state
    organizations/       # onboarding, create/join forms + dialogs, members-table,
                         # delete-organization-dialog
    projects/            # project-screen, project-icon, project-icon-picker,
                         # new-project-button, create/settings dialogs
    providers/           # convex-client-provider, organization-provider
    tasks/               # task-board, task-column, task-card, task-quick-add,
                         # status-dot, status-form-dialog, status-delete-dialog,
                         # task-drawer, task-detail-panel, task-title-field,
                         # task-save-indicator, task-description-editor,
                         # task-attachments, task-comments, comment-composer,
                         # comment-item, comment-body, mention-textarea,
                         # file-type-icon, image-lightbox
  hooks/                 # use-current-user, use-current-organization, use-theme,
                         # use-now, use-autosave-text
  lib/                   # auth-client, auth-server, auth-errors, blocknote-cs,
                         # clipboard, comment-draft, current-organization,
                         # format, invites, og, organization, project-emojis,
                         # project-icons, save-state, task-status-colors, tasks,
                         # theme, upload, user, utils
```

No barrel files, no `index.ts` re-exports — import by full path.

Import aliases: `@/*` → `./src/*`, `@convex/*` → `./convex/*` (Convex code lives
outside `src/`, so client code imports the generated API as
`@convex/_generated/api`). Mirrored in `tsconfig.json` and `vitest.config.mts`.

## Auth

- Better Auth runs **inside Convex** through the `@convex-dev/better-auth`
  component. Next.js only proxies `/api/auth/*` into the deployment via
  `handler` from `src/lib/auth-server.ts`.
- E-mail + password, **self-registration enabled**, e-mail verification off for
  v1, minimum password length 12, maximum 256. Display names are normalized and
  capped server-side before the Better Auth mirror is written.
- Sign in / sign up / sign out happen **client-side** through
  `authClient` (`src/lib/auth-client.ts`). Convex functions cannot set cookies.
- Auth state in the UI comes from `useConvexAuth()` / `<Authenticated>`, never
  from Better Auth's `useSession()` — Convex validates the token after Better
  Auth already reports a user.

### The app `users` table

Better Auth owns its own tables inside the component. The app owns a mirrored
`users` table, kept in sync **transactionally** by the triggers in
`convex/auth.ts` (`onCreate` / `onUpdate` / `onDelete` on the component's `user`
table). Everything downstream references `Id<"users">`, never the Better Auth id.

```ts
users: defineTable({
  authId: v.string(),        // Better Auth user _id; equals JWT `sub`
  name: v.string(),
  email: v.string(),
  image: v.optional(v.string()),
})
  .index("by_auth_id", ["authId"])
  .index("by_email", ["email"])
```

### The auth helper

`convex/lib/auth.ts` — every public Convex function starts here, never with a
raw `ctx.auth.getUserIdentity()`:

```ts
getAuthUserId(ctx): Promise<Id<"users"> | null>   // null when unauthenticated
getAuthUser(ctx): Promise<Doc<"users"> | null>
getUserByAuthId(ctx, authId): Promise<Doc<"users"> | null>
```

`identity.subject` is the Better Auth user id, so the lookup is a single indexed
read — no round trip into the auth component. When later phases add deactivated
accounts or system roles, `getAuthUserId` is the one place that enforces them.

## Access model (Phase 2)

Two orthogonal axes on `organizationMembers`, resolved once per request in
`convex/lib/access.ts`. This is the only module that decides who may see or do
what; nothing else re-implements a rule from it.

| Axis | Values | Meaning |
|---|---|---|
| `role` | `owner` · `admin` · `member` | `owner`/`admin` = manager: org settings, members, invites, project settings |
| `access` | `full` · `limited` | `full` sees **every** project in the org, including ones created later. `limited` sees **only** the projects listed for it in `projectMembers`. |

- An invite is either **to the whole organization** (accepting it grants
  `access: "full"`) or **to one project** (accepting it grants `access:
  "limited"` plus one `projectMembers` row). A project invite never downgrades
  an existing `full` member; an organization invite upgrades a `limited` one.
- Only a `full` member may create a project — a `limited` member would lose
  sight of what they just created.
- Archived projects drop out of `listVisible` but stay readable through
  `projects.get`, so an archived project's URL still works for its managers.

```ts
getOrgAccess(ctx, userId, organizationId): Promise<OrgAccess | null>
getProjectAccess(ctx, userId, projectId): Promise<ProjectAccess | null>
listVisibleProjects(ctx, userId, organizationId): Promise<Doc<"projects">[]>

canManageOrg(access) / isOwner(access) / canCreateProject(access)
canManageProject(projectAccess)

requireOrgAccess / requireOrgManager / requireProjectAccess / requireProjectManager
// → throw Czech messages; queries use the non-throwing pair and return [] / null
```

`OrgAccess` is `{ organizationId, userId, membershipId, role, access }`;
`ProjectAccess` is `{ project, org }`.

Guards that must stay in place: only an owner may touch an owner or hand out the
owner role; the last owner can never be demoted or removed; removing a member
also deletes their `projectMembers` rows; **only an owner may delete the
organization** — an admin runs it, the owner ends it.

### Tables

```
organizations        name, createdBy
organizationMembers  organizationId, userId, role, access
                     by_org · by_user · by_org_user
projects             organizationId, name, iconStorageId?, iconSvg?, emoji?,
                     createdBy, archived?   — the three icons are exclusive
                     by_org · by_icon_storage
projectMembers       projectId, userId, organizationId   — explicit grant, only
                     `limited` members need one
                     by_project · by_user · by_project_user · by_org_user
invites              organizationId, projectId?, code, createdBy, expiresAt,
                     revoked?, usedCount, acceptedBy?
                     by_code · by_org · by_org_project · by_project
taskStatuses         projectId, organizationId, name, color, order, kind
                     by_project
tasks                projectId, organizationId, title, statusId, order,
                     createdBy, assigneeId?, updatedAt
                     by_project · by_status · by_project_assignee
taskContent          taskId, projectId, organizationId, content, updatedBy,
                     updatedAt                                        by_task
files                taskId, projectId, organizationId, storageId, fileName,
                     mimeType, size, context, commentId?, uploadedBy
                     by_task · by_task_context · by_context · by_comment ·
                     by_storage
comments             taskId, projectId, organizationId, authorId, body,
                     attachmentIds?, edited?                          by_task
activityLogs         organizationId, actorId, type, targetId?, meta?    by_org
```

Shared validators live in `convex/schema.ts`: `organizationRoles`,
`memberAccessLevels`, `inviteExpiryPresets`, `taskStatusColors`,
`taskStatusKinds`, `fileContexts`, `activityTypes`.

### Invite lifecycle

- Code: 10 symbols from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no `0`/`O`/`1`/`I`/`L`),
  `crypto.getRandomValues` with rejection sampling, ~49 bits, unique via `by_code`.
- Expiry presets, mapped server-side (the client sends the preset, never a date):
  `6h` · `24h` · `48h` · `7d` (default) · `30d`.
- Link format: `${NEXT_PUBLIC_SITE_URL}/join/<code>`.
- `invites.getByCode` is the **only public (unauthenticated) function** in the
  app. It returns display copy — organization name, project name, inviter name,
  expiry, expired/revoked/used — and no ids. Its explicit return validator keeps
  this public surface from accidentally growing.
- Every code is **single-use**. The first account atomically records
  `acceptedBy` and consumes it; another account gets "Pozvánka už byla použita".
  Redeeming it again as the same account is idempotent and returns the same
  destination without incrementing `usedCount`.
- Organization settings list only organization-wide invites; a project's
  settings list only that project's invites. A limited admin may create, list
  and revoke project invites only for projects they can actually open.
- Audited actions (`activityLogs`): organization created/renamed, invite
  created/accepted/revoked, member role changed/removed, project
  created/renamed/archived/restored, task created / status changed / deleted.
  The `type` union is never taken from client arguments.

### Deleting an organization

`organizations.remove({ organizationId, name })` — **owner only**, and the name
has to be typed out (`isSameName` in `convex/lib/validation.ts`, imported by the
dialog *and* by the mutation, so the button can never be enabled for a value the
server would refuse; case and extra spaces are forgiven).

The delete is split in two on purpose:

- **The transaction** deletes exactly the two tables that are a way in:
  `organizationMembers` — every read and write in the app authorizes through one
  — and `invites`, the only public entry point. Both are bounded by the size of
  the team, so they always fit in one mutation, and once they are gone the
  organization is unreachable for everybody, its owner included. Queries fail
  soft to `[]` / `null`, mutations throw. Then it schedules the purge.
- **`internal.organizationPurge.purge`** empties the rest — projects, boards,
  tasks, bodies, files *and their blobs*, comments, the audit trail — in runs of
  **200 documents**, rescheduling itself with no delay while there is work left,
  and deleting the `organizations` row as its last act.

Why not one cascade: a Convex mutation is a transaction with a document limit and
an organization is unbounded. A delete button that works on a fresh organization
and fails on a year-old one is worse than no button. Progress is measured by
deletion, never by a cursor — every run starts from the first remaining row —
which makes the job restartable and safe to run by hand:

```bash
pnpm exec convex run organizationPurge:purge '{"organizationId": "..."}'
```

Nothing is audited: `activityLogs` is scoped by organization, so the row would be
deleted seconds later by the purge that carries the rest of them away.

In the UI it is the last card of `/nastaveni/organizace`, rendered only for
`canDelete` (the owner). Afterwards the client clears
`localStorage["workeee-org"]` and goes to `/`, where the provider falls back to
another membership or the onboarding screen.

### Project icons

A project's icon is **an uploaded raster image, an SVG or an emoji — never two
at once**. `projects` carries `iconStorageId`, `iconSvg` and `emoji`, and every
mutation that sets one clears the other two, so `ProjectIcon` renders image →
emoji → letter tile with no precedence rule to argue about. With none of them it
falls back to a deterministic colored tile with the project's first letter.

- Upload: `projects.generateUploadUrl` (project-manager only) → client `POST`s
  the blob → `projects.setIcon`. `setIcon` validates the **stored** metadata via
  `ctx.db.system.get(storageId)` — must be `image/*`, must not be
  `image/svg+xml` (see below — a blob has a URL, and that is the whole problem)
  and ≤ 2 MB, otherwise the blob is deleted and the mutation returns
  `{ ok: false, error }`. The type is compared through `baseMimeType`
  (`convex/lib/files.ts`), so parameters and casing cannot smuggle an SVG past
  the exclusion. Replacing or removing an icon deletes the old blob; nothing
  else references it.
- **PNG, JPG, WEBP, GIF and `.ico`.** A favicon is the file a team already has
  of itself, so it is accepted like any other raster image — the server's rule
  is `image/*` and always was, and the work is on the browser side, in
  `src/lib/project-icons.ts`: the file picker's `accept` lists `image/x-icon`
  (Chrome), `image/vnd.microsoft.icon` (Firefox) **and** the bare `.ico`, and
  `iconMimeType(file)` decides the `Content-Type` the blob is uploaded under.
  That last one is the part that matters: a machine whose registry has no entry
  for the extension reports no type at all, the blob would reach storage
  unnamed, and `setIcon` — which trusts the *stored* type — would refuse it as
  "not an image". So an unnamed (or `application/octet-stream`) file whose name
  ends in `.ico` is uploaded as `image/x-icon`. Trusting the extension there
  gives away nothing: the browser writes that header itself, so a client that
  wanted to lie about a file never needed the fallback. `validateIconFile` is
  the same rule, one round trip earlier, and `isSvgFile` is what sends a file
  down the other road; all three are unit-tested in
  `src/lib/project-icons.test.ts`, which is the only place the *upload* rules
  can be tested — `convex-test`'s `storage.store` records no content type.
- **SVG never becomes a blob.** It is the one image format that is also a
  document: opened as a page it runs script on the origin it was served from,
  and `ctx.storage.getUrl` hands out exactly such a page. So an SVG icon takes
  the other road — `projects.setSvgIcon({ projectId, svg })` carries the
  *markup* as a mutation argument, `convex/lib/svg.ts` validates it, and it is
  stored **on the project document** (`iconSvg`, ≤ 32 kB). `projects.get` and
  `listVisible` serve it through `svgDataUrl` as a `data:` URI, which has no
  origin to execute in and which browsers have refused to navigate to for years.
  Both halves of the danger are removed rather than mitigated, which is why
  `setIcon` still refuses `image/svg+xml` and always will: **the format is not
  the problem, the URL is.**
  - The sanitizer **validates, not cleans**: element, attribute and reference
    allowlists, and anything it cannot prove harmless is refused with a sentence
    naming it. Cleaning means guessing what a browser will make of the
    leftovers. It is also stricter than XML on purpose — unquoted attribute
    values, CDATA, doctypes, processing instructions, numeric character
    references and control bytes are all refused, because each is a place where
    its reading and a browser's could differ, and no exported icon contains one.
  - It is the whole of `convex/svg.test.ts`, half of which is an attack battery
    (`<script>`, `onload`, `<foreignObject>`, `@import`, `url(https://…)`,
    `&#106;avascript:`, a nested `<svg>`, an entity declaration).
  - The 32 kB cap is not about parsing, it is about `listVisible`: every screen
    subscribes to it, and the markup rides along in the payload.
  - Two things it *does* rewrite: the XML declaration and comments are dropped,
    and a missing `xmlns` is added — without the namespace an SVG renders as
    nothing inside an `<img>`.
- Emoji: `projects.setEmoji` (project-manager only), or the optional `emoji`
  argument of `projects.create`. The grid the client offers
  (`src/lib/project-emojis.ts`) is **not** known to the server — duplicating it
  would only let the two lists drift. `normalizeEmoji`
  (`convex/lib/validation.ts`) validates the *shape* instead: ≤ 16 code units,
  at least one `\p{Extended_Pictographic}`, and nothing but pictographs,
  modifiers, ZWJ and variation selectors. A name, a URL or a script tag can
  never reach a field every screen renders.

The picker itself (`src/components/projects/project-icon-picker.tsx`) is
controlled and shared by both dialogs. That is what lets "Nový projekt"
**stage** an image — `generateUploadUrl` is authorized against a project that
does not exist yet, so the dialog creates the project, then follows the ordinary
upload path and toasts "Projekt je založený, ale ikonu se nepovedlo nahrát" if
only the second half fails — while the settings dialog writes every choice
immediately. It renders the control and nothing else: the rules an uploaded file
has to satisfy live in `src/lib/project-icons.ts`, because the two dialogs need
them for the upload itself, not only for the input.

### Where a project is created

**The rail owns "Nový projekt"** — a dashed button under the project list
(`src/components/projects/new-project-button.tsx`), visible only to `full`
members, reachable from every screen. The dashboard has *no* create action: it
owns the heading "Projekty", and a second button would have put the same label
on the same screen twice. Its empty state points at the rail instead.

## Tasks and the board (Phase 3)

A project is a Kanban board: one column per **task status**, cards dragged
within and between columns.

### Statuses — core and custom

Creating a project seeds exactly three statuses (`convex/lib/taskStatuses.ts`,
`CORE_STATUSES`): **To-do** (`todo`, gray), **V průběhu** (`in_progress`, blue),
**Hotovo** (`done`, green). `kind` carries the meaning after a rename, which is
what later "done" semantics read — the three may be renamed, recolored and
reordered, but **never deleted**. Everything a user adds is `kind: "custom"` and
deleting it *requires* a `moveTasksToStatusId`: tasks are reassigned, never
orphaned. Cap: 12 statuses per project.

`seedProjectStatuses` is idempotent (it no-ops on a project that already has a
status), so the backfill `internal.migrations.seedTaskStatuses` — kept in
`convex/migrations.ts`, run once with
`pnpm exec convex run migrations:seedTaskStatuses` — is safe to re-run.

Every status mutation is **project-member level**, not manager level: the board
is a shared working surface. Deleting a task is the one narrower rule — author
or project manager.

### Fractional ordering

`order` on a task is its position inside the column and is fractional. The
client never sends a number; `tasks.move` takes `previousTaskId` / `nextTaskId`
and the server reads their current orders, so two people dragging at once both
land somewhere sane. Helpers in `convex/lib/ordering.ts`:

- `ORDER_STEP = 1024` — spacing between freshly numbered neighbours.
- `orderBetween(prev, next)` — the midpoint, or `null` when the gap has shrunk
  below `MIN_ORDER_GAP` (1/1024).
- On `null` the column is **renumbered** (`renumber(n)` → 1024, 2048, …) with a
  slot left for the moved card. Rare; a drag is otherwise one document write.
- Both neighbours absent means "append at the end" — which is also what a plain
  status change from the task detail page does.

Statuses use the same numbers but are always renumbered in one pass:
`taskStatuses.reorder` takes the ids the client can see, keeps anything it did
not mention (a column someone else just added) at the end, and rewrites `order`.

### The board client

`src/components/tasks/task-board.tsx` holds one `DndContext` for both cards
(`data.type === "task"`) and columns (`data.type === "column"`, dragged by the
header). There is **no optimistic-update layer**: a drag keeps a local *drag
override* of the arrangement only until the mutation resolves, then drops it and
the server is the truth again. Nothing syncs server data into state, so no
effect calls `setState`. Drag failures toast; drag successes are silent.

`src/lib/task-status-colors.ts` is the only place a color key becomes CSS —
palette keys `gray · blue · indigo · violet · amber · orange · red · green ·
teal`, mapped to the Tailwind alpha convention plus a dot class, with the three
suggested templates ("Potřeba revize" amber, "Potřeba informace" violet,
"Odpověď" teal) as client-side copy, not schema.

`projects.assignableMembers` — not `organizations.members` — feeds the assignee
select: it returns the `full` members plus everyone with an explicit grant, and
`tasks.setAssignee` re-checks that the assignee can open the project.

### How wide the board has to be

The board is the only screen with a hard width appetite, and two rules keep it
from spending that appetite out of the page:

- **`main` carries `min-w-0`** (`app-shell.tsx`). The board strip is
  `overflow-x-auto` with a `min-w-max` row inside it, and a flex item's
  automatic minimum size is its min-content size — so without `min-w-0` that
  `min-w-max` propagated all the way up and stretched `main` to the whole
  board. The strip then never scrolled, the **document** did, and the project
  header's "Nastavení" was dragged off the right edge of a 1294 px window. The
  symptom looks like a header bug and is a flex-sizing one.
- **Columns are `w-64`, and `board:w-72` (≥ 1408 px)**, with the "Přidat stav"
  button sized to its label (`w-fit`) rather than to a column. The arithmetic:
  usable width is `min(viewport − 256 rail, 1152) − 64 padding`, and a default
  three-status board needs `3 × column + 3 × 16 gap + ~124 button`. At 256 px
  columns that is ~940 px, so a fresh project stops scrolling sideways from
  about **1260 px** — it used to need 1408. 1408 is exactly where 288 px
  columns fit, which is what `--breakpoint-board` names.

Below ~1260 px the strip scrolls horizontally, which is what a Kanban board is
supposed to do. The page never does.

### Client-side tenant context

`OrganizationProvider` (`src/components/providers/organization-provider.tsx`)
holds the membership list and the current organization, persisted in
`localStorage["workeee-org"]` through `src/lib/current-organization.ts`
(a `useSyncExternalStore` store, not an effect). Read it with:

```ts
const { organizationId, organization, canManage, setOrganizationId } =
  useCurrentOrganization();
const data = useQuery(api.x.list, organizationId ? { organizationId } : "skip");
```

The stored id is only a preference — the current organization is always one the
server returned a membership for, so a stale id falls back to the first one.
`storeOrganizationId` is exported separately for the public join page, which
lives outside the provider.

## The task drawer (Phase 4, reshaped in Phase 6)

A task never leaves its board. Clicking a card opens the detail in a **drawer on
the right of `/projekt/[id]`**; the board stays where it was, and the open task
is written into the address as `?ukol=<taskId>`.

- `TaskDrawer` (`src/components/tasks/task-drawer.tsx`) is a **non-modal**
  `Sheet`, which is why `SheetContent` takes `showOverlay`: an overlay would
  swallow the clicks that are the point of staying on the board. So while the
  panel is open, cards still drag, and clicking another card swaps the panel
  over instead of closing it first. Nothing dismisses on an outside click —
  every outside click on this screen belongs to the board. Closing is the X or
  Escape.
- The panel is keyed by the task id, so switching cards **mounts a fresh panel**
  rather than pushing another task's data into the one being edited.
- `ProjectScreen` owns the open task and writes the address with
  `window.history.replaceState` — a shallow write, not a navigation, so the
  panel opens instantly and the URL is still copy-pasteable. The drawer is
  therefore invisible to the back button; back leaves the project.
  `/projekt/[id]` is keyed by the project id so another project never inherits
  the previous board's open task.
- `/projekt/[id]/ukol/[taskId]` survives as a `redirect` to `?ukol=`, for links
  made before the drawer existed.

Order inside the panel: header (project name · save indicator · delete · close)
→ title → status + assignee selects → meta line → **description editor** →
**Přílohy** → **Komentáře**. Each section owns its heading exactly once; the
editor has no heading at all, because the body *is* the panel — and it is the
one section with no `Separator` above it, for the same reason.

The panel is laid out like a Notion page: the header is a **toolbar** and hugs
the edge (`px-4 sm:px-6`), while the column under it is indented to
`px-4 sm:px-14`. The two do not line up on purpose. That `3.5rem` is the gutter
`.workeee-editor` borrows back so the block handles land in it instead of
floating outside the panel (see **The task body editor**).

### Everything saves itself

There is no save button anywhere in the panel, and no dialog to confirm an edit:

| Control | When it writes |
|---|---|
| Title | debounced 700 ms while typing, flushed on blur, Enter and unmount |
| Stav · Řešitel | on change |
| Description | debounced 1 s, flushed on unmount |
| **Komentáře** | **never automatically** — a message is *sent*, on Enter or the button |

The comment composer is the deliberate exception: a half-written message is not
a draft of a record, it is a thought that was not finished. Editing an existing
comment stays explicit too (Uložit / Zrušit).

`useAutosaveText` (`src/hooks/use-autosave-text.ts`) is the shared mechanism.
The rules that keep it honest:

- **The value is local from mount on.** The server value is the *initial* value
  and nothing pushes later query results back in, which would fight whoever is
  typing — the same rule the body editor already followed. Remount by `key` to
  load another record.
- **It flushes from its effect cleanup**, so closing the drawer inside the
  debounce window still writes. That is why `save` and `canSave` must be stable
  (a Convex mutation, a `useCallback`, or a module-level function): an identity
  that changed every render would write on every render.
- It skips a write that would repeat what the server already holds, and
  `canSave` refuses the ones that are not worth making — an empty title is a
  moment while typing, not something to store.

Feedback is **one indicator for the whole panel**, in the header
(`task-save-indicator.tsx`): a muted "Ukládá se… / Uloženo" that fades after
2 s. Every autosaving control reports into it through `onSaveState`; none of
them draws its own. Success never toasts — only a failure does.

### The task body editor

`taskContent` holds one row per task — the BlockNote document serialized to JSON,
upserted by `taskContent.save`. The server treats the string as opaque: it checks
that it parses and is under **1 MB**, and never walks the blocks.

```ts
taskContent.get   ({ taskId })                 → { content, updatedAt } | null   // fail soft
taskContent.save  ({ taskId, content })        // project member; bumps tasks.updatedAt
```

Client rules that matter (`src/components/tasks/task-description-editor.tsx`):

- **Initial content is passed once, at mount.** The parent renders a skeleton
  until `taskContent.get` resolves and then mounts the editor with
  `key={task._id}`. Pushing every query update back into BlockNote would fight
  whoever is typing.
- **Autosave is debounced 1 s** after the last change, and the pending document
  is flushed from the effect cleanup so closing the drawer mid-debounce does not
  lose it. The state is reported up through `onSaveState`; the indicator lives
  in the drawer header, not here.
- Images and files dropped into the document go through BlockNote's `uploadFile`
  hook into Convex storage as `context: "content"` and are stored in the document
  as their serving URL.
- Czech copy for the slash menu, toolbars and placeholders lives in
  `src/lib/blocknote-cs.ts` — BlockNote ships 24 locales and Czech is not one of
  them, so it spreads `en` and overrides everything a person reads.
  **Two slash-menu groups must never share a name**: the menu keys its group
  headers by the group string and duplicates crash the React key check. Keep the
  `Nadpisy` / `Podnadpisy` split that mirrors `en`'s `Headings` / `Subheadings`.

`globals.css` carries **two** BlockNote lines and they do different jobs — one is
not a substitute for the other:

```css
@import "@blocknote/shadcn/style.css";
@source "../../node_modules/@blocknote/shadcn/dist/blocknote-shadcn.js";
```

- The **stylesheet** is the editor's layout: block geometry, list markers, the
  heading scale, the inline placeholder, `outline: none` on the document. Drop
  it and what is left is bare ProseMirror — the browser paints its own focus
  ring around the whole body (recoloured indigo by `* { outline-ring/50 }`, so it
  reads as two stray blue rules), the placeholder falls onto the line *below* the
  caret because `.bn-block-content` is no longer `display: flex`, and "Nadpis 1"
  applies but renders at body size. That last one is why the symptom people
  report is **"the slash commands don't work"**: they do, invisibly.
- The **`@source`** is for the menus only. The shadcn UI package ships them as
  Tailwind classes inside its JS bundle rather than as compiled CSS, so Tailwind
  has to scan that bundle to emit them.

The same file repoints BlockNote's `--bn-colors-*` at our tokens under
`.workeee-editor`, which is what makes both themes correct; the `theme` prop only
flips `data-color-scheme` and comes from `useTheme()`.

Geometry — Notion's gutter, and the reason the panel is indented:

- BlockNote positions the block handles against `.bn-editor`'s own inline
  padding. So the panel pads its column by `3.5rem`, the editor claims it back
  with `margin-inline: -3.5rem` and re-applies it as `padding-inline`. The text
  column then starts exactly where the task title does, and the handles sit in
  the margin — inside the panel, clear of the text.
- The breakpoint is **`sm`, not the app-wide `lg`**: what decides whether there
  is room is the drawer's own width, and the drawer reaches its full
  `max-w-2xl` at `sm`. Below it the panel is a phone-width sheet, so the handles
  are dropped and the "/" menu carries the block commands alone.
- Body text is `0.9375rem / 1.65` and headings are capped below the task title
  (`text-2xl`) by overriding BlockNote's `--level`: `1.375rem` · `1.125rem` ·
  `1rem`, then `0.9375rem` for 4–6. A heading is a divider inside a description,
  not a competitor to the name of the task.

### Files

One `files` table for three surfaces, told apart by `context`:

| `context` | Where it shows | Uploaded from |
|---|---|---|
| `attachment` | the **Přílohy** list | the "Nahrát soubor" button |
| `content` | inside the description document | BlockNote's `uploadFile` |
| `comment` | under a comment | the composer (button or paste) |

```ts
files.generateUploadUrl ({ taskId })                                   // project member
files.register ({ taskId, storageId, fileName, mimeType, context })
  → { ok: true, file: { _id, fileName, mimeType, size, isImage, url } }
  | { ok: false, error }
files.listByTask ({ taskId })   → attachment rows + url + uploader     // fail soft
files.remove ({ fileId })                                              // uploader or manager
```

Validation, all against the **stored** blob (`convex/lib/files.ts`):

- ≤ **10 MB**, non-empty, and a content type that is neither missing nor on the
  blocklist (`text/html`, `application/xhtml+xml`, `image/svg+xml`, Windows
  executables). The stored content type wins; the client's claim is only used
  when storage recorded none, and the blocklist is applied to both.
- ≤ **30 files per task per `context`**.
- A `storageId` already registered is refused — blobs are never shared between
  rows, so deleting one row can never empty another's file.
- A `comment` file is claimed by `comments.create` (it gets a `commentId`), and
  from then on `files.remove` refuses it: it is deleted with its comment.

**`files.register` returns a result instead of throwing.** A Convex mutation is a
transaction, so `ctx.storage.delete(...)` followed by `throw` is rolled back and
the rejected blob stays in storage forever. Refusing a file therefore has to
commit. `src/lib/upload.ts` turns `{ ok: false }` back into a thrown `Error`, so
every call site keeps the usual try / catch / toast. Failures where the blob is
**not ours to delete** — not signed in, no access to the task, someone else's
storage id — still throw and leave the blob alone. `projects.setIcon` follows the
same rule.

`tasks.remove` cascades: the body row, every file (blob included) and every
comment go with the task.

### Comments

`comments.body` is a **serialized segment array**, never markdown:

```json
[{"type":"text","text":"Mrkni na to "},
 {"type":"mention","userId":"j57…","name":"Jana Nováková"},
 {"type":"text","text":", prosím."}]
```

The codec is `convex/lib/commentBody.ts` and it is imported by **both** sides —
the composer builds segments with it, `convex/comments.ts` re-parses and re-checks
them. A mention survives as a real `Id<"users">`, so the notifications of a later
phase read ids instead of re-parsing prose; the `name` beside it is display copy
frozen at the moment the comment was written. Caps: 5 000 plain-text characters,
200 segments, 10 attachments.

```ts
comments.listByTask ({ taskId })  → [{ _id, author, body, attachments, edited,
                                       createdAt, canEdit, canRemove }]  // asc, take 200
comments.create ({ taskId, body, attachmentIds? }) → { commentId }       // project member
comments.update ({ commentId, body })                                    // author only
comments.remove ({ commentId })                                          // author or manager
```

Server-side rules: every mentioned id must be in `listProjectMemberIds` (the same
set `projects.assignableMembers` renders); every attachment must be a `files` row
on this task, uploaded by the author, `context: "comment"`, and not already
claimed. All three mutations bump `tasks.updatedAt`. Mentions are **visual
tagging only in v1** — nothing is notified.

The composer (`src/components/tasks/mention-textarea.tsx`) edits a plain string:
a mention is written as `@Jméno Příjmení` and the draft carries the user id that
name belongs to (`src/lib/comment-draft.ts`). Serializing scans the text for the
names it knows; deleting a character of a name turns it back into plain text,
which is exactly right. The indigo chips are a **backdrop**: a div in normal flow
renders the styled text and therefore sets the height, and the textarea lies on
top of it with transparent text — one element owns the typography, and the
auto-growing is free. `@` opens the member picker (arrows / Enter / Tab / Esc),
Enter sends, Shift+Enter is a newline, pasting an image uploads it.

## Scheduled jobs (Phase 5)

`convex/crons.ts` holds one entry per job; each points at an internal function
that is also runnable by hand with `pnpm exec convex run`. The organization purge is
scheduled too but is **not** a cron — it is started by `organizations.remove` and
reschedules itself; see **Deleting an organization**.

### The orphaned-file reaper

Two of the three upload surfaces can strand a blob:

- a **comment** upload happens before the comment exists, and `comments.create`
  is what claims it by writing `commentId`. An abandoned composer leaves a
  `comment` file that no comment claims — `files.remove` refuses claimed files
  and nothing lists unclaimed ones, so it would live forever.
- a **content** upload is written into the BlockNote document as its serving
  URL. Deleting the image block removes the URL; the row and the blob stay.

`internal.fileReaper.reapOrphanedFiles` sweeps both once a day (03:20 UTC):

```ts
reapOrphanedFiles({ olderThanMs?, limit? })
  → { comment: number, content: number, scanned: number }
```

- **The grace period is the safety.** Only rows older than `olderThanMs`
  (default **24 h**) are eligible — a file uploaded seconds ago is still being
  written into a comment or into a document that has not autosaved yet.
- **Index-driven.** `files.by_context` is `["context"]` plus Convex's implicit
  `_creationTime`, so each branch reads its own candidates oldest-first with the
  threshold applied *inside* the index range: `q.eq("context", …).lt("_creationTime", cutoff)`.
- **Bounded.** At most `limit` rows per branch per run (default 500).
- A `content` file counts as referenced when the task's `taskContent.content`
  contains either its storage id or its serving URL; a task with no
  `taskContent` row has an empty description, so every `content` file on it is
  an orphan. `attachment` files are never touched — they are listed, not
  referenced.
- `olderThanMs` is an argument and not a constant **because a test cannot age a
  row**: `_creationTime` is assigned by the database. `convex/fileReaper.test.ts`
  measures the age against the newest `files` row instead of against the clock.

Known limitation: the content branch rescans referenced files first (they are
the oldest), so a deployment with more than `limit` body images would starve the
tail. At this app's scale the cap is orders of magnitude above a day's uploads;
raise `limit` before that stops being true.

## Routes

| Route | Access | What it is |
|---|---|---|
| `/` | authenticated | Dashboard — "Projekty": every visible project of the current organization as a card. Creating one lives in the rail, not here. With no membership it renders the onboarding screen (create organization / join by code) |
| `/projekt/[id]` | project members | Project header + settings dialog for managers + the Kanban board. `?ukol=<taskId>` opens that task in the drawer on the right: title, status, assignee, meta, block-editor description, Přílohy, Komentáře |
| `/projekt/[id]/ukol/[taskId]` | project members | Redirect to `/projekt/[id]?ukol=<taskId>` — the detail is a drawer now |
| `/nastaveni/organizace` | org managers | Rename, members table, organization invites; the owner also gets the delete card |
| `/join/[code]` | **public** | Invite summary; unauthenticated visitors go to `/registrace?invite=<code>` or `/prihlaseni?invite=<code>` and come back here to accept |
| `/prihlaseni`, `/registrace` | public | Auth; `?invite=<code>` redirects back to the join page afterwards |

## Design system

- Tokens are **HSL channel triples** on `:root` / `.dark` in
  `src/app/globals.css`, exposed via `@theme inline` as `hsl(var(--token))`.
- **One accent: indigo `243 75% 59%`** (dark: `243 75% 66%`) on `--primary` and
  `--ring`. Everything else is neutral grayscale. `--accent` is a neutral hover
  surface — never repaint it with the brand color.
- `--radius: 0.625rem`; control heights `h-8/h-9`; icons `size-4`; cards
  `rounded-xl`. Never nest a card inside a card.
- Dark mode is **class-based and hand-rolled**: `@custom-variant dark (&:is(.dark *))`,
  a pre-hydration inline script in `layout.tsx` reading
  `localStorage["workeee-theme"]`, and `useTheme()` (`src/hooks/use-theme.ts`)
  which observes the `dark` class on `<html>` via `useSyncExternalStore`.
  **No `next-themes`.**
- Single typeface: Geist Sans (`--font-sans`, also `--font-heading`). Headings
  differ by weight, not family.
- Breakpoint contract: `lg:` (1024 px) splits the desktop sidebar from the
  mobile drawer. One custom breakpoint exists, **`board:` (1408 px)**, declared
  in `globals.css` — it is not about the shell but about the board; see
  **How wide the board has to be**.
- The shell's content column is **`max-w-6xl`**, so the widest the board strip
  can ever be is 1088 px. `main` also carries **`min-w-0`** — see
  **How wide the board has to be**, it is the difference between the board
  scrolling and the page scrolling.
- "Nothing here (yet)" and "this address leads nowhere" share one component,
  `src/components/layout/empty-state.tsx` — a dashed panel with a heading, one
  sentence and the action or link that unblocks the person. The dashboard, a
  missing project or task, the organization settings guards and the 404 page all
  use it, so all five read the same.

## The mark, the icons and the link previews

### The mark

`src/app/icon.svg` is the only drawing of the brand: the indigo tile
(`#4F46E5`, the light theme's `--primary`, radius `14.5/64` ≈ the platform
squircle) and a white **W**. The W is a **filled letterform** — flat top
terminals, a pointed apex at cap height, pointed feet — not a stroked zigzag,
so it reads as a letter at 96 px and still as a letter at 16. The `stroke` in
the same white is a 1.5-unit softening of the vertices; sharp needles go wispy
once the tile is 16 px, and the softness is the same idea as `--radius`.

The two raster files beside it are **rasterized from that SVG** and have no
other source. Chrome is the rasterizer, because it is the renderer the icon has
to survive anyway:

```bash
# 16 / 32 / 48 for the .ico, 180 (with the rounded corners removed) for iOS
chrome --headless --default-background-color=00000000 \
       --screenshot=out.png --window-size=N,N --force-device-scale-factor=1 wrapper.html
```

- `favicon.ico` — 16 · 32 · 48 PNGs in an ICO container. It exists because
  crawlers, chat clients and feed readers still ask for `/favicon.ico` by hand.
  It replaced `create-next-app`'s 25 931-byte default, which had been shipping
  the Next.js logo as this product's icon.
- `apple-icon.png` — 180 × 180, **full bleed, no rounded corners**: iOS applies
  its own mask, and our corners under its mask would show as pale notches.

### The link previews

`src/lib/og.tsx` draws every unfurl: 1200 × 630, the dark theme's colors spelled
out (Satori never sees `globals.css`), the mark and the wordmark at the top, one
big line at the bottom, an optional chip on the right and an optional muted line
under the title. Two callers, and neither adds a design:

| File | What it says |
|---|---|
| `src/app/opengraph-image.tsx` | "Interní aplikace pro týmy, projekty a úkoly." — inherited by every route |
| `src/app/join/[code]/opengraph-image.tsx` | chip "Pozvánka" + "Připojte se k organizaci" |

The invite page gets its own because **an invite link is the one address people
paste into a chat**. It deliberately names no organization: the unfurl is cached
and re-shared by the chat, not by the person who was invited, and
`invites.getByCode` is public enough already.

- **`metadataBase` is `NEXT_PUBLIC_SITE_URL`** (`layout.tsx`) — the same origin
  invite links are built from, so a misconfigured deployment gets both wrong at
  once instead of one of them quietly.
- **There are no `twitter-image` files.** Next fills `twitter:image` from the
  OpenGraph image on its own; a second copy would be a second thing to keep in
  sync. `twitter.card` is `summary_large_image` so X renders it big.
- `openGraph` in a child's metadata **replaces** the layout's rather than merging
  into it, which is why the join page repeats `siteName` / `locale` / `type` in
  full. It leaves `images` out on purpose — that omission is what lets the
  `opengraph-image.tsx` beside it supply the picture.
- Geist is fetched from Google Fonts at render time and the root image is
  therefore **prerendered at build**, the same network the app already needs for
  `next/font`. If the fetch fails the fonts are dropped and `ImageResponse`
  falls back to its bundled face — a preview in the wrong typeface still beats
  no preview.
- The mark is spelled out a second time inside `og.tsx` as a data URI, because
  Satori is not the DOM and cannot import `icon.svg`. **The two carry the same
  path and change together.**

## Locale

- All user-facing text is **Czech**, sentence case, concrete, no marketing voice.
  **No duplicate labels on one screen** — this is the product owner's first
  rule, and it decides real structure, not just wording:
  - The **dashboard owns the word "Projekty", the rail owns the "Nový projekt"
    action** — each exactly once, on every screen. The rail carries no section
    caption and says nothing when the list is empty (the dashboard says it);
    the dashboard carries no create button (the rail has it, and it is reachable
    from every page). The wordmark at the top of the rail is the link back to
    the dashboard.
  - A dialog's description must not be a table of contents of its own sections.
    When there is nothing to add, drop `DialogDescription` and pass
    `aria-describedby={undefined}` to `DialogContent` — that is how Radix is
    told the omission is deliberate.
  - One concept, one Czech word, everywhere: **pozvánka · organizace · projekt ·
    úkol · stav · člen · řešitel · příloha · komentář**. A create action is
    "Nová organizace" / "Nový projekt" in the menu that opens it *and* in the
    dialog title, and the dialog's submit button is the bare verb ("Vytvořit").
  - A toggle's label names what the click will do, not what is on now
    ("Světlý režim" while the app is dark).
- All code identifiers, comments and table names are **English**. Routes follow
  the business vocabulary and are therefore Czech (`/prihlaseni`, `/registrace`).
- Auth error copy lives in one place: `src/lib/auth-errors.ts`.
- Czech plurals need 1 / 2–4 / 5+ forms — `plural(count, one, few, many)` in
  `src/lib/format.ts` is the one helper; never write `${n} položek`.
- Dates, file sizes and relative times all go through `src/lib/format.ts`
  (`formatDate`, `formatDateTime`, `formatExpiry`, `formatFileSize`,
  `formatRelativeTime`). No `date-fns` — the repo formats with `Intl` and takes
  `now` as an argument so render stays pure.

## Domain plan

```
users                 identity, mirrored from Better Auth
organizations         tenant boundary + settings
organizationMembers   role + access level per user per organization
invites               code + link, expiry preset, revocable, org- or project-wide
projects              belong to one organization
projectMembers        explicit project grant for `limited` members
taskStatuses          per-project columns, customizable (order, name, color, kind)
tasks                 belong to one project, carry a status, position, assignee
taskContent           Notion-like block document for the task body
comments              on tasks, with @mentions and inline images
files                 Convex storage, entity-scoped access
activityLogs          audit trail
```

Day-one decisions:

1. **Tenancy: organization-scoped.** Every downstream table carries
   `organizationId` (or reaches it through `projectId`) and every index starts
   with it.
2. **Roles: two layers.** System role on `users` (later), organization role on
   `organizationMembers`. The permission matrix lives in one module
   (`convex/lib/access.ts`).
3. **Row visibility: per-membership, two levels.** `organizationMembers.access`
   is `full` (every project of the organization, including future ones) or
   `limited` (only the projects listed in `projectMembers`). Which one a person
   gets is decided by the invite they accepted — organization invite → `full`,
   project invite → `limited`. Enforced server-side in `convex/lib/access.ts`;
   the UI only mirrors it. See **Access model**.
4. **Accent:** indigo. **Typeface:** Geist Sans only.
5. **Locale:** Czech UI, English code.
6. **Audited actions**: organization created/renamed, invite
   created/accepted/revoked, member role changed/removed, project
   created/renamed/archived/restored, task created / status changed / deleted.

## Phase roadmap

- **Phase 1 (done).** Scaffold, Convex deployment, Better Auth with
  self-registration, `users` mirror + `getAuthUserId`, Czech auth screens,
  app shell with placeholder sidebar, design tokens, dark mode, docs.
- **Phase 2 (done).** Organizations and projects: create / join by invite code or
  link, membership roles, `full` vs `limited` visibility, `convex/lib/access.ts`
  permission matrix, invite expiry and revocation, organization switcher and
  project list wired to real data, project icons in Convex storage, organization
  and project settings, public `/join/[code]`, audit trail, security tests.
- **Phase 3 (done).** Tasks: per-project customizable task statuses with three
  seeded core statuses, Kanban board with drag & drop (cards and columns),
  fractional ordering, quick-add, status management, task detail page,
  assignment, audit entries, security and ordering tests.
- **Phase 4 (done).** Notion-like BlockNote editor for the task body with
  debounced autosave and inline image upload, files in Convex storage
  (attachments, body images, comment images), comments with @mentions, inline
  images and edit/delete, `tasks.remove` cascade, security and logic tests.
- **Phase 5 (done).** Polish and cleanup: the daily orphaned-file reaper with its
  own cron and tests, the "Projekty" dashboard, friendly Czech states for a
  missing project / task / organization and a real 404, favicon and metadata, one
  shared `EmptyState`, a wider shell so a three-column board fits on a laptop,
  and a copy pass that removed every duplicate label from a screen. The dev
  deployment was emptied of test data.
- **Phase 6 (done).** The task detail moved off its own page and into a
  non-modal drawer beside the board (`?ukol=<taskId>`), the title became an
  always-editable autosaving field, every control in the panel now writes itself
  with one shared save indicator in the header, and comments stayed explicitly
  send-only. The old task route redirects.
- **Phase 6 (done).** Deleting an organization: owner-only `organizations.remove`
  confirmed by name, the batched self-rescheduling `organizationPurge`, the
  delete card in the organization settings, and the cascade's tests.
- **Phase 7 (done).** The description editor, made to look like the Notion it was
  always modelled on: BlockNote's stylesheet is actually imported now, which
  removed the stray focus rule around the body, put the placeholder back on the
  caret's line and made the slash commands visibly do something. The panel gained
  Notion's gutter (`sm:px-14`) so the block handles sit inside it, the header
  became a toolbar at the edge, headings were scaled under the task title, and
  the separator that boxed the body in is gone.
- **Phase 8 (done).** The product finally looks like itself outside its own
  window: a redrawn mark (a filled letterform W on the indigo tile) as
  `icon.svg`, a real `favicon.ico` and an iOS icon rasterized from it — the
  `create-next-app` default had been shipping the Next.js logo until now — and
  generated 1200 × 630 link previews for every route plus a dedicated one for
  the invite page, with `metadataBase`, OpenGraph and Twitter copy to carry them.
- **Phase 9 (done).** The board stopped taking the page with it on a narrow
  laptop: `main` got `min-w-0` so the horizontal scroll belongs to the board
  strip and not to the document, and the columns step down to 256 px below the
  new `board:` (1408 px) breakpoint so a default project fits from ~1260 px
  instead of 1408. See **How wide the board has to be**.
- **Phase 10 (done).** A project icon may now be the file a team already has of
  itself: `.ico` alongside the other raster formats, and **SVG**, which took a
  road of its own — the markup is validated by `convex/lib/svg.ts`, stored on
  the project document and served as a `data:` URI, so the format is supported
  without ever creating the thing that made it dangerous, a URL pointing at an
  SVG. See **Project icons**.
- **Later.** List view, due dates, filters in the URL, notifications, activity
  timeline, audit log surface.

## Continual learning

- `shadcn` v4 dropped `--base-color` / `new-york`; `-b` now selects the
  primitive library (`radix` / `base` / `aria`) and themes come from presets.
  `shadcn init` also emits `@import "shadcn/tailwind.css"`, which the published
  package does not ship — it was removed from `globals.css`.
- Generated shadcn v4 components reference raw `var(--token)` in a few places
  (`sonner`, `button`'s secondary hover). With HSL-triple tokens those must be
  `hsl(var(--token))` or replaced with a utility class, or the color silently
  resolves to nothing.
- `create-next-app .` refuses a directory whose name has capital letters. Scaffold
  into a lowercase subdirectory and move the files up.
- Next.js 16 lint fails on `setState` inside `useEffect`
  (`react-hooks/set-state-in-effect`). Reading DOM/browser state belongs in
  `useSyncExternalStore`, not an effect.
- The React Compiler lint also fails on **`Date.now()` during render**
  (`react-hooks/purity`). Anything time-dependent that a component displays must
  arrive already decided from the server — `invites.list` returns a `status`, and
  `formatExpiry` takes that boolean instead of reading the clock.
- Ids that come from the URL (`/projekt/[id]`) reach Convex as `v.string()` and
  go through `ctx.db.normalizeId`. `v.id("projects")` would turn a hand-edited
  address into an argument-validation error instead of an empty screen.
- `import.meta.glob` (needed by `convex-test`) is a Vite feature and `vite` is
  not hoisted under pnpm, so `vite/client` types do not resolve from the root
  `tsconfig.json`. `convex/authz.test.ts` declares just that one member on
  `ImportMeta`.
- `t.withIdentity(...)` returns `TestConvexForDataModel`, not `TestConvex` —
  annotate test helpers with `ReturnType<Harness["withIdentity"]>`.
- **Reordering inside a column in dnd-kit's `onDragOver` freezes the tab.**
  Moving the card changes the layout under the pointer, which fires the next
  `dragOver`, which moves it back — an endless loop. `onDragOver` may only move a
  card **into another column** (`from === to` returns early); the position inside
  the column is decided in `onDragEnd`. This cost one hung browser to find.
- Inside one column the drop must be `arrayMove(list, activeIndex, overIndex)`,
  the same swap `verticalListSortingStrategy` already previewed. A rect-based
  "is it below the midpoint" guess disagrees with the preview and silently drops
  the card back where it started.
- Columns change height as cards move between them, so the `DndContext` needs
  `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` — the
  rectangles measured at drag start go stale immediately.
- A card that is both draggable and clickable does not need a drag handle:
  record the pointer position on `pointerdown` and ignore the `click` if it
  travelled more than a few pixels. `isDragging` is already false by the time
  the click fires.
- Convex does not push `*.test.ts`, but it *does* push every other file under
  `convex/`. A shared test-helper module there would break `convex dev` on its
  `vitest` import — duplicate the harness helpers per test file instead.
- `FunctionReturnType<typeof api.x.y>` (`convex/server`) gives the client the
  exact shape a query returns; `src/lib/tasks.ts` uses it so a server change
  lands as a type error on the board instead of an `undefined` at runtime.
- **A Convex mutation that deletes a blob must not throw.** Mutations are
  transactions, so `ctx.storage.delete(id)` followed by `throw` is rolled back and
  the blob survives — the "delete it and throw a Czech error" shape reads right
  and does nothing. Verified against the real deployment, not just `convex-test`.
  `files.register` and `projects.setIcon` therefore return
  `{ ok: false, error }` and let one client helper (`src/lib/upload.ts`) turn it
  back into a thrown error.
- `convex-test`'s `ctx.storage.store()` does **not** record a content type, so a
  server that only trusts `db.system.get(storageId).contentType` cannot be tested
  at all. The rule that came out of it is the better one anyway: the stored type
  wins, the client's claim is the fallback when storage recorded none, and the
  blocklist is applied to **both**.
- Blobs are never shared between **any** app rows. Serving URLs expose storage
  ids, so `convex/lib/storage.ts` checks both `files.by_storage` and
  `projects.by_icon_storage` before `files.register` or `projects.setIcon` may
  claim one. Deletion clears the owning row first and deletes the blob only when
  no file or project still references it; this also protects legacy duplicates.
- BlockNote's suggestion menu keys its group headers by the **group name**, so two
  slash-menu groups sharing a Czech label produce "two children with the same
  key". Mirror `en`'s group structure exactly when translating.
- `@blocknote/shadcn` ships its menus as Tailwind classes inside its JS bundle,
  not as compiled CSS. Tailwind v4 ignores `node_modules` unless told, so the
  editor needs one `@source "…/blocknote-shadcn.js"` in `globals.css` — and in
  exchange it inherits the app's tokens and `.dark` variant with no theming glue.
  **That `@source` is not the stylesheet.** The menus came out styled, which made
  the missing `@import "@blocknote/shadcn/style.css"` look like it was covered;
  it was not, and the editor spent a phase as unstyled ProseMirror. `grep -c
  bn-block-outer` on the built CSS in `.next/static` is the one-second check —
  zero means the stylesheet never shipped.
- A missing stylesheet does not report itself as a missing stylesheet. Here it
  arrived as three unrelated-sounding complaints — a stray blue rule above and
  below the body, two buttons floating outside the panel, and "the slash commands
  don't work" — and the third was the most misleading: the command *ran*, the
  block really became a heading, and a heading with no CSS is a paragraph. When a
  feature is reported dead, check what it renders as before checking whether it
  fires.
- The app-wide `lg:` breakpoint is about the sidebar. A panel inside a drawer has
  its own width (`max-w-2xl` from `sm:`), so its internals key off `sm:` — using
  `lg:` there means a 672 px panel laid out for a phone between `sm` and `lg`.
- **An `overflow-x-auto` strip does not contain its own width unless every flex
  ancestor says `min-w-0`.** A flex item's automatic minimum size is its
  min-content size, and `min-w-max` inside the scroll container is a min-content
  size — so the strip's appetite climbed out through `main` and the whole
  document scrolled sideways instead. It reported itself as "a button is off the
  right edge", not as "the board is too wide". A four-line static HTML
  reproduction driven by `chrome --headless --dump-dom` settled it in a minute,
  which beats guessing at a page that needs a login to render.
- Relative time ("před 5 min") cannot read `Date.now()` during render
  (`react-hooks/purity`) and cannot tick from a `setState` in an effect
  (`react-hooks/set-state-in-effect`). `useNow()` is a module-level store with one
  shared interval and a **cached** snapshot behind `useSyncExternalStore` — a
  `getSnapshot` that returned a fresh `Date.now()` would re-render forever.
- Chips inside a textarea: render the styled text in a backdrop div that sits in
  normal flow and sets the height, then absolutely position the textarea over it
  with `text-transparent caret-foreground`. One element owns the typography, so
  the highlight can never drift out of alignment — and the auto-grow comes free.
- A caret moved after a state update belongs in a `useLayoutEffect` that only
  calls `setSelectionRange`. It touches the DOM, never state, so the React
  Compiler lint stays happy.
- Convex appends `_creationTime` to **every** index, and an index range may
  constrain it: `withIndex("by_context", q => q.eq("context", "comment").lt("_creationTime", cutoff))`
  is an age-bounded, oldest-first scan without a second field on the table. That
  is what makes the reaper index-driven instead of a filtered table scan.
- **`convex-test` hands out `_creationTime` from a monotonic counter that drifts
  ahead of the wall clock** once a test file has inserted a few hundred
  documents. A reaper test that asked for "everything older than 0 ms" therefore
  passed alone and failed as the last test in the file: `Date.now()` was already
  *behind* rows that existed. Measure the age against the newest row, not the
  clock.
- `convex-test`'s `ctx.storage.getUrl` returns a **content-addressed** URL, so
  two uploads of identical bytes share one URL — a fixture that stored the same
  8 zero bytes twice made a document naming the first image look like it named
  the second. Real Convex serves `/api/storage/<storageId>`, which is why the
  reaper matches on the storage id *and* on the URL. Give every test blob
  distinct bytes.
- Radix warns when a `DialogContent` has no description. When the honest answer
  is "there is nothing to say", pass `aria-describedby={undefined}` rather than
  inventing a sentence that repeats the headings below it.
- A Better Auth user has to be deleted on **both** sides: the component's own
  `user`/`session`/`account` rows (through
  `components.betterAuth.adapter.deleteOne` / `deleteMany` — note `findOne`
  takes the query flat, the delete mutations take it under `input`) and the
  mirrored `users` row. The `onDelete` trigger does not fire for a direct
  adapter call.
- An `URL.createObjectURL` preview must not be born in a `useEffect` — the
  effect would `setState`, which this repo's lint forbids. Keep the file and its
  object URL in **one** state value created in the change handler, revoking the
  previous one as it is replaced. No effect, no cleanup ordering to get wrong.
- A validator the client and the server would both have to know (the emoji grid)
  is a drift machine. Validate the *shape* server-side instead — the list can
  then grow without a deploy and without a second source of truth.
- **An unbounded cascade cannot be one mutation.** A transaction has a document
  limit and an organization does not, so `organizations.remove` deletes only what
  has to be atomic — the rows that *grant access*, memberships and invites, which
  are bounded by the team — and hands the rest to a scheduled job that spends a
  fixed budget per run and reschedules itself. Revoking the way in is the
  security boundary; deleting the contents is only cleanup, and cleanup is
  allowed to take a minute.
- A batched deletion job needs no cursor: it deletes what it reads, so every run
  starting from the first remaining row *is* the progress. That is what makes it
  restartable, idempotent and runnable by hand.
- `runAfter(0)` in `convex-test` is a real `setTimeout(0)`, so "what is still in
  the database right after the mutation" is a race and
  `finishInProgressScheduledFunctions()` is a no-op if the timer has not fired
  yet. Drive scheduled work with `vi.useFakeTimers()` plus
  `t.finishAllScheduledFunctions(vi.runAllTimers)` — nothing runs until the test
  asks for it, and a self-rescheduling chain runs to the end.
- **A non-modal Radix dialog must not render its overlay.** `Dialog.Overlay` is
  a `fixed inset-0` element with pointer events; keeping it while `modal={false}`
  produces a panel that looks interactive next to a page that silently is not.
  Hence `showOverlay` on `SheetContent`.
- **Radix listens for Escape on the document**, so anything inside a
  non-modal drawer that answers Escape itself (the mention picker, the inline
  comment editor) — and anything *outside* it that does (the column quick-add)
  — has to `stopPropagation()`, or one key press does two things.
- Autosave changes what "unmount" means. On a page, a debounced write survived
  because navigating away was slow; a drawer closes in 150 ms. Every debounced
  field now flushes from its effect cleanup, which is also why the functions it
  captures have to be stable.
- The open task is put in the address with `window.history.replaceState`, not
  `router.push`. A real navigation would re-fetch the RSC payload just to change
  a query string the server never reads, and the panel would open a beat late.
- **An XML comment may not contain a double hyphen.** A comment in `icon.svg`
  that named `--primary` the way CSS does made the whole file unparseable, and an
  unparseable SVG favicon does not warn — it just is not there. Documenting a
  token by name inside an SVG is not worth the trap.
- `create-next-app`'s `favicon.ico` (25 931 bytes, the Next.js logo) survives
  every amount of app work, because `app/icon.svg` does not replace it: Next
  emits *both* link tags and `/favicon.ico` is what anything that guesses will
  ask for. Check the bytes, not the tag.
- **Satori cannot read `woff2`**, which is the only thing Google Fonts serves to
  a modern user agent. Asking `fonts.googleapis.com/css2` with a 2011 Chrome
  UA string returns a plain `woff` instead, and that it can parse. Same font the
  app already downloads through `next/font`, no new dependency.
- Satori is not a browser: an absolutely positioned circle used as a glow is
  clipped by the layout box and shows its edges, so the glow is a
  `radial-gradient` painted on the canvas itself. And it sets text word by word
  without ever tightening the space between them, so tracked-in display type
  comes out looking pulled apart — worst around short Czech words. Setting the
  words as flex items with an explicit margin is what puts the word space back
  under our control.
- The TypeScript target predates ES2018, so a **named capture group** is a build
  error (`TS1503`) even though every runtime we ship to supports it. Positional
  groups only.
- **What makes an SVG dangerous is the URL, not the format.** In an `<img>` it
  is inert — no script, no external requests — and top-level navigation to a
  `data:` URI has been refused by every browser for years. So an SVG stored as
  *markup on a document* and served as a `data:` URI cannot execute anything
  even if the sanitizer is wrong, while the same bytes in Convex storage are one
  right-click away from a page running script on the storage origin. That is the
  entire difference between `projects.setSvgIcon` and `projects.setIcon`, and
  the reason the blocklist in `lib/files.ts` stays exactly as it is.
- A sanitizer that **refuses** is a different (and much smaller) problem than one
  that **cleans**: cleaning has to predict what a browser will do with what is
  left, refusing only has to be sure about what it accepted. Which is also why
  `convex/lib/svg.ts` is stricter than XML — CDATA, doctypes, unquoted attribute
  values and numeric character references are refused not because each is an
  exploit but because each is a place where its reading and a browser's could
  diverge.
- Strip a comment from the top of a file and the newline that followed it is
  still there. `sanitizeIconSvg` decided documents were not SVG because
  `startsWith("<svg")` ran against `"\n<svg …"` — found by running the app's own
  `src/app/icon.svg` through it, which is the only sample in the repo written by
  a person rather than by the test.
- **A file input's `accept` needs extensions, not only MIME types.** `File.type`
  comes from the operating system, and for `.ico` the three browsers disagree
  (`image/x-icon`, `image/vnd.microsoft.icon`, or nothing at all). A list of
  types alone therefore greys the file out in the picker on the machine that has
  it, and a server that trusts the *stored* content type then refuses whatever
  did get through as "not an image". Both halves have to be handled: `.ico` in
  the `accept`, and a content type decided from the extension when the browser
  offers none.
