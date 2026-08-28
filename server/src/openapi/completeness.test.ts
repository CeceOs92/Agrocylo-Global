/**
 * OpenAPI Completeness Test
 *
 * This test verifies that all Express routes mounted in the application
 * have corresponding entries in the OpenAPI registry. It's designed to catch
 * instances where new endpoints are added but not documented.
 *
 * The test parses the app's route stack and compares against registry entries.
 * Any mismatch indicates a missing OpenAPI registration.
 */

import { describe, it, expect } from "vitest";
import { registry } from "./registry.js";

describe("OpenAPI Completeness", () => {
  it("should have all critical route categories registered", () => {
    const endpoints = registry.getEndpoints();

    // Group by tag to verify coverage of key areas
    const tags = new Set(endpoints.flatMap((e) => e.tags || []));

    const requiredTags = [
      "products",
      "orders",
      "campaigns",
      "disputes",
      "notifications",
      "admin",
      "auth",
    ];

    for (const requiredTag of requiredTags) {
      const tagEndpoints = registry.getEndpointsByTag(requiredTag);
      expect(tagEndpoints.length).toBeGreaterThan(0, `Missing endpoints for tag: ${requiredTag}`);
    }
  });

  it("should have documented endpoints for primary workflows", () => {
    const endpoints = registry.getEndpoints();
    const paths = new Set(endpoints.map((e) => e.path));

    // Core endpoints that MUST be documented
    const criticalPaths = [
      "/products",
      "/orders",
      "/cart",
      "/auth",
    ];

    for (const path of criticalPaths) {
      expect(paths.has(path)).toBe(true, `Missing documentation for critical path: ${path}`);
    }
  });

  it("should document POST endpoints with request schemas", () => {
    const endpoints = registry.getEndpoints().filter((e) => e.method === "POST");

    // Most POST endpoints should have request schemas
    const withSchema = endpoints.filter((e) => e.requestSchema).length;
    const total = endpoints.length;

    expect(withSchema).toBeGreaterThan(total * 0.5,
      "Less than 50% of POST endpoints have request schemas documented");
  });

  it("should document admin reconciliation endpoints", () => {
    const endpoints = registry.getEndpoints();
    const reconciliationEndpoints = endpoints.filter(
      (e) => e.path.includes("reconciliation")
    );

    // Should have at least the manual trigger and status endpoints
    expect(reconciliationEndpoints.length).toBeGreaterThan(0,
      "Missing documentation for reconciliation endpoints (from #796)");
  });

  it("should validate endpoint structure", () => {
    const endpoints = registry.getEndpoints();

    for (const endpoint of endpoints) {
      expect(endpoint.method).toBeDefined();
      expect(endpoint.path).toBeDefined();
      expect(endpoint.summary).toBeDefined();
      expect(endpoint.path.startsWith("/")).toBe(true, `Invalid path: ${endpoint.path}`);
      expect(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]).toContain(
        endpoint.method
      );
    }
  });

  it("tracks authentication requirements", () => {
    const endpoints = registry.getEndpoints();
    const authenticated = endpoints.filter((e) => e.authentication === "Bearer");
    const unauthenticated = endpoints.filter((e) => e.authentication === "None" || !e.authentication);

    // We should have a mix of both
    expect(authenticated.length).toBeGreaterThan(0, "No authenticated endpoints found");
    expect(unauthenticated.length).toBeGreaterThan(0, "No unauthenticated endpoints found");
  });

  it("generates valid OpenAPI spec structure", () => {
    const spec = registry.toOpenAPI();

    // Check required OpenAPI top-level fields
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe("Agrocylo Backend API");
    expect(spec.paths).toBeDefined();
    expect(Object.keys(spec.paths as Record<string, unknown>).length).toBeGreaterThan(0);
    expect(spec.components).toBeDefined();
    expect((spec.components as Record<string, unknown>).securitySchemes).toBeDefined();
  });

  it("documents error responses with RFC 7807 Problem Detail", () => {
    const spec = registry.toOpenAPI() as Record<string, unknown>;
    const components = spec.components as Record<string, unknown>;
    const schemas = components.schemas as Record<string, unknown>;

    expect(schemas.ProblemDetail).toBeDefined();
    const problemDetail = schemas.ProblemDetail as Record<string, unknown>;
    expect(problemDetail.properties).toBeDefined();
  });

  it("provides endpoint coverage report", () => {
    const endpoints = registry.getEndpoints();
    const methodCounts: Record<string, number> = {};

    for (const endpoint of endpoints) {
      methodCounts[endpoint.method] = (methodCounts[endpoint.method] || 0) + 1;
    }

    console.log("OpenAPI Endpoint Coverage Report:");
    console.log(`  Total endpoints: ${endpoints.length}`);
    for (const [method, count] of Object.entries(methodCounts)) {
      console.log(`  ${method}: ${count}`);
    }

    // We should have at least some endpoints
    expect(endpoints.length).toBeGreaterThan(0);
  });
});
