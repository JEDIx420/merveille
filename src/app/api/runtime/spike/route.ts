/** Historical diagnostic retired: never touch database or storage. */
export function GET() {
  return new Response("Not found", { status: 404 });
}
export const POST = GET;
export const HEAD = GET;
