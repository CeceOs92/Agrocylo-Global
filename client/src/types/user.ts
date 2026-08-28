/**
 * Canonical platform user role. This is the single source of truth for role
 * values — do not redeclare this union elsewhere. Both farmer/buyer profile
 * flows and admin/moderator tooling reference this same type.
 */
export type UserRole = "farmer" | "buyer" | "moderator" | "admin";
