# Premium interface: implementation contract

**25 November appearance amendment:** [Dark-first themes and permission-aware celebrations](../design/appearance-and-celebrations.md) supersedes earlier light-only defaults. Cloudflare-managed email-code sign-in remains the current identity method.

## 1. Direction and scope

Improve the existing Merveille Designs application. Retain its Next.js, OpenNext, Cloudflare and Wrangler foundation and working domain behavior. This document supersedes older **interface** defaults involving warm paper, olive/sage, gold accents, serif display headings and a dominant branded rail. It does not replace the [product rules](../product/requirements.md), [permission model](../product/roles-and-permissions.md) or original artwork.

The outcome is a clear, consistent professional workspace: white surfaces, cool gray surroundings, graphite text, excellent alignment and readable project evidence. Branding consists of the existing logo and company name at the top. Preserve both PNG assets and their provenance in [assets/brand](../../assets/brand/README.md); use `object-fit: contain`, without cropping, recoloring or extracting a new symbol. Gold stays inside the image. “Marvel” is not the product name.

The current source mixes uncompiled utility classes, inline styles and undefined variables. Replacing colors alone will not repair it. Establish shared foundations, then migrate every route. Avoid new dashboards of decorative tiles, oversize greetings, ornamental gradients, glass effects and buttons for unavailable functionality.

## 2. Exact visual system

These are implementation defaults, not claims of an official company brand standard. Define one semantic token source, for example `src/styles/tokens.css`, imported once. Use consistent `--ui-*` names throughout CSS Modules; update legacy consumers and remove duplicate theme definitions after migration.

| Semantic token | Value | Application |
|---|---|---|
| `--ui-canvas` | `#F6F7F9` | Page background |
| `--ui-surface` | `#FFFFFF` | Navigation, forms, tables |
| `--ui-surface-subtle` | `#F2F4F7` | Selected navigation and quiet grouping |
| `--ui-text` | `#101828` | Headings and body |
| `--ui-text-secondary` | `#475467` | Supporting text |
| `--ui-text-muted` | `#667085` | Metadata on white |
| `--ui-divider` | `#E4E7EC` | Decorative separators |
| `--ui-control-border` | `#667085` | Visible field boundaries |
| `--ui-action` / `--ui-action-hover` | `#182230` / `#344054` | Primary buttons, white text |
| `--ui-link` / `--ui-focus` | `#175CD3` / `#2563EB` | Links and visible keyboard focus |
| `--ui-danger` / `--ui-danger-bg` | `#B42318` / `#FEF3F2` | Errors, destructive confirmations |
| `--ui-success` / `--ui-success-bg` | `#067647` / `#ECFDF3` | Received, released, resolved status only |
| `--ui-warning` / `--ui-warning-bg` | `#B54708` / `#FFFAEB` | Due soon or blocked status only |

Green and amber are small semantic status treatments, never the surrounding theme. Always pair color with a label or icon. Check rendered contrast in actual states; pale dividers are not sufficient input boundaries. Focus uses a 2px blue outline with 2px offset, without clipping.

Use self-hosted **Inter** for the complete interface, with its license recorded and `next/font/local` or a verified local font declaration. Load the chosen weights; a CSS family name without a downloaded font is incomplete. Fallback: `system-ui, sans-serif`. Use 400, 500 and 600 weights; reserve 700 for rare emphasis. No serif replacement or third-party font request on authenticated pages.

| Text role | Desktop | Phone |
|---|---|---|
| Page title | 28/36px, 600 | 24/32px, 600 |
| Section title | 18/26px, 600 | Same |
| Body | 15/23px, 400 | Same |
| Form control | 16/24px | Same |
| Table text | 14/20px | 15/22px when stacked |
| Metadata | 13/18px | Same |

Use tabular numerals for dates and money, right-align amount columns, and format currency through the shared configuration. Spacing: 4, 8, 12, 16, 24, 32 and 48px. Controls normally have 44px height, 8px radius; panels 12px radius and a single light border. Overlays may have a soft shadow; ordinary content does not need one. Desktop gutters: 32px; tablet: 24px; phone: 16px. Content maximum: 1440px; ordinary forms: 720px. Aim for one obvious primary action per context.

## 3. Shells and navigation

Move the root layout to document metadata, font and providers. Authentication pages must not inherit the application sidebar.

**AuthShell:** a quiet white/cool-gray page, compact unchanged logo plus “Merveille Designs” in its top row, a focused sign-in panel and “Continue with Google.” Connect that action to the real Access authentication flow. Where Access intercepts before the app renders, use its appropriately branded login and route authenticated users into the app without a second sign-in loop. Explain invitation-only access plainly. Invitation, expired invitation, wrong account and access-denied states share this shell. No demo users, role buttons, runtime information or unexplained codes. Follow [real-user identity requirements](02-identity-and-real-user-testing.md).

**AppShell:** white 240px desktop sidebar with a subtle right border and a 64–72px identity row containing a 40–48px logo and readable company label. Use a light neutral active navigation background, medium-weight label and `aria-current`. Content starts beside the sidebar without a giant branded block. A compact account menu identifies the signed-in person and offers sign-out; project switching changes project scope, never identity or role.

Navigation derives from server-authorized capabilities and memberships. Show Overview, Projects, Waiting on you and Archive when meaningful; Enquiries, firm Finance, People and Performance require their respective grants. Notifications belongs in a labelled header control. Clients and consultants receive their permitted project experience; hide inaccessible workspaces rather than offering a role selector. ADMIN and OWNER remain independent; manager authority requires its own grant. Hiding navigation never replaces server checks.

Route `/` to the real authorized landing page, not P00 diagnostics. Point “Overview” to `/overview`. A client with one project can land on its overview; several projects get a readable project chooser. Returning users retain only a still-authorized project selection.

**ProjectShell:** stable project name, short code, stage and lifecycle status above contextual navigation. Use Overview, Drawings, Updates and appropriate work sections; overflow less-used sections under a labelled “More” menu. Show only permitted destinations, preserving direct links. Include Finance for consultants' assigned client commercial records. Internal tasks/discussions must not appear in external navigation. An archive banner explains read-only access without hiding authorized downloads.

Below 1024px, replace the sidebar with a 64px top bar and accessible navigation drawer. At 390px, project content begins directly below the header; the entire menu must not stack above it. Project sections use a compact select or scrolling tab strip with an obvious current section. Keep full labels in accessible names. Wide comparison tables scroll within their container; other lists become labelled rows. Forms and long reviews use full-width sheets or pages, not cramped desktop dialogs. All shells support keyboard use and sensible focus after navigation.

## 4. Three reference compositions

Build these working screens first to settle the system, then apply the same components everywhere. Use fictional populated fixtures only in isolated development/test data, never misleading production records.

### Manager overview

Header: “Overview,” reporting period/context and one useful primary action only when permitted. The first content area contains **Overdue tasks**, **Waiting for your approval** and **Upcoming deadlines** as compact, actionable lists. Each row shows project, item, owner or requester, deadline and next action. Distinguish consultant review from manager release. A narrow summary strip may show real counts; counts must link to the relevant filtered list.

Below, show active projects in an aligned table: project, current stage, next milestone, open issues and latest update. Authorized invoiced/received summaries are secondary. OWNER-only performance and ADMIN-only payroll/profit never appear through generic overview aggregates. Avoid arbitrary health percentages or a leaderboard. On phone, priorities precede the project list.

### Client project home

Header: project name, stage and project chooser. Lead with the latest manager-published update, its date, a short explanation and permitted site photographs. Show the next milestone, the current released drawing and next payment clearly, without turning each sentence into a card. Payment presentation distinguishes due, received and outstanding; there is no checkout button.

Include a small permit summary labelled “Recorded by Merveille Designs,” with source date and approved supporting evidence. It must not look like a live K-SMART feed. Offer contextual access to drawings, documents, selections and site issues. Show controlled company announcements separately from project progress. No client drawing-approval action, internal task commentary or staff performance. Representatives receive only their granted commercial access and cannot make the main client's binding decisions.

### Drawing review and release

Use a drawing register with title, discipline, revision, state and updated date. Selecting a row opens a large preview and a focused review panel: drawing identity, exact revision, relevant evidence, required reviewers and decision history. Desktop can use roughly two-thirds preview, one-third panel; phone places readable metadata and actions around the preview. Support authenticated PDF/image previews with page/zoom controls. For unsupported CAD formats, show file information and authorized download; never pretend a blank frame is a preview.

TEAM prepares/submits; designated CONSULTANT approves or requests changes to that exact version; MANAGER releases only after required approvals. Use explicit actions such as “Approve revision C” and “Release to client,” never ambiguous “Approve” everywhere. Client views show released content without review controls. Keep the existing release current while a newer revision awaits review. Older released versions are “Superseded”; rejected drafts remain “Changes requested” or “Rejected,” preserving accurate history and permissions. Consultant assignment uses a scoped project-person selector, not the ADMIN-only people register.

## 5. Complete route migration checklist

Read the corresponding [screen contracts](../screens/README.md) before changing behavior. All existing routes must use shared shells and states; passing only the three reference screens is insufficient.

| Routes | Required treatment |
|---|---|
| `/`, `/login`, `/invite/accept`, `/access-denied` | Authorized routing; separate AuthShell; real Google identity; useful recovery. |
| `/overview`, `/waiting` | Priority lists; deep links to exact actionable records; truthful counts. |
| `/projects` | Searchable permitted project register; stage, deadline and latest activity; one creation action when allowed. |
| `/archive` | Searchable read-only project register, archive dates, retained view/download access. |
| `/enquiries`, `/enquiries/new`, `/enquiries/[id]` | Clear intake form and evidence; visible acceptance/advance requirements before manager activation. |
| `/people`, `/people/[id]` | ADMIN invitation, access, suspension and audited elevation; separate global grants from project membership. |
| `/finance` | Aligned ledger/report views; truthful period totals; ADMIN-only payroll/profit sections. |
| `/performance` | OWNER-only period-based evidence and reports; no decorative scores. |
| `/notifications` | Read/unread list, meaningful destination, delivery/preferences access. |
| `/projects/[id]/overview` | Shared project identity and audience-appropriate home composition. |
| `/projects/[id]/tasks` | Actionable list and task detail; assignment/deadline controls; completion/reopen history. |
| `/projects/[id]/drawings` | Register, preview, exact-version consultant review and manager release. |
| `/projects/[id]/documents` | File browser with type, size, audience and preview/download; no public object URLs. |
| `/projects/[id]/updates` | Photo-led timeline; draft/internal/pending/published states and manager publication. |
| `/projects/[id]/permits` | Manual sanction/completion records, source dates and permission-controlled evidence. |
| `/projects/[id]/finance` | Quotations, schedule, invoices and receipts; consultant/client commercial view excludes internal costs and raw bank evidence. |
| `/projects/[id]/selections`, `/projects/[id]/materials` | Reconcile into one “Materials & references” destination, preserving behavior/data and safe redirects for old links. |
| `/projects/[id]/changes` | Scope and estimate comparison; main-client acceptance, confirmed payment and manager authorization clearly distinguished. |
| `/projects/[id]/snags` | Photo, location, severity, assignee and resolution evidence; shared/internal discussions separated. |
| Specified `/reviews`, `/settings/notifications` | Implement the documented destination or document a complete equivalent in Waiting on you/preferences; no dead links or silently omitted workflow. |
| `error.tsx`, `not-found.tsx` and route fallbacks | Consistent recovery, correct shell, no leaked resource details or raw stack traces. |

## 6. Shared interaction implementation

Create reusable shell, page header, button, field, select, badge, table/list, empty state, error state, dialog, drawer, file preview and feedback components under `src/components`. Use CSS Modules for component layout/states and semantic tokens for styling. Replace ineffective utility classes and repeated inline styling; do not add Tailwind simply to preserve accidental markup. Reserve inline values for genuinely dynamic measurements. Use the installed icon family consistently, with text labels for unfamiliar actions.

Fields have associated labels, help text and inline validation; preserve entered values after failure. Required and optional distinctions must be understandable. Replace browser `alert`, `prompt` and `confirm` with contextual forms and accessible confirmations. Dialogs have a named heading, keyboard focus containment, Escape dismissal where safe, and focus restoration. Destructive confirmations identify the affected record and consequence. Saving disables duplicate submissions and announces the result; a financial transition needs a durable receipt/state, not only a disappearing toast.

Loading uses layout-preserving placeholders. A successful empty result offers a permitted next step; filtered emptiness offers “Clear filters.” A failed request shows an honest error and retry, never “No projects” or invented zero balances alongside the error. Handle expired sessions, denied access, file failures and stale revisions distinctly. Uploads expose progress, supported formats, size limits and retry; online-only behavior must be explicit when disconnected. Do not promise offline capture.

Remove developer-facing labels such as acceptance IDs, “Execute Runtime Spike” and “Commercial Gates.” Use “Ready to start,” “Payment awaiting confirmation” or the concrete action needed. Avoid unqualified “Approved” when consultant approval and manager release are different states.

## 7. Review and completion evidence

The implementation agent performs browser review at **1440×900, 1024×768 and 390×844**, including populated, empty, loading and error states. Verify actual loaded fonts, resolved tokens, active navigation, keyboard dialogs, readable labels, document previews and absence of page overflow. Check the built Workers-compatible preview; a Next development screenshot alone is insufficient. Source-string checks do not establish rendered quality.

Record before/after screenshots, routes, account capabilities, build identifier and remaining issues using fictional records. Exercise representative permission-sensitive flows as well as screenshots. Existing money and authorization regression checks remain necessary.

Provide Jay and the team with a deployed review URL and a short browser-only walkthrough. Their approximately three real Google accounts receive administrator-assigned access; nobody uses “view as,” impersonation, demo login or a role switcher. Ask them to sign in, open assigned projects, review relevant work and report issues. The agent handles terminal commands and automated checks. This testing group is not a permanent user limit. Finish only when all routes are consistent, real access is usable, and unresolved failures are reported honestly.
