# Workeee — CLAUDE.md

Interní týmová aplikace: organizace → projekty → úkoly. This file is the living
contract for the repo; it overrides generic conventions and must be updated in
the same session as any change to a documented fact.

**And so must the changelog.** Any change a person using the app would notice
gets an entry appended to `src/lib/changelog.ts` in the same session, before the
verification gate runs. The two rules are one habit: this file records what is
true, the changelog records what changed. See **The changelog** for what an
entry looks like and for what deliberately gets none.

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
| Type | **Switzer** + **JetBrains Mono**, self-hosted from `src/app/fonts` via `next/font/local` |
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
- Pinned direct dependencies still resolve vulnerable transitive releases.
  `pnpm-workspace.yaml#overrides` keeps those direct dependencies stable while
  forcing `postcss@8.5.25`, `sharp@0.35.3`, `nanoid@3.3.17` and
  `hono@4.12.34`; `pnpm audit --prod` must stay clean.
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
  served from**, otherwise Better Auth answers `403 INVALID_ORIGIN`. It is also
  the origin the links inside a notification e-mail are built from.
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` — transactional e-mail. **Optional:
  without them the app behaves exactly as before and simply sends nothing** (see
  **Upozornění**), which is what keeps the dev deployment and `vitest` quiet by
  default. Nothing Brevo-related belongs on Vercel: the send happens inside a
  Convex action, so the browser never sees these.

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
  notifications.ts       # settings / setTaskEmails / claim / flush
  notificationItems.ts   # the in-app feed: list / unreadCount / markAllRead
  taskSeen.ts            # markSeen / unreadByProject / unreadByOrganization
  crons.ts               # scheduled jobs — one entry per job
  fileReaper.ts          # internal: delete blobs nothing points at any more
  migrations.ts          # internal one-off backfills (`pnpm exec convex run`)
  authz.test.ts          # security tests: visibility, invites, role guards
  organizationPurge.test.ts  # owner guard, name confirmation, the whole cascade
  tasks.test.ts          # security + ordering tests for the board
  taskDetail.test.ts     # security + logic tests for body, files, comments
  fileReaper.test.ts     # both reaper branches, the grace period, the batch cap
  svg.test.ts            # the icon SVG gate: what it accepts, and the attacks
  notifications.test.ts  # who is queued, the window, the checks at send time
  notificationEmail.test.ts  # the subject, the plurals, the HTML escaping
  notificationItems.test.ts  # feed rows: who, collapsing, reading, the switch
  taskSeen.test.ts       # what counts as unseen, and that it dies with the task
  lib/auth.ts            # getAuthUserId / getAuthUser / getUserByAuthId
  lib/access.ts          # the permission matrix — org + project access
  lib/activity.ts        # logActivity (audit trail)
  lib/brevo.ts           # the only network call in the app
  lib/commentBody.ts     # the comment segment codec (shared with the client)
  lib/files.ts           # blob validation, caps, deletion
  lib/invites.ts         # expiry presets, code generation, status
  lib/notificationEmail.ts # buildTaskDigest — subject + HTML + text, pure
  lib/notificationItems.ts # the in-app feed writer + the category/rank rules
  lib/notifications.ts   # the queue, the sliding window, claimDigest
  lib/ordering.ts        # fractional order helpers for board columns
  lib/plural.ts          # Czech 1 / 2–4 / 5+ (shared with the client)
  lib/projectMembers.ts  # who can open a project (assignees + mentions)
  lib/storage.ts         # global one-blob/one-owner invariant + safe deletion
  lib/svg.ts             # the icon SVG allowlist + `data:` URI (never a blob)
  lib/tasks.ts           # getTaskAccess / requireTaskAccess / touchTask /
                         # deleteTaskChildren (body + files + comments +
                         # notifications + read state)
  lib/taskSeen.ts        # read state + what counts as unseen
  lib/taskStatuses.ts    # core status seed + ordered read
  lib/validation.ts      # normalizeName, normalizeTitle
src/
  app/
    layout.tsx           # fonts, pre-hydration theme script, providers, Toaster,
                         # metadataBase + the OpenGraph / Twitter copy
    icon.svg             # the mark — three bars and the card above the last
    favicon.ico          # 16 · 32 · 48, rasterized from icon.svg
    apple-icon.png       # 180, full bleed (iOS rounds it itself)
    fonts/               # Switzer + JetBrains Mono variable, self-hosted, plus
                         # the two static Switzer cuts Satori reads
    opengraph-image.tsx  # the link preview every page inherits
    not-found.tsx        # 404, outside the shell, with its own frame
    (marketing)/         # PUBLIC shell: the app's dark theme, header + footer
    (marketing)/o-aplikaci/page.tsx            # the landing page
    (marketing)/o-aplikaci/opengraph-image.tsx # its own preview, beside the page on purpose
    (marketing)/zmeny/   # the whole changelog, grouped by month
    (auth)/prihlaseni    # sign in       (?invite=<code> carries a pending invite)
    (auth)/registrace    # sign up       (?invite=<code> likewise)
    (dashboard)/         # AuthGuard + OrganizationProvider + AppShell
    (dashboard)/page.tsx # `/` — the first screen after signing in — "Projekty"
    prehled/             # redirect to `/`, keeps interim bookmarks alive
    (dashboard)/projekt/[id]            # project board + task drawer (?ukol=<id>)
    (dashboard)/projekt/[id]/ukol/[taskId]  # redirect, keeps older links alive
    (dashboard)/nastaveni/organizace    # organization settings, managers only
    (dashboard)/nastaveni/upozorneni    # personal notification switch, everybody
    (dashboard)/upozorneni              # the in-app notification feed
    join/[code]/         # PUBLIC invite landing page + its own opengraph-image
    api/auth/[...all]/   # proxy into the Convex deployment
  components/
    ui/                  # shadcn primitives, ours to edit
    brand/               # mark (the glyph, in currentColor, both surfaces)
    auth/                # auth-guard, sign-in-form, sign-up-form
    forms/               # name-form (shared rename control)
    invites/             # invites-panel (org- and project-scoped)
    join/                # join-screen
    layout/              # app-shell, sidebar-content, organization-switcher,
                         # projects-nav, notifications-link, user-menu,
                         # wordmark, page-header, empty-state
    marketing/           # the public page only: site-header, site-footer,
                         # app-link, repo-button, shot, hero, facts, product,
                         # ledger, self-hosting, code-block, open-source,
                         # changelog-section, changelog-entry
    notifications/       # notification-settings-form, notification-feed,
                         # unread-badge
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
  lib/                   # auth-client, auth-redirect, auth-server, auth-errors,
                         # blocknote-cs, changelog, clipboard, comment-draft,
                         # current-organization, format, invites, og,
                         # organization, project-emojis, project-icons, repo,
                         # save-state, shots, task-status-colors, tasks, theme,
                         # upload, user, utils
  proxy.ts               # `/` answers to the session cookie: app, or the
                         # public page rewritten in — see **Routes**
public/marketing/        # the captures of the running app the page is built on,
                         # plus the one generated texture plate
LICENSE                  # MIT. The public page claims it, so it has to be here
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
- **Landing after an auth call is a document navigation, not a `router.push`**
  (`src/lib/auth-redirect.ts`). The session cookie exists the moment the call
  resolves but the Convex token does not, and in that window `useConvexAuth()`
  reports "not authenticated, nothing left to load" — which is exactly what
  `AuthGuard` answers by sending the person to `/prihlaseni`. A client-side push
  lands inside it and bounces a brand new account straight back to the sign-in
  screen, which is the first thing a new person sees. A full load has no window.
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
notificationSettings userId, taskEmails      — a missing row means ON  by_user
notificationEvents   userId, organizationId, projectId, taskId, kind, actorId,
                     commentId?, count?   — the last two on comment rows only
                                                          by_user · by_task
notificationBatches  userId, scheduledId, firstEventAt, flushAt        by_user
notificationItems    userId, organizationId, projectId, taskId, kind, actorId,
                     commentId?, count?, readAt?  — readAt absent = unread
                     by_user_org · by_user_org_read · by_user_task · by_task
taskSeen             userId, taskId, projectId, organizationId, lastSeenAt
                     — a missing row means "never opened"
                     by_user_task · by_user_project · by_task
```

Shared validators live in `convex/schema.ts`: `organizationRoles`,
`memberAccessLevels`, `inviteExpiryPresets`, `taskStatusColors`,
`taskStatusKinds`, `fileContexts`, `activityTypes`, `notificationKinds`.

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

A board with four or more statuses scrolls at any width, so the strip carries
`workeee-scroll-fade`: its right edge softens **only while it has somewhere left
to scroll**, which is what turns a half-visible fourth column from "cut off"
into "there is more". It is driven by `animation-timeline: scroll(self inline)`,
so there is no listener and nothing to clean up, and where that is unsupported
the strip simply has no fade.

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
  over instead of closing it first. Closing is the X, Escape, or **a click
  anywhere outside the panel** — with one exception, the click on a task card:
  it already means "show me this one instead", and dismissing on it would slide
  the panel out and straight back in. `TaskCard` carries `data-task-card` for
  exactly that check, and `onPointerDownOutside` is the only outside handler
  that closes — `onFocusOutside` is prevented, because tabbing to the board is
  not a dismissal. Everything the panel opens for itself (selects, dialogs, the
  lightbox, the editor's menus) is portalled from **inside its React tree**, so
  Radix counts it as inside and it never dismisses.
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
upserted by `taskContent.save`. The shared parser in
`convex/lib/taskContent.ts` checks the default BlockNote block/content shapes,
at most **50 nested block levels**, at most **20 000 structural nodes**, and a
serialized size under **1 MB**. The task drawer uses the same parser and opens
empty for a malformed legacy row, so bad stored JSON cannot crash the editor.

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
  ring around the whole body (recoloured by `* { outline-ring/50 }`, so it reads
  as two stray accent-coloured rules), the placeholder falls onto the line *below* the
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
200 segments, 10 attachments, and 200 comments per task (enforced by
`comments.create`, not only by the list query).

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
claimed. All three mutations bump `tasks.updatedAt`. A mention is **what pulls
somebody into a thread**: `comments.create` queues a notification for everyone
it names and for the task's řešitel, and for nobody else — see **Upozornění**.
`update` and `remove` queue nothing, because a typo fix is not news.

The composer (`src/components/tasks/mention-textarea.tsx`) edits a plain string:
a mention is written as `@Jméno Příjmení` and the draft carries the user id that
name belongs to (`src/lib/comment-draft.ts`). Serializing scans the text for the
names it knows; deleting a character of a name turns it back into plain text,
which is exactly right. The accent-coloured chips are a **backdrop**: a div in normal flow
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

## Upozornění (Phase 11)

One e-mail per person per burst, never one per event. Four things trigger it,
and all four go into a queue rather than out of the mutation that caused them:

| Kind | Who hears about it |
|---|---|
| `task_assigned` | the new řešitel |
| `task_created` | everyone who can open the project |
| `comment_mention` | everyone the comment `@`-names |
| `comment_added` | the task's řešitel |

Since Phase 15 every one of them also lands in **the in-app feed** — same
audience, same collapsing, no switch. See **The second channel** below.

**Comments are deliberately narrower than tasks.** A new task is rare and
concerns the whole project; comments outnumber tasks by an order of magnitude,
and mailing everybody about every reply would make one lively thread shout at
the entire team — and on a 300-a-day free tier, that is also a real ceiling. So
a comment reaches the two people it is actually about, and anyone else is pulled
in with a mention. That is what mentions are *for*, and it is why
`convex/lib/commentBody.ts` has stored them as real user ids from the start.

### Two categories, one row each

`categoryOf(kind)` splits the four kinds into `task` and `comment`, and the
queue holds **at most one row per person per task per category**. The split is
load-bearing: without it a comment written under a freshly created task would
overwrite the notification about the task itself, and the person would never
hear that the task exists.

Inside a category the stronger kind wins — `task_assigned` over `task_created`,
`comment_mention` over `comment_added` — and it keeps its own detail. Ten
replies are one line carrying `count: 10`, and if the first of them mentioned
you, that is still the sentence quoted in the e-mail: being named and then
buried under unrelated chatter should not lose the sentence that named you.

`categoryOf` and `rank` live in `convex/lib/notificationItems.ts` and the
e-mail queue imports them from there — the feed and the queue collapse events
by the same rule, and exactly one module owns it.

### The second channel: the feed and the badges (Phase 15)

The same four events, shown inside the app. Three surfaces, all counted from
the same two tables and clearing from the same action:

- **`/upozorneni`** — the feed. `notificationItems` rows written by the same
  `notify*` calls that enqueue e-mail (`convex/lib/notificationItems.ts`), one
  row per person per task per category, replaced by delete + insert on a new
  event so the merged row's `_creationTime` is the burst's latest moment and
  the list sorts by it with no second timestamp. The rail's "Upozornění" link
  carries `unreadCount`.
- **Task cards** — a lime chip with the number of unread comments, or a small
  dot for a task never opened at all. One indicator per card; the chip wins.
- **Project rows** (rail and dashboard) — how many **tasks** carry something
  unseen, not how many events happened: three replies under one task are one
  task to look at, and the count answers "how many places do I need to open".

The differences from the e-mail queue are the whole design:

- **The feed ignores `notificationSettings`.** The switch turns off e-mail, not
  being told; a feed row costs nobody an inbox. So `pushNotificationItem` is
  called from the `notify*` functions *before* `enqueue` filters by the switch.
- **Nothing is drained.** The queue is claimed at flush; a feed row lives until
  it is read, and `readAt` (absent = unread) is that state. A new event on a
  row already read starts a fresh burst counting from one.
- **Read state is `taskSeen`** — one row per person per task, `lastSeenAt`,
  upserted by `taskSeen.markSeen`, which the comments section of the drawer
  fires when the stream loads and again for every comment arriving while it is
  open (being on the task *is* reading them). `markSeen` also settles the feed
  rows of that task, so opening a task clears every badge it holds anywhere.
  The rest is "Označit vše za přečtené" on the feed page.
- **Everything unread is counted live, never stored.** A comment is unread when
  it is newer than `lastSeenAt` and not the reader's own (an indexed
  `by_task` + `_creationTime` range per task, bounded by the 200-comment cap);
  a task is new when it has no `taskSeen` row and somebody else created it. No
  counter exists to drift, and a missing row honestly means "never opened" —
  including for rows that predate the feature.
- Same discipline as the digest otherwise: nothing denormalized (titles, names
  and the quoted comment are read live by `notificationItems.list`, through the
  shared `commentPreview`), access re-checked per project at read, and both
  tables die with their task in `deleteTaskChildren`.

The user menu's link to `/nastaveni/upozorneni` is labelled **"Nastavení
upozornění"**: the rail's "Upozornění" is the feed, and one word must not name
two doors on one screen.

### Why Brevo, and not the obvious choice

Convex ships an official Resend component, and it would have been the better
code: queueing, retries and idempotency for free. It was rejected for one
concrete reason. **Resend refuses to send anywhere but the account owner's own
address until a domain is verified**, and this app is served from
`workeee.vercel.app` — a `*.vercel.app` host cannot be given DNS records, so
that domain can never be verified. A notification nobody but the owner receives
is not a notification.

Brevo verifies a **single sender address** by e-mailing it a link, so it needs
no domain at all: 300 messages a day, free forever. The price is written down
honestly because it is real: the free plan appends a "Sent with Brevo" line,
and a `From` on a webmail domain fails DMARC alignment (Brevo signs with its
own domain), so a share of it lands in spam. Both disappear by authenticating a
real domain in Brevo and changing `BREVO_SENDER_EMAIL` — one environment
variable, no code. `convex/lib/brevo.ts` is the only module in the app that
touches the network, which is what keeps that swap a one-file job.

### The window

`convex/lib/notifications.ts`. The first event for a person opens a window — one
scheduled flush, recorded in `notificationBatches` — and every further event of
that burst rides along instead of scheduling its own. **The window slides**:
each new task pushes the send to `now + QUIET_MS` (2 min), so the digest goes
out once the person has stopped typing rather than at a fixed time that happens
to cut their burst in half. `MAX_WAIT_MS` (10 min) is the hard cap measured from
`firstEventAt`, and it is what stops somebody who spends the whole morning on
the board from postponing the digest forever.

- **Nothing is denormalized into the queue.** Titles and project names are read
  live at flush, so a task renamed a minute after it was quick-added arrives
  under its real name, and one deleted inside the window drops out instead of
  linking to nothing.
- **Everything is re-checked at flush.** `claimDigest` re-runs
  `getProjectAccess` per project and re-reads `notificationSettings` — between
  the enqueue and the send a member can be removed from the organization or
  turn the switch off, and an e-mail is the one thing in this app that cannot
  be un-shown.
- **Claim first, send second.** The rows are deleted in the transaction *before*
  the mail leaves, so a flush that dies mid-send loses a notification rather
  than delivering it twice. For e-mail that is the right way round, and Brevo
  has no idempotency key to make the other order safe.
- A task created and then assigned inside one window is **one line**, the
  stronger of the two (`task_assigned`), not two.
- Queued events die with their task: `deleteTaskChildren` sweeps them, so both
  `tasks.remove` and the organization purge already handle it.

### The switch

`notificationSettings`, per user and global (not per organization). **A missing
row means on** — which is what makes "on by default" free: no backfill, and an
account created tomorrow is already subscribed. Only turning it off writes
anything. `notifications.settings` and `setTaskEmails` take **no `userId`**: a
preference is not somebody else's to read or write.

### The digest

`buildTaskDigest` (`convex/lib/notificationEmail.ts`) is a **pure function** of
the digest and the origin — no database, no clock, no environment — which is
what lets `convex/notificationEmail.test.ts` cover the wording exhaustively.

| Situation | Subject |
|---|---|
| 1 item | `Nový úkol: Opravit fakturaci` · `Nový komentář: Opravit fakturaci` |
| several, one project | `8 nových úkolů v projektu Web` |
| tasks *and* comments | `1 nový úkol a 5 komentářů v projektu Web` |
| several, several projects | `8 nových úkolů` |

Three pieces of Czech that are easy to get wrong and are pinned by tests:

- Across several projects it deliberately names none of them. "ve 3 projektech"
  versus "v 5 projektech" is a preposition that changes with the *spoken*
  numeral, and a subject line is not worth that trap.
- The adjective appears only on the **first** half of the conjunction:
  "1 nový úkol a 5 komentářů", never "…a 5 nových komentářů".
- Every label under a title is **verbless** — `Přiřazeno vám · Jana Nováková`,
  not "Přiřadil vám Jana Nováková". Czech past tense is gendered, the app has no
  idea of anybody's gender, and a name is not one. A label and a name joined by
  a middot says the same thing and is correct for everybody.

The body is one column of inline styles and no images — mail clients strip
`<style>` blocks and `class` attributes, and a list of links has nothing to gain
from fighting them. A quoted comment sits in a left-ruled block, capped at
`MAX_PREVIEW_LENGTH` (140) and read through `commentBodyText` so a mention
quotes as `@Jméno`. Titles and quotes are escaped on the way in.

### Testing it without sending anything

`sendTransactionalEmail` returns early when `BREVO_API_KEY` /
`BREVO_SENDER_EMAIL` are unset, so an unconfigured deployment — and `vitest` —
queue and flush normally and simply post nothing. That is what lets
`convex/notifications.test.ts` run the real flush action end to end. Timers are
faked throughout: `scheduleFlush` uses `scheduler.runAt`, so with a real clock
"did the second task schedule a second e-mail?" is a race, and `vi.setSystemTime`
moves `Date.now()` forward **without** firing anything, which is exactly what a
test of the window needs.

To skip the two-minute wait by hand:

```bash
pnpm exec convex run notifications:flush '{"userId": "..."}'
```

## Routes

| Route | Access | What it is |
|---|---|---|
| `/` | **both** | With a session cookie: the dashboard — "Projekty", every visible project of the current organization as a card; creating one lives in the rail, not here; with no membership it renders the onboarding screen. Without one, `src/proxy.ts` **rewrites** (never redirects) to `/o-aplikaci`, so the bare domain is the app for its users and the pitch for everybody else — including crawlers and unfurls, which carry no cookie. The check is the cookie's presence, not its validity: choosing a page is not authorization, and a stale cookie just lands on `AuthGuard` |
| `/o-aplikaci` | **public** | The landing page: what it is, what it does, how to host it yourself, the licence, the latest changes, over captures of the real application. Static, no auth, no Convex. A signed-in visitor gets a quiet "Přehled" link in the header, never a redirect |
| `/zmeny` | **public** | The whole changelog, grouped by month |
| `/prehled` | — | Redirect to `/` — the dashboard lived here briefly while the landing page held the base URL |
| `/projekt/[id]` | project members | Project header + settings dialog for managers + the Kanban board. `?ukol=<taskId>` opens that task in the drawer on the right: title, status, assignee, meta, block-editor description, Přílohy, Komentáře |
| `/projekt/[id]/ukol/[taskId]` | project members | Redirect to `/projekt/[id]?ukol=<taskId>` — the detail is a drawer now |
| `/nastaveni/organizace` | org managers | Rename, members table, organization invites; the owner also gets the delete card |
| `/nastaveni/upozorneni` | authenticated | One switch: e-mail digests of new tasks. Personal, so no manager guard — reached from the user menu ("Nastavení upozornění") |
| `/upozorneni` | authenticated | The in-app notification feed: new tasks, assignments, mentions and comments, unread first by nature. Reached from the rail's "Upozornění" link, which carries the unread count; a row links into the task's drawer, and opening it is what marks it read |
| `/join/[code]` | **public** | Invite summary; unauthenticated visitors go to `/registrace?invite=<code>` or `/prihlaseni?invite=<code>` and come back here to accept |
| `/prihlaseni`, `/registrace` | public | Auth; `?invite=<code>` redirects back to the join page afterwards |

## The public page (Phase 14)

`/o-aplikaci` is the landing page and it is public, static and server-rendered:
a crawler and a chat unfurl have to find the real copy in the HTML. It is also
what the bare domain shows to anybody **without** a session — `src/proxy.ts`
rewrites `/` here when no Better Auth cookie rides on the request — so the app
keeps the base URL for its users while the pitch still greets everybody else on
the same address; the page's `canonical` names `/o-aplikaci` so the two never
compete in search. And **a signed-in visitor on `/o-aplikaci` is not
redirected** — they are usually the person who deployed it, and bouncing them
would make the page unreachable for exactly the people who need to show it to
somebody. The header's one client component (`marketing/app-link.tsx`) is the
door either way: "Přehled" for a validated session, "Přihlásit se" for a
visitor, and nothing while Convex is still deciding which.

- **It is the app's dark theme, not a second palette.** The marketing layout
  puts the app's own `dark` class on its root, so `bg-background`,
  `border-border` and `text-primary` on this page are the same tokens the board
  paints with. That is what lets a screenshot of the product sit on the page
  with nothing around it and still read as part of the layout. A visitor whose
  app theme is light still sees this page dark, because the class is on the
  layout and not on `<html>`; `html:has(.workeee-marketing)` paints the document
  itself, because a nested layout cannot touch `<html>` and without it an
  overscroll bounce shows the app's background through.
- It has **one job and one button**: "Otevřít na GitHubu", which appears exactly
  twice, in the hero and at the end of the open-source section. The header
  carries none, because a third copy following the reader down the page would
  make it three. The secondary action is one anchor, "Jak si to nasadit".
- Sections, and no two share a layout family: hero interleave → **Co Workeee je**
  (a hairline fact grid whose last two cells are screenshots) → **Úkol nikdy
  neopustí nástěnku** (one large capture with a smaller one laid over its corner)
  → the scattered **ledger** → **Hostujte si to sami** (steps on a vertical rail)
  → **Open source** (a bare statement) → **Změny** (a date rail) → the footer
  bookend.
- **Zero eyebrows.** Not one small uppercase label above a heading anywhere on
  the page. The heading is the label, and the section's place on the page is the
  category.
- **Monospace has exactly one job here**: commands, environment-variable names,
  file paths, the repository address and changelog dates. Nothing else on either
  surface is set in it.

### The interleave

The hero is the one loud composition, and it is a real z-sandwich rather than
one pre-composed picture:

```
z-40  a single task card, in front of everything
z-30  the letters "EE", and the copy column
z-20  the board, crossing the lower third of the letterforms
z-10  the letters "WORKE"
```

The word is split into two adjacent spans with no space between them, which is
the whole trick: `EE` at z-30 comes back out **in front** of the screenshot, so
the board passes *through* the word instead of sitting on it. It is still one
word to a screen reader and to anything that copies the text.

- **Everything in the section is sized in `cqi`**, and the wrapper is a container
  for that reason alone: the word (`22cqi`), the overlap (`-mt-[6cqi]`) and the
  card's `top`. One `cqi` is one percent of the content column, which is the
  thing the composition actually has to fill — a `vw` is not, and a
  `clamp(…, 17.4vw, 15rem)` is wrong twice: it measured against the viewport
  below the cap, and above the cap (from ~1400 px, so most desktops) it stopped
  growing while the column did not, leaving the word a fist short of the right
  edge.
- **Legibility floor:** the board's top edge leaves about two thirds of every
  letterform showing. That number is the composition — at four fifths the board
  grazed the baseline and read as a picture parked under a headline, which is
  the failure this section exists to avoid. Nothing here is fixed with a text
  shadow or a glow.
- **The board is cropped to 2.16:1** rather than shown at the file's own 1.69:1.
  The capture is a whole 1440 × 900 viewport and its bottom quarter is empty
  board, so at its own aspect a fifth of the section's height was spent on
  nothing, which is what made the hero read as thin.
- **The card in flight is centred on the board's top-left corner**, which is the
  mark's fourth shape at page scale. Out on its own over the `W`, as it first
  was, it read as a stray tooltip, and it crossed the letterforms at their waist
  — the one height that costs legibility. Here it pokes barely above the line
  the board already occludes.
- **Below `md` the sandwich is dropped entirely** and the section becomes a plain
  stack: word, sentence, buttons, board. The card fragment is `hidden md:block`.
  On a phone there is no room for a composition and floating fragments read as a
  bug — and the board becomes `SHOTS.boardMobile`, because the desktop capture at
  342 px is a seventh of the scale it was taken at and four columns of
  unreadable grey are a worse advert than no picture. Both captures are
  `priority`, and each declares a `1px` display width on the side of `md` it is
  hidden on, so neither is preloaded where it is never painted.

### The imagery

Every picture of the product on this page is **a capture of the running app**,
listed in `src/lib/shots.ts` with its real pixel dimensions so no component ever
guesses an aspect ratio and re-shooting means editing one file. Desktop shots
are taken at 1440 × 900 with a 2× pixel ratio, the phone one at 390 wide, all in
the dark theme, cropped tight with no browser chrome and no invented address
bar. `Shot` frames them the way the app frames its own panels: one hairline, a
12 px corner, no drop shadow pretending the picture floats above the page it was
taken from. The hero board is the one exception and it is not a contradiction:
there the picture really is a layer with type behind it and a card in front of
it, so the shadow states a relationship that exists rather than inventing one.

The only non-product image is `public/marketing/texture.jpg`: one generated
plate of cold raking light and dust over graphite, used once, behind the hero,
at 22% and `mix-blend-screen`. It is there so the near-black reads as a surface
rather than an absence. One photographic world, one texture world, nothing else.

Under the hero it is one of **four plates of light**, and they are the only depth
in that section that is not a real layer: the texture, one cold sheen behind the
word, one lime bloom sitting exactly where the board cuts into the letterforms,
and a floor that darkens the section's bottom edge so the composition stands on
something. All four are `pointer-events-none`, none of them animates, and each
is kept low enough (7–14%) to read as a lit surface rather than as a gradient.

### The motion

`MOTION_INTENSITY` is high and there is no animation library on this page. All
of it is CSS, which is what keeps the whole page a server component: nothing
listens to scroll, nothing measures, and the interpolation happens on the
compositor.

- **Load-in** is a timed sequence (`data-rise` / `data-settle` / `data-sweep`):
  the word rises, the board settles up into it, the copy follows, then the card
  in flight, and the accent rule above the copy draws itself in last.
- **Scroll reveals** use `animation-timeline: view()` (`data-enter`,
  `data-enter-stagger`). The stagger is a shift of `animation-range`, not a
  delay, so it stays tied to the scrollbar rather than to a clock.
- **One parallax**, and it is the one place the composition earns it: the board
  drifts against the word (`data-drift`, `animation-timeline: scroll()`).
- Every rule is wrapped in **both** `@supports (animation-timeline: …)` and
  `prefers-reduced-motion: no-preference`, and the `@supports` is load-bearing:
  an `animation` with `both` and no timeline support falls back to the
  *document* timeline, which would fire every reveal on the page at once during
  load. That failure is exactly what makes people reach for JavaScript here.
  Where the timeline is unsupported the page is simply static, which is a
  correct page.

### The changelog

`src/lib/changelog.ts` — one typed array, newest first, and the order of the
array is the order on screen. It is **static content, not Convex**: it ships
with the code, git versions it next to the change it describes, and a marketing
page should not open a websocket to render a list of dates. No MDX, no
frontmatter parser, no new dependency. If an entry ever needs rich text, that is
the moment to reconsider, not now.

```ts
{ date: "2026-08-10", title: "Upozornění na komentáře", tags: ["Upozornění"],
  items: ["Komentář dá vědět těm, koho zmiňuje, a řešiteli úkolu. …"] }
```

Two renderers, one array: `ChangelogSection` takes the first
`CHANGELOG_PREVIEW_COUNT` for the landing page, `/zmeny` takes all of them
through `groupChangelogByMonth`. Dates go through `formatIsoDate` /
`formatIsoMonth` (`src/lib/format.ts`, pinned to UTC — a changelog date is a
calendar day, not a moment, and `new Date("2026-08-10")` read west of Greenwich
would print the ninth). Counts go through `plural`.

**The rule, and it is part of the contract:** any change a person using the app
would notice gets an entry appended in the same session as the change, before
the verification gate runs. Entries are written for that person, so they say
what is now different for them, never which file moved. An internal refactor
with no user-visible effect deliberately gets nothing — a changelog that logs
everything is a git log with worse formatting.

## Design system

**One system, two surfaces.** The public page and the application are painted
from the same tokens; there is no marketing palette. See **The public page**.

- Tokens are **HSL channel triples** on `:root` / `.dark` in
  `src/app/globals.css`, exposed via `@theme inline` as `hsl(var(--token))`.
- **The neutrals are cold graphite.** Every gray carries a little blue (hue
  210-220), so the near-black reads as machined metal rather than as warm paper
  turned down. Nothing is pure black or pure white at either end: the dark
  background is `220 14% 5%`, the light one `210 22% 98%`.
- **One accent: signal lime**, `74 86% 62%` in the dark theme and `76 88% 25%`
  in the light one, on `--primary` and `--ring`. Two things about it are
  deliberate:
  - **The hue is one the status palette does not own.** Gray, blue, indigo,
    violet, amber, orange, red, green and teal are all task statuses, so a brand
    button painted in any of them would read as a status chip. Lime belongs to
    the product and never to a column.
  - **It inverts with the theme** instead of keeping one lightness: a bright
    chip on graphite, a deep one on paper. That is what keeps a filled button
    both legible and clearly bounded in both modes, which a single mid-lime
    cannot be. Measured: dark fg 17.9:1 · muted 7.3:1 · ink-on-accent 13.4:1;
    light fg 17.1:1 · muted 5.8:1 · ink-on-accent 5.1:1.
  - `--accent` is still a neutral hover surface. Never repaint it with the brand
    color.
- **Geometry.** `--radius: 0.375rem` (6 px) and the ramp is written out rather
  than derived from it: `sm 4 · md 5 · lg 6 · xl 8 · 2xl 12 · 3xl 16`. Controls
  are 6, cards 8, dialogs and sheets 12. **Badges are tags at 5, not pills** —
  the only fully round things in this system are the ones round for a reason,
  which is a face and a switch. Never nest a card inside a card.
- **Control heights: 28 / 32 / 36 / 40** (`xs / sm / default / lg`), one step up
  from the shadcn default, which is what lets a 15 px label sit in a control
  without touching its edges. Icons `size-4`.
- **Elevation is for things that float and for nothing else.** A card is a
  hairline `border-border` on `bg-card` with no shadow; only popovers, dropdowns,
  dialogs and the drawer carry one, and it is tinted to the background hue
  (`hsl(220 40% 2% / …)`), never neutral black.
- **Two typefaces, both self-hosted from `src/app/fonts`, both variable, both a
  single file**, both wired in `layout.tsx` with `next/font/local`. Nothing is
  fetched from a font CDN at runtime or at build.
  - **Switzer** (`--font-sans`, also `--font-heading`, `wght 100-900`) carries
    everything a person reads. The 14 px label in the rail and the display word
    on the public page are the same face at two ends of one axis, which is the
    whole argument for a variable grotesque; it is a cold Swiss neutral that
    holds at 800 on a poster without turning into the rounded-grotesk look. Its
    385 glyphs cover Czech in full.
  - **JetBrains Mono** (`--font-mono`, `wght 100-800`, subset to Latin and
    Latin Extended) is for things a machine reads back, and for nothing else.
  - `Switzer-400.woff` and `Switzer-800.woff` sit in the same folder and are
    **not** used by the app: they exist only for Satori. See **The link
    previews**.
- **The type ramp inside the app is deliberately two sizes and a gap.** Exactly
  one 28 px line per screen (the page title, through
  `layout/page-header.tsx`, which exists so four screens cannot disagree about
  it), and everything else is 15 px or smaller. That contrast is the hierarchy;
  nothing in between competes. On the public page the same idea is stretched
  further: one display word at up to 16 vw and then nothing above 3 rem.
- Dark mode is **class-based and hand-rolled**: `@custom-variant dark (&:is(.dark *, .dark))`,
  a pre-hydration inline script in `layout.tsx` reading
  `localStorage["workeee-theme"]`, and `useTheme()` (`src/hooks/use-theme.ts`)
  which observes the `dark` class on `<html>` via `useSyncExternalStore`.
  **No `next-themes`.** The variant matches `.dark` itself and not only its
  descendants, which is what lets the marketing layout carry the class on its
  own root.
- Breakpoint contract: `lg:` (1024 px) splits the desktop sidebar from the
  mobile drawer. One custom breakpoint exists, **`board:` (1408 px)**, declared
  in `globals.css` — it is not about the shell but about the board; see
  **How wide the board has to be**.
- The shell's content column is **`max-w-6xl`**, so the widest the board strip
  can ever be is 1088 px. `main` also carries **`min-w-0`** — see
  **How wide the board has to be**, it is the difference between the board
  scrolling and the page scrolling.
- A project with no icon gets a **monochrome** chip with its first letter, not a
  deterministic color. A color per project would put a sixth and seventh hue on
  a screen that already spends its color on statuses and its accent on the
  brand, and it would say something about the project nobody chose. A project
  that wants an identity gets one three ways, all explicit.
- "Nothing here (yet)" and "this address leads nowhere" share one component,
  `src/components/layout/empty-state.tsx` — a dashed panel with a heading, one
  sentence and the action or link that unblocks the person. The dashboard, a
  missing project or task, the organization settings guards and the 404 page all
  use it, so all five read the same. It is also **the only dashed edge in the
  product**, so a dashed edge always means "a place something goes".

## The mark, the icons and the link previews

### The mark

`src/app/icon.svg` is the only drawing of the brand, and it is the board reduced
to four shapes: **three bars descending left to right** — the three statuses
every project is seeded with, drawn as how full each column is — and a fourth
shape detached above the shortest one, which is the card in flight. That fourth
shape is the whole mark. Without it this is a bar chart; with it, it is a board,
and it is the one thing this product actually does.

Geometry on a 64 grid: bars 12 wide, gaps 6, baseline at 54, corner 3 on all
four shapes so nothing inside the glyph is rounder than anything else. Graphite
tile `#0B0C0F` at radius `15/64` ≈ the platform squircle, glyph `#CBF14B` —
which are the dark theme's `--background` and `--primary` spelled out.

**The tile exists only so a favicon has a field to sit on.** Inside the product
the mark is the bare glyph in `currentColor`
(`src/components/brand/mark.tsx`), used by the rail, the auth and invite
screens, the 404 and the public page's header and footer, so it takes the color
of whatever it sits beside. **A third copy lives inside `src/lib/og.tsx`** as a
data URI, because Satori is not the DOM. All three carry the same four
rectangles and change together.

The two raster files beside it are **rasterized from that SVG** and have no
other source. Chrome is the rasterizer, because it is the renderer the icon has
to survive anyway, and the ICO container is assembled with Pillow:

```bash
# 16 / 32 / 48 for the .ico, 180 (with the rounded corners removed) for iOS
chrome --headless --default-background-color=00000000 \
       --screenshot=out.png --window-size=N,N --force-device-scale-factor=1 wrapper.html
python3 -c "from PIL import Image; Image.open('f48.png').save('favicon.ico', sizes=[(48,48),(32,32),(16,16)])"
```

- `favicon.ico` — 16 · 32 · 48 PNGs in an ICO container. It exists because
  crawlers, chat clients and feed readers still ask for `/favicon.ico` by hand.
- `apple-icon.png` — 180 × 180, **full bleed, no rounded corners**: iOS applies
  its own mask, and our corners under its mask would show as pale notches.

### The link previews

`src/lib/og.tsx` draws every unfurl: 1200 × 630 of the dark theme's colors
spelled out (Satori never sees `globals.css`), the mark and the wordmark at the
top, an optional tag on the right, and at the bottom one short accent rule — the
same rule the rail draws beside the project you have open — over one big line of
Switzer Extrabold and an optional muted line under it. Three callers, and none
of them adds a design:

| File | What it says |
|---|---|
| `src/app/opengraph-image.tsx` | "Interní aplikace pro týmy, projekty a úkoly." — inherited by every route without a closer one |
| `src/app/(marketing)/o-aplikaci/opengraph-image.tsx` | "Projekty a úkoly pro tým, které si hostujete sami." + one muted line — the landing page only; `/zmeny` inherits the root one |
| `src/app/join/[code]/opengraph-image.tsx` | chip "Pozvánka" + "Připojte se k organizaci" |

The landing page's copy sits in its own file rather than in the root one because
of the inheritance rule below: a page that declares its own `openGraph` keeps
only the image **co-located with it**.

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
  `opengraph-image.tsx` **beside it** supply the picture. Beside it is the load
  bearing part: declaring `openGraph` also drops the image an *ancestor* segment
  would have contributed, so a page with its own block needs its own file in the
  same folder or it ships with no `og:image` at all.
- **The type is read off disk, not fetched.** Satori parses TTF, OTF and WOFF
  and chokes on WOFF2, and it renders a variable font at its default instance
  only — which is why `Switzer-400.woff` and `Switzer-800.woff` sit beside the
  variable file the app uses and exist for this and nothing else. Reading them
  locally also makes an unfurl independent of a font CDN being up at the moment
  somebody pastes a link. If the read fails the fonts are dropped and
  `ImageResponse` falls back to its bundled face: a preview in the wrong
  typeface still beats no preview.
- **`next.config.ts#outputFileTracingIncludes` traces those two files** into the
  serverless bundle. The invite preview is rendered on demand rather than at
  build, so without the entry it would silently ship in the fallback face.
- The mark is spelled out a second time inside `og.tsx` as a data URI, because
  Satori is not the DOM and cannot import `icon.svg`. **The two carry the same
  four rectangles and change together.**

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
    úkol · stav · člen · řešitel · příloha · komentář · upozornění**. A create action is
    "Nová organizace" / "Nový projekt" in the menu that opens it *and* in the
    dialog title, and the dialog's submit button is the bare verb ("Vytvořit").
  - A toggle's label names what the click will do, not what is on now
    ("Světlý režim" while the app is dark).
- All code identifiers, comments and table names are **English**. Routes follow
  the business vocabulary and are therefore Czech (`/prihlaseni`, `/registrace`).
- Auth error copy lives in one place: `src/lib/auth-errors.ts`.
- Czech plurals need 1 / 2–4 / 5+ forms — `plural(count, one, few, many)` in
  **`convex/lib/plural.ts`** is the one helper; never write `${n} položek`. It
  sits on the Convex side because the server builds e-mail subjects too, and
  `src/lib/format.ts` imports it from there — the same direction
  `convex/lib/commentBody.ts` is shared in.
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
4. **Accent:** signal lime, one hue no task status owns. **Typefaces:** Switzer
   for everything a person reads, JetBrains Mono for what a machine reads back.
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
- **Phase 11 (done).** Upozornění: a task assigned to you, or added to a project
  you can open, now reaches you by e-mail — **batched**, so eight tasks typed in
  one sitting arrive as one message with the count in its subject. A sliding
  2-minute window with a 10-minute cap, everything re-checked at send time, one
  personal switch that is on by default, and Brevo instead of Resend because a
  `*.vercel.app` host has no DNS to verify a domain with. No new dependency:
  the whole integration is one `fetch`.
- **Phase 12 (done).** Comments joined the same digest, on a much narrower
  audience than tasks: whoever a comment `@`-names, plus the task's řešitel.
  The queue grew a second category so a reply can no longer overwrite the task
  it was written under, ten replies collapse into one line with a count, the
  comment itself is quoted, and every label in the e-mail was rewritten
  verbless because Czech past tense is gendered and the app does not know
  anybody's gender.
- **Phase 13 (done).** The product has a front door. `/o-aplikaci` is a public,
  static landing page (it briefly claimed `/` and pushed the app to `/prehled`,
  which broke every existing user's habit of typing the base URL — the app took
  `/` back before the change shipped, and `/prehled` survives as a redirect),
  with the Kanban board and the task drawer rebuilt as a real component preview
  rather than a screenshot, the whole self-hosting sequence with its real
  commands and variable names, and the MIT licence the page now truthfully
  claims. A signed-in visitor on it gets a link, not a redirect.
  `src/lib/changelog.ts` became the one place a user-visible change is written
  down, rendered both on the landing page and on `/zmeny`, and keeping it
  current is now part of this file's contract.
- **Phase 14 (done).** One identity, both surfaces. Everything visual was
  redrawn from zero: cold graphite neutrals with a signal-lime accent that no
  task status owns, a 6 px control radius with the ramp written out, control
  heights one step taller, self-hosted Switzer and JetBrains Mono replacing
  Geist, and a new mark — three descending bars and the card in flight above the
  last one — carried into `icon.svg`, the favicon, the iOS icon, the app itself
  and the link previews, which now read their type off disk instead of fetching
  it. The public page was rebuilt on the app's own dark theme rather than on a
  palette of its own, around an oversized `WORKEEE` that real screenshots of the
  product pass through, with the whole scroll choreography done in CSS so the
  page stayed a server component. Two defects fell out of photographing the app:
  signing up bounced back to the sign-in screen, and a four-column board was cut
  off with nothing saying so.
- **Phase 15 (done).** What is new, visible without opening anything: a task
  card carries the number of unread comments (or a dot when the task was never
  opened), a project's row in the rail and its card on the dashboard say how
  many tasks need a look, and the rail gained "Upozornění" — an in-app feed of
  the same four events the e-mail digest sends, with its unread count on the
  link. Read state is one `taskSeen` row per person per task, written when the
  drawer is open; everything unread is counted live against it, never stored.
  Opening a task clears every badge it holds anywhere at once.
- **Phase 16 (done).** The hero, which was the right idea executed timidly: the
  word only ever filled the column at one viewport width, the board grazed it
  instead of crossing it, a quarter of that board was empty pixels, the card in
  flight sat out on its own like a stray tooltip, and on a phone the whole thing
  was four columns of unreadable grey. It is one container and one unit now
  (`cqi`), the board cuts a third of the way into the letterforms and is cropped
  to where it stops having content, the card straddles its top-left corner, the
  copy column is narrower than the hole it used to leave and says the two things
  the page's first screen was not saying, and a phone gets the app's own phone
  layout. See **The interleave**.
- **Later.** List view, due dates, filters in the URL, activity timeline,
  audit log surface.

## Continual learning

- **Next 16 renamed middleware: the file is `src/proxy.ts` with a default
  export**, and it is the right place for exactly one kind of decision — which
  page answers a URL — never for authorization, which stays in Convex. The
  session check there is `getSessionCookie` from `better-auth/cookies`:
  optimistic (presence, not validity), zero round trips, and the failure mode
  of a stale cookie is the app shell politely asking the person to sign in.
- **Next 16 dev caches optimized images under `.next/dev/cache/images`**, not
  `.next/cache/images`, and it does not revalidate against the source file's
  mtime. Replace a picture in `public/` and the page keeps serving the old one
  through `next/image` — including its old intrinsic size, so the layout does
  not change either and it looks like the new file never landed. Deleting
  `.next/cache` does nothing. Delete `.next/dev/cache/images` and restart. An
  hour went into this one; the tell is that `curl`ing the raw `/public` path
  returns the new bytes while `/_next/image?...` answers `X-Nextjs-Cache: HIT`.

- **A second palette is a second design system, however carefully it is named.**
  The public page used to carry its own `--mk-*` tokens so it could be near-black
  while the app was themable. It worked, and it also meant every screenshot of
  the product landed on the page as a rectangle of slightly different greys. The
  fix was to delete the palette and put the app's own `dark` class on the
  marketing layout: same tokens, same greys, and a capture now dissolves into the
  page. The rule that came out of it: if two surfaces are one product, they get
  one set of tokens, and "the page needs to be dark when the app is light" is a
  question about where the class goes, not about how many palettes there are.
- **Pick the brand accent from a hue the product's data does not already use.**
  The old indigo was also a task-status color, so a primary button and a status
  chip were the same object at a glance. The status palette owns gray, blue,
  indigo, violet, amber, orange, red, green and teal; the brand took lime, which
  is the largest gap left in the wheel. This is a functional constraint, not a
  taste one.
- **An accent that works on near-black usually does not work on near-white, and
  the answer is to let it invert with the theme.** A bright lime button on a
  white page has a 1.2:1 boundary against its background — legible label,
  invisible button. Holding the hue and moving the lightness (62% dark, 25%
  light) keeps one accent while both modes get a real edge.
- **Satori renders a variable font at its default instance.** Handing it the
  same `wght 100-900` file the app uses gets you a display headline at weight
  400 with no error and no warning. It also cannot read WOFF2, which is the only
  thing a font CDN will serve a modern user agent. Two static WOFF cuts on disk
  solve both, and reading them locally removes a network call from a code path
  that runs when somebody pastes a link into a chat.
- **`fs.readFile` returns a Buffer that is a view into a shared pool**, so
  `buffer.buffer` is not the file — it is up to 8 kB of whatever else Node
  happened to read. Font parsers accept the Buffer directly; reaching for
  `.buffer` to "get an ArrayBuffer" silently hands over the wrong bytes.
- **A scroll-driven animation with `both` and no timeline support falls back to
  the document timeline.** Every reveal on the page then fires at once during
  load, which looks exactly like a broken library and is why people conclude
  scroll-driven CSS "is not ready". `@supports (animation-timeline: view())`
  around the whole block is not optional, and with it the unsupported case
  degrades to a static page, which is a correct page.
- **A `vw` is not the column, and a `clamp()` cap is where display type quietly
  gives up.** The hero word was `clamp(3rem, 17.4vw, 15rem)` inside a
  `max-w-[84rem]` column: below the cap it tracked the viewport while the thing
  it had to fill was the column, and above it — from about 1400 px, which is
  most desktops — it stopped growing while the column did not. The symptom is
  not "the type is small", it is that the composition looks laid out for a
  narrower screen and nobody can say why. `container-type: inline-size` and one
  `cqi` fix it exactly, and the overlap and the floating fragment given in the
  same unit then hold their proportions to the type instead of to the window.
- **An overlap that respects legibility too much stops being an overlap.** The
  board crossed the bottom fifth of the letterforms, which is far enough to be
  deliberate and not far enough to be seen: the eye read a picture under a
  headline, which is the one thing the composition existed not to be. A third is
  where it starts reading as one image. The z-sandwich was never the weak part —
  the number was.
- **A screenshot of your own app has padding in it, and it is your padding.** The
  hero capture is a whole 1440 × 900 viewport whose bottom quarter is empty
  board, so at the file's own aspect ratio a fifth of the section's height went
  to nothing and the section read as thin. `object-cover` with a stated aspect
  is the fix, and the cut reads as "the board carries on past the fold" —
  which is true.
- **A desktop capture shrunk to a phone is not a picture of your product.** At
  342 px the four-column board is a seventh of the scale it was taken at:
  legible as a shape, unreadable as an interface, and a worse advert than no
  image. Two `Shot`s and mutually exclusive `sizes` — each declaring a `1px`
  display width on the side of the breakpoint it is hidden on — let both be
  `priority` without either being preloaded where it is never painted.
- **The interleave needs the word split, not clipped.** A second copy of the
  headline clipped by a percentage works until the type wraps or the font
  changes. Splitting `WORKEEE` into two adjacent spans and giving the second one
  a higher `z-index` is exact at every width, needs no measurement, and is still
  one word to a screen reader and to anything that copies the text.
- **Photographing your own app finds bugs that using it does not.** Two of them
  came out of setting up the shots and neither was a visual one: signing up
  landed on `/prihlaseni` because `router.push` raced the Convex token, and a
  four-status board was cut off at 1440 px with nothing indicating the strip
  scrolled. Both had been there for weeks.
- **After an auth call, navigate the document.** The cookie is set and the Convex
  token is not, and a client-side push lands in that window, where `AuthGuard`
  correctly concludes nobody is signed in. Anything that gates on a *derived*
  auth state needs a full load, or a gate that can tell "not yet" from "no".
- **A fade on a scroller has to know whether there is anything left to scroll.**
  A permanent mask on the right edge says "there is more" on a board that fits,
  which is worse than no affordance. `animation-timeline: scroll(self inline)`
  ties the mask to the scroll position with no listener and no measurement.
- **An emoji picker with a fixed grid will not have the emoji you asked for.**
  Seeding the app for photography asked for a leaf and an antenna and got a
  seedling and a phone, because the grid is 48 items chosen by hand. That is the
  right trade (see the note about validating shape rather than duplicating a
  list), but anything scripted against the picker has to accept a substitute.

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
- **A transactional e-mail provider's free tier is not the number on the pricing
  page.** Resend advertises 3 000 messages a month, and every one of them goes
  to the account owner until a domain is verified — which a `*.vercel.app`
  deployment can never do, because there is no DNS to put the records in. The
  question to ask a provider first is not "how many" but "**to whom, today,
  with what I actually own**". Brevo verifies a single address by e-mailing it a
  link, which is the only shape that fits a project with no domain.
- **A notification queue keyed by one entity needs a category, or the loud event
  eats the quiet one.** Rows were "one per person per task", which was right
  until comments arrived: a reply written under a freshly created task
  overwrote the notification about the task existing, and the person learned
  about the discussion but never about the work. `categoryOf(kind)` splits the
  key; a stronger kind still wins, but only inside its own half.
- **Czech past tense is gendered, and an app almost never knows the gender.**
  "Přidal Jana Nováková" is wrong for half of any team, and a name is not a
  gender — guessing from it is worse than not saying it. A verbless label and
  the name joined by a middot (`Nový úkol · Jana Nováková`) carries the same
  information and is right for everybody.
- **Comment volume is not task volume.** Copying the "everyone who can see the
  project" rule from tasks onto comments would have turned one lively thread
  into a mailing list for the whole team — and on a 300-a-day free tier, into a
  quota problem. Mentions already existed as real user ids; letting them decide
  the audience was both the cheaper and the more respectful answer.
- **A batching window has to slide, and it has to have a cap.** A fixed window
  from the first event is one line simpler and splits a burst in half whenever
  the burst starts near the end of it. A purely sliding one never fires for
  somebody who keeps working. Both constants — the quiet period and the hard cap
  measured from the first event — are the feature; either alone is a bug.
- **Claim before you send, not after.** A queue drained inside the transaction
  loses a message when the sender dies; drained after, it sends the message
  twice when the sender dies *after* delivering. For e-mail the first failure is
  the acceptable one, and no provider on a free tier gives you an idempotency
  key to make the other order safe.
- Anything queued for later has to **re-authorize when it runs**, not when it is
  queued. Between the enqueue and the flush a person can be removed from the
  organization or turn the notification off — `claimDigest` therefore re-runs
  `getProjectAccess` and re-reads the switch, and an e-mail is precisely the
  thing that cannot be taken back once it is wrong.
- **An unconfigured integration should be silent, not broken.** `sendTransactionalEmail`
  returning early with no API key is what makes the dev deployment safe, makes
  `vitest` able to run the real scheduled action end to end, and makes shipping
  the feature before the credentials exist a non-event.
- `vi.useFakeTimers()` plus **`vi.setSystemTime`** is the pair a scheduling test
  needs: `advanceTimersByTime` fires the timers, which is the opposite of what
  "did the second task reuse the first task's window?" is asking. Move the clock,
  assert on the row, never let the job run.
- **pnpm 10.33 stopped reading the `pnpm` field in `package.json`.** The
  `overrides` that pin the patched PostCSS and Sharp were silently ignored and
  survived only because the lockfile still recorded the old resolution — inertia,
  not a guarantee. They live in `pnpm-workspace.yaml` now. The tell was a `[WARN]`
  on every single pnpm command, which is exactly the kind of line that stops
  being read after the tenth time.
- **Headless Chrome on macOS clamps the window to a 500 px minimum**, and
  `--screenshot` then crops that render to whatever `--window-size` asked for.
  A 390 px shot of a page laid out at 500 px looks exactly like horizontal
  overflow: text sliced off at the right edge, on every section at once. Two
  minutes went into hunting a layout bug the page never had. `--dump-dom` on a
  four-line file that prints `innerWidth` settles it, and a real narrow viewport
  needs `Emulation.setDeviceMetricsOverride` over the DevTools protocol
  (`--remote-debugging-port`, and Node has had a global `WebSocket` for a while
  now) rather than a flag.
- A metadata file convention is inherited, **a declared `openGraph` block is
  not merged**. Writing `openGraph` on a page throws away the `og:image` its
  parent segment contributed, and only an `opengraph-image.tsx` in the page's
  own folder survives. The failure is silent: the page renders, the title and
  description are right, and the unfurl is a bare link.
- **A hairline grid has to be pulled out past its own text.** Cells need inline
  padding so the words do not touch the vertical rule, which then pushes the
  first column out of alignment with the section heading above it. A negative
  margin on the grid equal to the padding the cells re-apply fixes both at once,
  and the rules end up running slightly wider than the text they separate, which
  is what they should have been doing anyway.
- **A file input's `accept` needs extensions, not only MIME types.** `File.type`
  comes from the operating system, and for `.ico` the three browsers disagree
  (`image/x-icon`, `image/vnd.microsoft.icon`, or nothing at all). A list of
  types alone therefore greys the file out in the picker on the machine that has
  it, and a server that trusts the *stored* content type then refuses whatever
  did get through as "not an image". Both halves have to be handled: `.ico` in
  the `accept`, and a content type decided from the extension when the browser
  offers none.
