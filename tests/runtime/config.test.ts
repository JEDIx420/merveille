import { describe, it, expect } from "vitest";
import { BRAND_CONFIG, formatRupees, formatBusinessDate } from "@/shared/config";

describe("Brand Configuration & Financial Formatting", () => {
  it("preserves exact confirmed brand name and currency tokens", () => {
    expect(BRAND_CONFIG.companyName).toBe("Merveille Designs");
    expect(BRAND_CONFIG.currency.code).toBe("INR");
    expect(BRAND_CONFIG.currency.minorUnitRatio).toBe(100);
    expect(BRAND_CONFIG.timezone).toBe("Asia/Kolkata");
  });

  it("formats integer paise into Indian Rupee format", () => {
    // 15000000 paise = ₹1,50,000.00
    const formatted = formatRupees(15000000);
    expect(formatted).toContain("1,50,000.00");
    expect(formatted).toContain("₹");
  });

  it("formats zero and fractional rupee paise correctly", () => {
    expect(formatRupees(0)).toContain("0.00");
    expect(formatRupees(50)).toContain("0.50");
  });

  it("formats business date using Asia/Kolkata timezone", () => {
    const fixedDate = new Date("2026-11-24T12:00:00Z");
    const formatted = formatBusinessDate(fixedDate);
    expect(formatted).toBeDefined();
    expect(formatted).toContain("2026");
  });
});

it('business deadline keys follow Kolkata across UTC date boundaries',async()=>{const {businessDateISO}=await import('@/shared/config');expect(businessDateISO(new Date('2026-11-23T20:00:00Z'))).toBe('2026-11-24');expect(businessDateISO(new Date('2026-11-23T17:00:00Z'))).toBe('2026-11-23');});
