import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordAdminAction, fetchAdminAuditLog, isAuditLoggingDegraded } from "./adminService";

const API_BASE = "http://localhost:3001";

vi.mock("@/lib/apiConfig", () => ({
  get API_BASE_URL() {
    return "http://localhost:3001";
  },
}));

describe("adminService - audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("recordAdminAction throws when server returns non-OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(
      recordAdminAction("user.status_changed:suspended", "wallet-123"),
    ).rejects.toThrow("Audit logging degraded");

    expect(isAuditLoggingDegraded()).toBe(true);
  });

  it("fetchAdminAuditLog throws when server returns non-OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 503, statusText: "Service Unavailable" }),
    );

    await expect(fetchAdminAuditLog()).rejects.toThrow("Audit log unavailable");
    expect(isAuditLoggingDegraded()).toBe(true);
  });

  it("recordAdminAction resolves successfully when server returns OK", async () => {
    const mockEntry = { id: "evt-123", timestamp: "2025-01-01T00:00:00Z", actor: "current-admin", action: "test" };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockEntry), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await recordAdminAction("test");
    expect(result.id).toBe("evt-123");
    expect(isAuditLoggingDegraded()).toBe(false);
  });

  it("fetchAdminAuditLog resolves successfully when server returns OK", async () => {
    const mockEntries = [{ id: "evt-1", timestamp: "2025-01-01", actor: "admin", action: "test" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockEntries), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchAdminAuditLog();
    expect(result).toHaveLength(1);
    expect(isAuditLoggingDegraded()).toBe(false);
  });
});
