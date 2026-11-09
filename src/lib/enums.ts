/**
 * GraphQL enums are UPPER_SNAKE (REVENUE_CAGR_3Y); internal ids are camelCase
 * (revenueCagr3y). One reversible convention instead of hand-kept tables —
 * a unit test round-trips every metric and ratio id.
 */
export function toEnum(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([a-zA-Z])(\d)/g, "$1_$2")
    .toUpperCase();
}

export function fromEnum(name: string): string {
  return name.toLowerCase().replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
