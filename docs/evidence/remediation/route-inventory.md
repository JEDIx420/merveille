# R04 route inventory — rendered local verification

Source/frontend artifact: **7e08db6**, branch `implement/merveille-portal`. Date: **24 November 2026**. Actual preview: `http://127.0.0.1:8799` (built OpenNext/workerd).

Command: `BASE_URL=http://127.0.0.1:8799 npm run test:browser` — **PASS, exit 0**. [Machine-readable results](ui/browser-results.json) contain **112 recorded checks**, including **93 route/state viewport visits**, three setup-pending assertions, three external-client navigation checks and thirteen focused interaction/failure checks. There are **31 distinct route/state destinations**, covering all **29 page routes**, the not-found fallback and the setup-pending sign-in state. No page overflow or browser JavaScript errors were recorded. Route headings are required to represent healthy content or the specifically intended recovery state; a generic error boundary is not accepted as a successful detail screen.

Fixtures are supplied only by Playwright network interception inside an isolated browser. ADMIN, OWNER, internal/intake and client contexts are fictional. This inventory proves rendered UI behavior against those responses, not Google authentication, actual D1 writes, private R2 authorization or team acceptance. Those boundaries have separate evidence. The real server has no persona/test-login bypass.

| Actual tested route/state | Shared shell | Fixture context | 1440×900 | 1024×768 | 390×844 | Observed coverage |
|---|---|---|---|---|---|---|
| `/overview` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Populated priorities and permitted project list. |
| `/projects` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/waiting` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/archive` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/enquiries` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/enquiries/new` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/enquiries/prj_review` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Valid fictional enquiry/study response, not an error-boundary substitute. |
| `/finance` | AppShell | ADMIN | PASS | PASS | PASS | ADMIN fixture, available accounting controls and truthful empty records. |
| `/performance` | AppShell | OWNER | PASS | PASS | PASS | OWNER fixture; empty evidence state. |
| `/notifications` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/people` | AppShell | ADMIN | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/people/review_manager` | AppShell | ADMIN | PASS | PASS | PASS | Fictional account grants and access history. |
| `/projects/prj_review/overview` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Operational view in inventory; client composition separately captured at all sizes. |
| `/projects/prj_review/tasks` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/drawings` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Populated register, selected exact revision and file preview. |
| `/projects/prj_review/documents` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/updates` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/permits` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/finance` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/selections` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/changes` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/projects/prj_review/snags` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/reviews` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Equivalent: Waiting on you filtered to approvals. |
| `/settings/notifications` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Equivalent: Notifications preference section. |
| `/projects/prj_review/materials` | AppShell + ProjectShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Preserved deep link redirects to Materials & references. |
| `/` | AppShell | Assigned internal project / intake fixture | PASS | PASS | PASS | Redirects to the authorised overview. |
| `/access-denied` | AuthShell | Verified invite / recovery | PASS | PASS | PASS | Intentional safe access-denied state. |
| `/missing-route` | AuthShell | Verified invite / recovery | PASS | PASS | PASS | Intentional not-found recovery state. |
| `/login` | AuthShell | Verified invite / recovery | PASS | PASS | PASS | Rendered default/empty or focused form state; business transitions are verified separately. |
| `/invite/accept` | AuthShell | Verified invite / recovery | PASS | PASS | PASS | Incomplete-link recovery state; no token/account bypass. |
| `/login?setup=pending` | AuthShell | Verified invite / recovery | PASS | PASS | PASS | Provider setup pending; no sign-in action loop. |

## Additional rendered/action checks

The three reference compositions were captured and visually inspected at every required size: [manager overview](ui/overview-1440.png), [client home](ui/client-home-1440.png), and [drawing register/release](ui/drawing-review-1440.png), with the matching `-1024` and `-390` images in the same directory. The client home is a separate client-context pass, not an internal data payload hidden by CSS.

The thirteen focused checks cover administrator access-history rendering; an explicit ADMIN invitation/elevation payload with no automatic project grants; failed settlement save feedback inside the still-open dialog with entered amount preserved; retry retaining the operation key; archived ADMIN report bound to an existing invoice; absent quotation/schedule authoring in archive; exact-version manager release payload; dialog keyboard focus, Escape and focus restoration; drawer Escape; a long filename keeping Download inside the phone viewport; a failed overview with no false zero balance; and an aborted task request visibly failing. These are UI/form-boundary assertions. Server permission, financial atomicity, archive restrictions and idempotency are not inferred from mocked responses.

The complete source-screen contracts remain in `docs/screens`. Real invited Google users must still exercise their authorised routes in the browser-only team walkthrough before hosted/team acceptance can pass.
