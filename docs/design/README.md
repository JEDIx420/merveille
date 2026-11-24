# Design specification

Marvel is the working title for a private architecture practice portal. The experience should feel like a carefully organised studio: warm, precise and calm. It is an operational product, so beauty must make decisions easier to see and work easier to complete.

Read in this order:

1. [Design system](design-system.md): colour, type, layout, components and accessibility.
2. [Interaction patterns](interaction-patterns.md): approvals, file handling, form behaviour and every non-happy-path state.
3. [Navigation and content](navigation-and-content.md): role-adaptive routes and language.
4. [Screen specifications](../screens/README.md): implementation contracts for each screen.

The [product requirements](../product/requirements.md) and [permission matrix](../product/roles-and-permissions.md) decide what a person may do. Design defaults here decide how to present that permitted work. Visual examples, if added, are not proof of functional implementation.

Brand assets are catalogued in the [brand asset manifest](../../assets/brand/README.md). The [visual direction specimen](visual-direction.html) illustrates the style and is not the application. The wordmark and architectural mark are supplied separately from this documentation. Use the approved asset manifest; do not redraw the logo in individual components.

## Design review gates

- Show the owner’s three priorities before secondary statistics: delayed tasks, pending approvals, upcoming deadlines.
- A client sees released information and their next actions, without internal terminology or work queues.
- A consultant can review the correct drawing version and see the assigned project’s client quotation/payment history; internal discussions remain inaccessible.
- Salary/profit visibility requires ADMIN. Staff performance visibility requires OWNER. These are separate capabilities, even if one person holds both.
- Review desktop at 1440 px, laptop at 1024 px, and mobile at 390 px; verify 320 px reflow and 200% text zoom.
- Use real keyboard interaction and representative long names, file names, figures and empty states. Attractive screenshots alone do not satisfy the screen acceptance criteria.
