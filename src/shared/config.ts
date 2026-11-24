/**
 * Merveille Designs central brand, locale, currency and runtime configuration.
 */

export const BRAND_CONFIG = {
  companyName: "Merveille Designs",
  portalTitle: "Merveille Designs Portal",
  descriptor: "Consultancy and Interiors",
  logoPath: "/merveille-designs-logo.png",
  profileLogoPath: "/merveille-designs-profile.png",
  faviconPath: "/favicon.png",
  currency: {
    code: "INR",
    symbol: "₹",
    locale: "en-IN",
    minorUnit: "paise",
    minorUnitRatio: 100,
  },
  timezone: "Asia/Kolkata",
  supportEmail: "support@merveilledesigns.com",
} as const;

/**
 * Format integer minor units (paise) to display Indian Rupees (₹).
 * Never use formatted string for arithmetic; integer minor units remain the authority.
 */
export function formatRupees(minorUnits: number | bigint): string {
  const units = Number(minorUnits) / BRAND_CONFIG.currency.minorUnitRatio;
  return new Intl.NumberFormat(BRAND_CONFIG.currency.locale, {
    style: "currency",
    currency: BRAND_CONFIG.currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(units);
}

/**
 * Format date in business timezone (Asia/Kolkata) with consistent human readability.
 */
export function formatBusinessDate(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(BRAND_CONFIG.currency.locale, {
    timeZone: BRAND_CONFIG.timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Format timestamp in business timezone (Asia/Kolkata) with hours and minutes.
 */
export function formatBusinessTimestamp(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(BRAND_CONFIG.currency.locale, {
    timeZone: BRAND_CONFIG.timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
