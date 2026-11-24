# R02/R04 — premium interface and browser verification

## Identity and scope

- Stage: R02 shared UI/reference compositions; R04 complete route/interaction migration; local UI portion of R05.
- Branch: `implement/merveille-portal`. Rendered frontend/source artifact: **7e08db6**.
- Date/environment: **24 November 2026**, built Next/OpenNext application served in local **workerd** at `http://127.0.0.1:8799`.
- Actual tool versions: Next **15.5.29**, React **19.0.0**, OpenNext **1.20.18**, Playwright **1.65.1** with bundled Chromium.
- Fixtures: fictional identities and Courtyard House project records supplied only through Playwright's browser-network interception. No runtime fixture login, real Google account, real client record, production export or authentication cookie is included in artifacts.

Implementation and local rendered verification are complete for the scope described below. **Hosted Google/Access onboarding and real-person team acceptance remain blocked/pending provider setup**, and are not represented by this browser harness. Backend, D1/R2 and real unauthenticated HTTP checks are separately recorded in [session evidence](session.md), [identity evidence](identity.md), [financial evidence](../remediation-finance.md) and [operational evidence](../remediation-operations.md).

## Changed behavior

- One white/cool-gray/graphite token source, licensed self-hosted Inter, CSS Modules and shared button/field/badge/table/state/dialog/preview components. The final pure external-client fixture has no inherited intake/organisation capabilities. Original logo artwork is unchanged and compact. Undefined legacy token families and ineffective utility styling have been retired.
- Separate AuthShell, capability-aware AppShell and ProjectShell. Normal account identity/sign-out and project switching remain; deployed demo/persona controls and role-switching cookies are gone. Phone navigation uses a drawer and contained project tabs.
- Functional manager priorities, published client project home with next milestone/released drawing/payments/manual permit context, and drawing register with selected immutable revision, preview and distinct consultant/manager actions.
- All existing page routes use the shared foundation. Materials deep links, review work and notification preferences retain documented equivalents. People supports independent organisation/project grants, invitation copy/setup/reissue/revocation, privileged confirmation, suspension and visible access history.
- Scoped participant/receipt selectors replace administrative-directory dependency and raw user/receipt ID entry. Quotations, schedule revisions, accounting records, ordinary receipts and archived ADMIN settlement reporting are wired to their actual service APIs. Issuing/approval and archive authorities remain server-enforced.
- Native accessible dialogs replace browser prompts/alerts. Errors are visible inside open dialogs, preserve form input and allow explicit retry; consequential payment retries retain their operation key. File previews retain authenticated downloads and safe unsupported-format handling.

## Actual verification

| Contract / risk | Command or procedure | Result | Evidence and limit |
|---|---|---|---|
| R02/R04; rendered portion of AC-062 | `BASE_URL=http://127.0.0.1:8799 npm run test:browser` | **PASS, exit 0 — 112 recorded checks** | [Results](ui/browser-results.json), [complete route inventory](route-inventory.md). All 29 page routes plus fallback/setup states at the three required sizes; loaded Inter and computed 16px fields; no page overflow or browser JavaScript errors. |
| R02 reference compositions | Visual inspection of all nine manager/client/drawing screenshots at 1440×900, 1024×768 and 390×844 | **PASS** | Compact branding, neutral hierarchy, current context, readable actions/preview and contained tables/navigation. No framework development indicator in final built screenshots. |
| F05; rendered portions of AC-061/AC-063 | HTTP 503 and aborted-request browser interceptions, failed payment save/retry | **PASS** | Error visible in dialog, original amount retained, same operation key on retry; failed overview contains no false ₹0 balance. This is browser failure handling, not a real-provider delivery or server financial-idempotency claim. |
| R01/F02 UI | Admin invitation/elevation and access-history form checks | **PASS** | Correct explicit roles/projects/confirmation payload; readable actor/time/reason and grant history. Real authenticated invitations and authorization are separate gates. |
| F03 drawing UI | Select revision, invoke manager release, capture exact version path/current pointer | **PASS** | Exact-version form context and accessible preview. Actual consultant approval/release authorization and transactional persistence are covered separately. |
| Archive financial UI | Report actual outside settlement payment against selected existing invoice, preserve amount/key through failed request, show permitted ADMIN action | **PASS** | No raw invoice ID; normal confirmation/allocation remain distinct. Backend immutable ledger and archive restrictions are not established by a fixture response. |
| Dialog/drawer keyboard behavior | Tab focus, Escape, opener restoration and drawer dismissal | **PASS** | Assertions wait for actual state/focus, rather than assuming a fixed rendering delay. |
| Long filenames | Open long unbroken drawing filename at 390px; assert Download bounds | **PASS** | [Phone proof](ui/drawing-long-name-390.png). Filename wraps while Download remains visible. Page-width checks alone would have missed the prior clipped action. |
| Static typing | `npm run typecheck` after the interface changes | **PASS** | Application source compiles; this does not substitute for rendered or server checks. |

`node scripts/check-handoff.mjs` also passed with zero failures after these evidence files were written. It explicitly reports `applicationTestsRun: false`; it is a structural documentation/link check.

## Screenshots and self-review

| Composition | Desktop | Tablet | Phone |
|---|---|---|---|
| Manager priorities | [1440](ui/overview-1440.png) | [1024](ui/overview-1024.png) | [390](ui/overview-390.png) |
| Client project home | [1440](ui/client-home-1440.png) | [1024](ui/client-home-1024.png) | [390](ui/client-home-390.png) |
| Drawing review/release | [1440](ui/drawing-review-1440.png) | [1024](ui/drawing-review-1024.png) | [390](ui/drawing-review-390.png) |
| Sign-in | [1440](ui/login-1440.png) | [1024](ui/login-1024.png) | [390](ui/login-390.png) |
| Setup pending | [1440](ui/setup-pending-1440.png) | [1024](ui/setup-pending-1024.png) | [390](ui/setup-pending-390.png) |

Additional evidence: [admin access history](ui/access-history-desktop.png), [mobile error recovery](ui/overview-error-mobile.png), [long drawing filename](ui/drawing-long-name-390.png), and [historical baseline login](ui/baseline-login-desktop.png). The baseline's old fictional personas are historical evidence only, not an available login method.

Self-review confirmed that priorities precede project lists, client financial figures are distinctly labelled, the existing release is distinguished from a reviewed replacement, manual permit data is described honestly, navigation does not stack above the phone workspace, and wide register columns scroll inside their own container. The unusually long filename stays complete without hiding Download. Drawings are fixture geometry, not actual client documents. Empty permit/record states remain empty rather than showing fabricated progress.

## Failures found and corrected

1. The initial mobile drawing register compressed labels into unreadable fragments; register/table content now uses contained horizontal scrolling.
2. A full browser pass found page overflow in four legacy filter/tab bars (`/finance`, project tasks/documents/finance). The bars now scroll within the content width. The [recorded pre-fix report](ui/browser-results-before-overflow-fix.json) is retained; final results show zero page overflow.
3. Field help text initially became part of the accessible label. Fields now use stable label associations and separately described help.
4. Dialog teardown could race opener restoration; it now captures its node and restores a connected opener after native teardown. Feedback that was inert outside a modal is also rendered inside it, with preserved input and dismissal.
5. A long filename hid the preview Download action despite a clean page-width check; the filename shrinks/wraps and the action keeps its width, with an explicit bounds regression.
6. The browser fixture for enquiry detail initially omitted the required enquiry/studies shape and reached the safe error boundary. The fixture now supplies valid fictional detail, and unexpected generic error-boundary headings fail route verification. No error-boundary render is counted as a successful detail screen.

## Remaining external gates

This evidence does **not** pass real Google sign-in, exact-email Jay bootstrap, Access allowlist synchronization, real authenticated private file access, hosted provider delivery or team UAT. The firm/operator must supply the private identities and configured Google/Access review environment, then follow the [browser-only real-account handoff](../../operations/real-account-handoff.md). Production readiness is not claimed from screenshots, fixture responses or a successful build.

Later server-only fixes for authorized contributed reference/material image parents do not change the rendered frontend artifact described here; their service/runtime verification remains in the session evidence.
