import { createRemoteJWKSet, jwtVerify } from "jose";
export interface AccessJwtPayload {
  aud: string[];
  email: string;
  sub: string;
  iss: string;
  iat: number;
  nbf: number;
  exp: number;
  type: string;
}
export interface AccessJwtValidationResult {
  valid: boolean;
  payload?: AccessJwtPayload;
  error?: string;
}
export async function validateAccessJwt(
  jwt: string | null | undefined,
  env: CloudflareEnv,
): Promise<AccessJwtValidationResult> {
  try {
    const issuer = env.ACCESS_ISSUER?.replace(/\/+$/, "");
    if (
      !issuer ||
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
      !env.ACCESS_AUDIENCE ||
      env.ACCESS_AUDIENCE.includes("__REPLACE")
    )
      throw new Error("Identity provider setup is incomplete.");
    if (!jwt) throw new Error("Sign in with your invited Google account.");
    const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(jwt, keys, {
      issuer,
      audience: env.ACCESS_AUDIENCE,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "email", "exp", "iat", "iss", "aud"],
      clockTolerance: 30,
    });
    if (
      typeof payload.iat !== "number" ||
      payload.iat > Math.floor(Date.now() / 1000) + 30 ||
      typeof payload.exp !== "number" ||
      payload.exp <= payload.iat
    )
      throw new Error("Invalid identity issue time.");
    if (
      payload.type !== "app" ||
      typeof payload.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
      typeof payload.sub !== "string" ||
      !payload.sub.trim()
    )
      throw new Error("A human Google identity is required.");
    return { valid: true, payload: payload as unknown as AccessJwtPayload };
  } catch {
    return {
      valid: false,
      error:
        "Sign-in could not be verified. Contact your administrator if access setup is pending.",
    };
  }
}
