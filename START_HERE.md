# Start here

Latest accepted amendment: [simple project workspace](docs/design/simple-workspace.md). It supersedes voice entry and conflicting daily navigation requirements below. Voice is retired, not a pending activation gate. Preserve the specialist/history workflows behind secondary navigation.

Continue the existing Merveille Designs app on **`implement/merveille-portal`**. The active assignment is the [27 November next-phase plan](docs/next-phase/README.md), N00–N05. Preserve completed remediation, source, migrations, data and useful tests.

## 1 Open the existing application

Inspect the folder, remote, branch and local changes. Only for a genuinely empty folder:

```bash
git clone --branch implement/merveille-portal https://github.com/JEDIx420/merveille.git .
```

For an existing checkout, fetch and inspect the remote implementation branch, then resume it or a safely based feature branch. Preserve unrelated work. Do not reset the checkout, recreate the scaffold or start from planning-only main.

## 2 Read the current contract

1. [AGENTS.md](AGENTS.md), [task.md](task.md) and [NEXT_AGENT.md](NEXT_AGENT.md).
2. [Next-phase work order](docs/next-phase/README.md) and [manifest](docs/next-phase/manifest.json).
3. Its six ordered documents, beginning with [scope and free-tier feasibility](docs/next-phase/01-scope-and-free-tier-baseline.md).
4. Only the existing workflow, screen, role and architecture references relevant to the selected stage.

The new plan overrides older in-portal billing, paid-provider and automated WhatsApp requirements. [R00–R05](docs/remediation/manifest.json) records prior work and applicable remaining gates. P00–P14 is older specification history. Neither is a reason to repeat completed implementation.

## 3 Establish the Free-plan baseline first

Run the documentation checker and inspect code/configuration. Verify the account plan, Workers CPU/runtime, AI allowance, Access users, data/storage/backup capacity and scheduled-job assumptions before promising the workload fits. Keep Next/OpenNext, D1, private R2 and Wrangler unless a measured incompatibility requires the smallest documented correction. Never enable a paid fallback.

Voice planning uses free Workers AI hosting of open-source models, with bounded formatting and an optional browser-local benchmark. Manual WhatsApp sharing leaves `WHATSAPP_MODE=disabled`: prepare/copy an approved update, open WhatsApp Web, and let a person select the group and send. Billing stays external; preserve audited scope acceptance, external clearance and manager authorization.

## 4 Implement the next ready slice

Follow the active manifest. Build shared task views, client visibility, simple leads/imports, voice and reminders without duplicate records or widened access. Preserve manager authority over official project assignments/deadlines, email-code access, separate roles, consultant approval then manager release, no client drawing approval, no impersonation, original logo and Dark/Light/System appearance.

Use reviewed [project-local skills](docs/implementation/skills-and-tools.md). Generic quickstarts do not override this contract. Continue independent authorized work when a deployment/model gate is blocked; record the limitation and keep affected paths truthful and unavailable.

## 5 Verify and leave a checkpoint

The coding agent owns terminal checks and rendered review. Team UAT uses real invited identities and fictional records through the browser. Follow [verification and rollout](docs/next-phase/06-verification-and-rollout.md), carrying forward access/recovery gates while leaving API WhatsApp tests deferred.

Update task.md, the next-phase manifest and evidence with changed files, commit/environment, actual results, blockers and one exact next action. Separate documentation completion, application implementation, local, hosted and team acceptance. A paid-plan test, mock or old remediation result does not prove the new Free-only behavior.
