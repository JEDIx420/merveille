# Interface remediation evidence

The UI uses the unchanged Merveille Designs logo, the prescribed white/cool-gray/graphite tokens, and self-hosted Inter. InterVariable.woff2 and its SIL Open Font License were obtained from `rsms/inter` (`docs/font-files/InterVariable.woff2`, `LICENSE.txt`); no third-party font request is made by authenticated pages.

Reviewed project guidance: `.agents/skills/frontend-design/SKILL.md` (anthropics/skills commit e4bb5d960d87126ff3b3a8af1a104b7db67560ba), project-local Playwright, and the current remediation/screen contracts. The product's exact neutral design and access decisions take precedence over generic skill defaults.

`baseline-login-desktop.png` shows the historical built login before containment, captured by the root agent in an isolated local preview. It contains only the original fabricated personas. It is retained as before/after evidence, not an available login mode.

`npm run test:browser` (`scripts/check-browser.mjs`, `BASE_URL` override) exercises the rendered application using API interceptions in an isolated Playwright browser. It visits every current page route and the documented equivalent/redirect destinations at 1440×900, 1024×768 and 390×844. It checks loaded Inter, page overflow, keyboard dialog focus/Escape/restoration, drawer dismissal, surfaced failed/interrupted requests, invitation form payload and exact drawing-release context. Fixture identities and business records are fictional. The script does not bypass authentication inside the application or prove actual Google/Access onboarding, server authorization, D1 persistence, file publication, or real-user UAT.

Screenshots cover manager priorities, client project home, drawing register/preview, sign-in/invitation states, and an error state. `browser-results.json` records the actual target URL and outcomes. Next development screenshots may include the framework's development indicator; Workers-preview screenshots supersede them when the same harness is rerun against the built preview.

Remaining hosted identity, real-account UAT, private file access and production release checks are tracked by the root remediation evidence. No real person was impersonated for these screenshots.
