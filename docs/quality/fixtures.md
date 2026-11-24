# Synthetic fixture plan

Use invented people/projects only. Demo names are examples, not actual clients or staff. Domains used in fixtures should be reserved example domains, never a guessed real person's address.

## Identities

Create independent fixtures for ADMIN without OWNER, OWNER without ADMIN, combined owner/admin, manager, two staff, two consultants, main client, client representative, suspended user and uninvited identity. Do not give every fixture admin rights just to make a demo easy.

## Projects

- Courtyard House: main client and representative, staff A, manager, consultant A; active with a released drawing and a revision pending.
- Garden Studio: same client with a different representative scope; staff B; no membership for consultant A.
- Hill House: separate client, private cost records and stage-based payment schedule.
- Archived Sample: current/superseded permitted files, outstanding invoice and retained external membership.
- Enquiry Sample: requirements and site feasibility but no accepted quotation/advance.

Make a separate organisation fixture for tests even though the product serves one firm initially; this detects omitted organisation scoping without turning the product into a SaaS tenant-management project.

## Money

Use a deterministic base invoice of INR 10,000.00 (1,000,000 minor units), then receipts of INR 3,000.00 and INR 8,000.00. Correct final invoice allocation is INR 10,000.00, with INR 1,000.00 unallocated. Add a linked credit, a non-payroll expense, consultant fee and confidential salary allocation with an explicit journal.

Use a second currency to demonstrate blocked cross-currency aggregation. Tax/rounding fixtures are synthetic arithmetic cases; they are not production rates or tax guidance.

## Files

Use synthetic PDF/image/video/CAD samples, a large permitted upload, an unsupported-preview format, a misleading extension and an active-content attempt. Keep risky test payloads inert and clearly isolated from ordinary file serving.

## Time

Freeze tests at a known instant. Store UTC timestamps; render the configured organisation timezone, initially Asia/Kolkata as an engineering default. Test boundary dates, date-only versus stage-only versus both/either, revised deadlines, quiet hours and overdue escalation.

## Cleanup

Seed and reset only isolated development/test databases. Never run fixture reset against production. Ensure fake WhatsApp recipients cannot reach real numbers and local bypass identities cannot be enabled with production bindings.
