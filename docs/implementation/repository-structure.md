# Planned implementation structure

The following are proposed code boundaries. They are not a claim that runtime code exists in this planning checkout. Preserve docs, agent instructions and brand assets while scaffolding.

| Directory | Purpose |
| --- | --- |
| src/app/ | App Router routes, server-rendered pages and route handlers |
| src/components/ | Shared accessible UI and file controls |
| src/features/ | Screen-specific forms and view adapters |
| src/server/auth/ | Verified identity, principal construction and scoped policy |
| src/server/domain/ | Business commands, state transitions and invariant checks |
| src/server/db/ | D1 repositories, prepared queries and command transactions |
| src/server/files/ | Private upload/finalise/preview/download logic |
| src/server/notifications/ | Outbox policies, templates and delivery adapter |
| src/shared/ | Non-sensitive schemas, configuration, enums and formatting |
| workers/jobs/ | Scheduled/outbox/Queue/backup worker handlers |
| workers/identity/ | Restricted Access provisioning if app-driven invitations are used |
| migrations/ | Reviewed D1 schema migrations |
| tests/ | Domain, policy, Worker integration and end-to-end checks |
| docs/evidence/ | Redacted phase/release evidence created during implementation |
| assets/brand/ | Source brand artwork and tokens; copy into public assets during scaffold |

Server-only modules must not be imported into client bundles. Do not expose raw database rows directly to a screen; use permission-filtered view models. Shared validation types are not an authorisation system.

Package manager, adapter-generated entry points and exact files are pinned in P00. Use one maintained app plus explicit background/control-plane boundaries rather than speculative microservices.
