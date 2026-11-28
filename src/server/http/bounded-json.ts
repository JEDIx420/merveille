import { AuthorizationError } from "@/server/auth/policy";
export async function boundedJSON(
  request: Request,
  maxBytes = 16000,
): Promise<any> {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new AuthorizationError("This request is too large.", "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader)
    throw new AuthorizationError("Request body is required.", "INVALID_INPUT");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AuthorizationError(
        "This request is too large.",
        "INVALID_INPUT",
      );
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    throw new AuthorizationError(
      "Choose valid request values.",
      "INVALID_INPUT",
    );
  }
}
