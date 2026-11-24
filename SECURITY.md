# Security expectations

Merveille Designs holds client documents, financial information and staff records. The application must enforce the information boundaries in [roles and permissions](docs/product/roles-and-permissions.md) on the server.

## Required controls

- Explicit invitation and project membership; disabled accounts fail immediately.
- Verified identity assertions, CSRF protection and server-side authorisation.
- Private object storage; permission checks on uploads, downloads, previews and archive access.
- ADMIN-only salary/profit routes and OWNER-only individual performance.
- Version-bound approval, recorded manager release and auditable financial corrections.
- Redacted logging, protected secrets and separate development/staging/production resources.
- Recoverable database and object backups with tested restoration.

Implementation details and acceptance scenarios live in the architecture and quality documents. This file is a requirement, not a claim that those controls have already been implemented.

## Reporting a problem

Do not publish credentials, client data, exploitable live document URLs or payroll in a public issue. Use GitHub private vulnerability reporting if enabled; otherwise contact the repository owner through an established private channel and share a minimal redacted description. Do not invent an email address for security reports.
