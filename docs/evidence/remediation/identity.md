# R00/R01 identity evidence

Branch: implement/merveille-portal. Baseline: 82921d6. Date: 24 November 2026. Final source commit is recorded in session.md. No remote write or account provisioning was performed.

## Implementation

Removed synthetic request/cookie resolution entirely; no runtime flag can enable it. Retired diagnostic verbs return 404 without obtaining bindings. Root redirects to the application overview. Default configuration is local/fail-closed; named targets retain explicit isolated placeholder inputs until authorized setup. The exact baseline-seeded administrator is disabled if unbound, preserving references/history.

Access JWTs use pinned jose 6.1.3 with trusted-issuer JWKS, RS256 signature verification, issuer/audience/expiry/time/human-identity requirements. Identities bind by issuer/subject, not email fallback. Missing/inactive organization membership and unrecognized/no capabilities fail closed. All global grants and project roles survive; ADMIN, OWNER and scoped MANAGER remain independent. Request origin and private response headers are enforced centrally. Invitation links use fragments, no-referrer policy and digest-only 256-bit tokens.

Bootstrap is a protected operator command and a persisted singleton consumed inside D1 batch. Invitations revalidate exact verified email, current inviter authority, admission status, expiry and token state. Duplicate bootstrap/invitation acceptance rolls back. Last-admin protection counts active accepted bindings and runs in the write batch. Current acting administrator is also rechecked transactionally. Privileged elevation requires explicit confirmation and recent verified authentication. Access reconciliation remains disabled without narrow provider configuration. Copy-link delivery is honest.

Controlled operator linking now covers reviewed active legacy accounts with no binding: it requires a fresh exact verified identity, preserves IDs/grants, rejects re-linking or suspension bypass and appends audit. Future-issued assertions are rejected.

People administration supports independent capabilities/project grants, explicit financial author/issue eligibility, contractual pointer editing, invitation ready/revoke/reissue and suspension. Prior authority decisions are retained. Non-admin project selectors use a limited participants endpoint with no email/address enumeration. Creating a project from intake assigns access/contractual authority, so its conversion action is ADMIN-only under the confirmed access-administration rule; intake creation/study/closure remain available under explicit intake grants. Optional organization TEAM_MEMBER/MANAGER grants authorize intake/company publishing respectively and never substitute for scoped project approvals.

## Actual local verification

- `npx vitest run tests/authorization/p01-access.test.ts tests/runtime/principal.test.ts tests/runtime/runtime-spike.test.ts`: signed JWKS validation; forged/expired/wrong issuer/audience/human claims rejected; old synthetic headers/cookies ignored even with a legacy flag; matching/wrong/used invitation; multi-capability and per-project privacy; missing membership; last-admin guard; bootstrap race; CSRF; deliberate contractual authority removal.
- The local workerd drill additionally exercises bootstrap concurrency, persistent singleton protection, elevation confirmation/recent authentication and simultaneous administrator removal. These tests inject verified fixture claims at the service boundary; they do not prove a real Google provider.
- `npm run typecheck`, full tests, final Workers build and private HTTP/browser checks are recorded in session.md.

## Actual external inspection and blocker

`wrangler whoami` confirmed infrastructure authentication (personal details retained only in ignored local output). Read-only Cloudflare REST GETs using that existing credential returned HTTP 200 with zero Access apps and zero identity providers. Organization inspection returned 403. No policies, IdPs, users, resources, secrets, records or deployments were changed. Google OAuth/Access setup and authorized review-host configuration are concrete remaining dependencies. Jay's exact supplied email is held only in ignored private input; it was never used to guess a privileged mapping.

The [real-account handoff](../../operations/real-account-handoff.md) provides operator and browser-only steps. Hosted verification and team acceptance remain blocked.
