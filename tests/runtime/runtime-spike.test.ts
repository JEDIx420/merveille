import { describe, it, expect, vi } from "vitest";
import { GET, POST } from "@/app/api/runtime/spike/route";
import { NextRequest } from "next/server";

// Mock getCloudflareContext for unit test environment
vi.mock("@opennextjs/cloudflare", () => {
  const store = new Map<string, any>();
  const r2Store = new Map<string, string>();

  const mockDb = {
    exec: vi.fn(async (_sql: string) => {}),
    prepare: vi.fn((sql: string) => {
      let boundArgs: any[] = [];
      return {
        bind: (...args: any[]) => {
          boundArgs = args;
          return {
            run: vi.fn(async () => {
              if (sql.includes("INSERT")) {
                store.set(boundArgs[0], { id: boundArgs[0], test_val: boundArgs[1], created_at: boundArgs[2] });
              }
              return { success: true };
            }),
            first: vi.fn(async () => {
              if (sql.includes("SELECT")) {
                return store.get(boundArgs[0]) || null;
              }
              return null;
            }),
          };
        },
      };
    }),
  };

  const mockR2 = {
    put: vi.fn(async (key: string, value: string) => {
      r2Store.set(key, value);
      return { key, size: value.length };
    }),
    get: vi.fn(async (key: string) => {
      const val = r2Store.get(key);
      if (!val) return null;
      return {
        size: val.length,
        text: async () => val,
      };
    }),
  };

  return {
    getCloudflareContext: async () => ({
      env: {
        DB: mockDb,
        PROJECT_FILES: mockR2,
        APP_ENV: "local",
        APP_ORIGIN: "http://localhost:8787",
        ACCESS_ISSUER: "https://example.com",
        ACCESS_AUDIENCE: "aud",
        BUSINESS_TIMEZONE: "Asia/Kolkata",
        WHATSAPP_MODE: "fake",
        ALLOW_SYNTHETIC_AUTH: "true",
      },
      cf: {},
      ctx: { waitUntil: () => {}, passThroughOnException: () => {} },
    }),
  };
});

describe("Runtime Spike Endpoint", () => {
  it("executes GET verifying D1 and R2 persistence and HTTP headers/cookies", async () => {
    const request = new NextRequest("http://localhost:8787/api/runtime/spike", {
      headers: {
        "x-merveille-synthetic-principal": "staff",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Merveille-Runtime")).toBe("workerd-verified");

    const data = await response.json();
    expect(data.status).toBe("verified");
    expect(data.runtime).toBe("workerd");
    expect(data.d1.success).toBe(true);
    expect(data.r2.success).toBe(true);
    expect(data.syntheticPrincipal?.role).toBe("STAFF");
  });

  it("executes POST mutation persisting record", async () => {
    const request = new NextRequest("http://localhost:8787/api/runtime/spike", {
      method: "POST",
      body: JSON.stringify({ item: "Drawing Set Phase 1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.mutation).toBe("success");
    expect(data.received.item).toBe("Drawing Set Phase 1");
  });
});
