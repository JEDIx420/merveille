import { describe, it, expect } from "vitest";
import { resolveSyntheticPrincipal, SYNTHETIC_FIXTURES } from "@/server/auth/principal";

describe("Synthetic Principal Security & Resolution", () => {
  const localEnv: CloudflareEnv = {
    DB: {} as any,
    PROJECT_FILES: {} as any,
    APP_ENV: "local",
    APP_ORIGIN: "http://localhost:8787",
    ACCESS_ISSUER: "https://example.com",
    ACCESS_AUDIENCE: "aud",
    BUSINESS_TIMEZONE: "Asia/Kolkata",
    WHATSAPP_MODE: "fake",
    ALLOW_SYNTHETIC_AUTH: "true",
  };

  const productionEnv: CloudflareEnv = {
    ...localEnv,
    APP_ENV: "production",
    ALLOW_SYNTHETIC_AUTH: "false",
  };

  it("resolves valid role fixtures in local environment via header", () => {
    const headers = new Headers({
      "x-merveille-synthetic-principal": "owner",
    });
    const cookies = { get: () => undefined };

    const principal = resolveSyntheticPrincipal(headers, cookies, localEnv);
    expect(principal).not.toBeNull();
    expect(principal?.role).toBe("OWNER");
    expect(principal?.id).toBe("usr_owner_001");
    expect(principal?.isSynthetic).toBe(true);
  });

  it("resolves consultant role with project memberships", () => {
    const headers = new Headers({
      "x-merveille-synthetic-principal": "consultant",
    });
    const cookies = { get: () => undefined };

    const principal = resolveSyntheticPrincipal(headers, cookies, localEnv);
    expect(principal?.role).toBe("CONSULTANT");
    expect(principal?.projectMemberships).toHaveLength(1);
    expect(principal?.projectMemberships[0].projectId).toBe("prj_villa_alappuzha");
  });

  it("resolves client and client representative with separate identities", () => {
    const clientPrincipal = resolveSyntheticPrincipal(
      new Headers({ "x-merveille-synthetic-principal": "client" }),
      { get: () => undefined },
      localEnv
    );
    const repPrincipal = resolveSyntheticPrincipal(
      new Headers({ "x-merveille-synthetic-principal": "rep" }),
      { get: () => undefined },
      localEnv
    );

    expect(clientPrincipal?.id).not.toBe(repPrincipal?.id);
    expect(clientPrincipal?.role).toBe("MAIN_CLIENT");
    expect(repPrincipal?.role).toBe("CLIENT_REP");
  });

  it("STRICT FAIL-CLOSED: completely denies synthetic auth in production environment", () => {
    const headers = new Headers({
      "x-merveille-synthetic-principal": "admin",
    });
    const cookies = { get: () => undefined };

    const principal = resolveSyntheticPrincipal(headers, cookies, productionEnv);
    expect(principal).toBeNull();
  });
});
