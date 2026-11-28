# Studio workspace rollout

The studio upgrade is reviewed separately from the team's existing UAT build. The protected studio Preview uses the **existing staging D1 records and private R2 files**. It is a separate code/configuration deployment, not a disposable data sandbox. Use fictional work for testing. Existing staging at `https://merveille-web-staging.rhelo-bible.workers.dev` retains its current deployment.

Studio Preview: https://studio-merveille-web-staging.rhelo-bible.workers.dev

## What the team can test now

1. Sign in using their individually invited email code. There is no shared login or role switch.
2. Open Projects and a permitted project. Try task List, Board and Calendar; use Group / Sort / Labels and save a named personal view. On a phone, open View options. Drag with the handle or use the status selector; consequential changes still use the authorized task command.
3. Use Task details while adding a task to choose a site visit, drawing coordination, consultant follow-up or client-update checklist. Managers manage shared assignment/deadlines; personal tasks remain private.
4. Open a permitted task, try the labels/checklist menu, comments and contextual edits. Check read-only access with a different invited account. Never give Jay a project-manager role just to test a button.
5. Use Find anything or Cmd/Ctrl K to find authorized projects/tasks. Test Escape, keyboard focus and reduced/off motion.
6. Open project More → Automations, or My Tasks → Automations for a private routine. Pick a template, bind a permitted person locally, Test rule and Save draft. Simulation does not create tasks or notifications. Staff draft shared rules; only the manager publishes. Current Preview deliberately leaves live execution unavailable.
7. Compare the task/drawing journeys against the team's Asana work. Record time, mistakes and polish feedback; target 4/5 pilot users completing normal work unaided and a supported routine configured in under two minutes. Automated fixtures do not establish those results.

Dark/Light/System, original artwork, versioned consultant approval then manager drawing release, manual WhatsApp and restricted history remain. No external message is automatically sent. The Preview does not copy the staging Access administration secret; use the original staging People & access workflow for real invitations.

## Operator-only deployment and activation

The account is Workers Free, confirmed in the account's current-plan screen on 28 November 2026. Existing Worker Access protects all traffic, including Previews, with the existing invited-account policy and audience. Routing was enabled only after checking this coverage; no user or admission rule was added.

Migration `0029_studio_workspace.sql` is additive and compatible with the old build. A private staging SQL export preceded its application. It adds personal views/labels, versioned rule drafts/publications, run/effect history and the AI draft allowance. Recovery pauses restored rules before file copies.

Reproduce the current Preview after building and checking Access coverage:

```sh
npm run build:worker
STUDIO_PREVIEW_ORIGIN=https://studio-merveille-web-staging.rhelo-bible.workers.dev node scripts/write-studio-preview-config.mjs
npx wrangler preview --config .private/studio-preview.wrangler.jsonc --worker-name merveille-web-staging --name studio --ignore-base-config --json
```

The generated configuration explicitly binds staging resources and disables live automations/Gemini. Do not deploy that private configuration as the Worker's production deployment. Do not copy raw command output containing account metadata or export URLs to public evidence.

Before activating rules: measure authenticated routes and representative jobs/effects in the actual Free environment, including concurrent/retry/busy scans and account-wide headroom. Local workerd is necessary but is not a hosted CPU distribution. Keep `AUTOMATIONS_ENABLED` absent/false in web/jobs until that gate passes and the current UAT checkpoint permits promotion. Then use the same verified flag in both configurations, regenerate bindings and deploy the bounded runner through the existing jobs workflow. No paid upgrade or fallback is permitted.

The runner processes at most three rules/samples per scan and three committed effects per invocation; its fixed schedule is checked on the existing 15-minute cadence. Indexed persisted schedules and immutable publications survive retries. A run's first successful actions remain committed if a later action fails; replay does not repeat those effects. Transient failures get up to five attempts; state/authority changes block the run for review. Automation-created tasks do not chain into other rules. Initial caps are 20 active rules per project, 100 active per organization and 200 total stored rules per organization. These bounds are not a claim that an unmeasured complete account workload fits Free.

## Optional Gemini setup

No Gemini key is currently installed in staging or copied into the Preview. Store a supplied, approved key privately in platform secrets; never in chat, source, client bundles or public logs. Verify its project is eligible for the documented free model and check the actual project quota before setting `GEMINI_FREE_VERIFIED=true` and `GEMINI_MODEL=gemini-3.5-flash-lite`. Lower the initial 10 drafts/person/day and 50/org/day caps if the supplied project requires it; do not enable billing or a model fallback.

Only the generic text shown to and confirmed by the user goes to Gemini, with a fixed closed schema. No project, person, document, task or financial context is automatically loaded for the request. Real bindings happen locally afterward. The address/link check is defense in depth, not guaranteed anonymization; the user must remove confidential literals. Validate every model result again. Unsupported output, outages and quota exhaustion leave templates/manual drafting and existing deterministic rules usable.

Carry forward multi-person UAT, populated remote recovery, scheduled backup monitoring and separate-company installation gates. This rollout does not mark them passed or provision production.
