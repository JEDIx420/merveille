# Start here — improve the existing Merveille Designs application

The app exists on **`implement/merveille-portal`**. The current assignment is remediation: premium consistent UI, real Cloudflare-managed accounts/admin access and reliable business workflows. Do not start from a fresh Next scaffold or repeat P00.

## 1. Open the right code

Inspect the folder, remote, branch and local changes. For a genuinely empty folder:

```bash
git clone --branch implement/merveille-portal https://github.com/JEDIx420/merveille.git .
```

For an existing checkout, fetch and inspect the remote implementation branch, then resume it or a feature branch based on it. Preserve local work; do not reset or overwrite it. If this checkout contains only planning files, follow [NEXT_AGENT.md](NEXT_AGENT.md) to the existing application. The [skills and tools guide](docs/implementation/skills-and-tools.md) covers setup without rebuilding the foundation.

## 2. Read the current contract

1. [AGENTS.md](AGENTS.md) and [task.md](task.md).
2. [Current work order](docs/remediation/README.md).
3. Its ordered documents: [product amendment](docs/remediation/01-product-amendment.md), [real accounts](docs/remediation/02-identity-and-real-user-testing.md), [premium interface](docs/remediation/03-premium-interface.md), [functional repairs](docs/remediation/04-functional-repairs.md), [delivery and acceptance](docs/remediation/05-delivery-and-acceptance.md).
4. [Active manifest](docs/remediation/manifest.json).
5. The applicable [requirements](docs/product/requirements.md), [permissions](docs/product/roles-and-permissions.md), [screen](docs/screens/README.md) and [workflow](docs/workflows/README.md) files for the stage.

The current amendment supersedes older warm/gold design and demo/fresh-build instructions. Unchanged business rules remain binding. P00–P14 and their evidence are reference history, not automatic release proof.

## 3. Begin R00, then continue

Check actual application/test/configuration state and run the documentation checker. Remove unsafe diagnostic/deployed fixture entry points, then implement genuine identity and shared design foundations. Follow R00–R05 dependencies; parallelize independent work only after shared contracts agree.

Preserve the current Next/OpenNext runtime and Cloudflare/Wrangler resources. Use reviewed project-local skills only where useful. Do not migrate frameworks or install every marketplace skill to solve a design problem.

## 4. Keep the latest experience explicit

- Neutral white, cool gray and graphite interface; compact original Merveille Designs logo at the top.
- No role/view switcher, demo login or deployed impersonation.
- Jay bootstrapped once as initial ADMIN from a privately supplied exact sign-in email; multiple admins and admin-managed invitations/roles/projects.
- Cloudflare email-code login for the team's approximately three initial testers; no permanent user cap.
- Consultant drawing approval followed by manager final release; no client drawing approval. Internal discussions remain private.
- Keep all existing commercial, financial, site and archive rules in AGENTS.md.

## 5. Verify and leave a resumable checkpoint

The coding agent owns terminal/build/regression checks and actual rendered browser review. Team UAT is a short browser walkthrough with real accounts and fictional business records. Use meaningful permission, money, concurrency and file checks; screenshots or source-string tests alone are insufficient.

Update task.md, the active manifest and evidence with changed paths, build/commit, actual results, blocked inputs and the next exact action. Continue without routine permission loops. Missing credentials block only their dependent integration; never substitute demo access or fake success.

Completion means the entire route inventory and required workflows are implemented and verified, real account onboarding works, and outstanding hosted/team gates are honestly recorded. See [delivery and acceptance](docs/remediation/05-delivery-and-acceptance.md).
