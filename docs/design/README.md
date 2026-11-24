# Current design specification

The active target is a **white, cool-gray and graphite SaaS interface** for Merveille Designs, with the existing logo compactly displayed at the top. The user's latest correction supersedes the earlier warm-paper/gold/serif direction and dominant branded rail.

Read [03 — Premium interface](../remediation/03-premium-interface.md) first. It defines tokens, typography, spacing, shared components, shells, three reference screens and all-route migration. Then use [design system](design-system.md), [interaction patterns](interaction-patterns.md), [navigation](navigation-and-content.md) and the relevant [screen contract](../screens/README.md).

The [permission matrix](../product/roles-and-permissions.md) decides allowed actions. Navigation reflects the actual signed-in person's current grants; there is no role/view switcher. Preserve manager release, consultant review, internal privacy and separate ADMIN/OWNER authority.

[Brand assets](../../assets/brand/README.md) remain authoritative for the unchanged company name and logo. The [old visual specimen](visual-direction.html) is historical and must not be used as the redesign target. Runtime brand token files may still reflect the old implementation until the coding agent migrates them.

Review actual rendered screens at 1440×900, 1024×768 and 390×844, plus keyboard/zoom/reflow behavior. Use fictional business data, real invited accounts for hosted UAT, and meaningful permission tests. Every route needs correct loading, empty, error, forbidden and action states. A screenshot alone does not prove the workflow.
