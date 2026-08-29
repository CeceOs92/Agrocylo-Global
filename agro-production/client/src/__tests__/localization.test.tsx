import { describe, it, expect } from "vitest";
import enMessages from "../locales/en/common.json";
import esMessages from "../locales/es/common.json";
import frMessages from "../locales/fr/common.json";

const locales = { en: enMessages, es: esMessages, fr: frMessages } as const;

function collectKeyPaths(obj: Record<string, unknown>, path = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return collectKeyPaths(value as Record<string, unknown>, currentPath);
    }
    return [currentPath];
  });
}

function collectEmptyValues(obj: Record<string, unknown>, path = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof value === "string") {
      return value.trim() === "" ? [currentPath] : [];
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return collectEmptyValues(value as Record<string, unknown>, currentPath);
    }
    return [];
  });
}

describe("Localization", () => {
  it("has all required sections in every locale", () => {
    for (const messages of Object.values(locales)) {
      expect(messages.navigation).toBeDefined();
      expect(messages.campaigns).toBeDefined();
      expect(messages.sso).toBeDefined();
      expect(messages.welcome).toBeDefined();
    }
  });

  it("has identical key sets across en/es/fr (CI guard against locale drift)", () => {
    const [enPaths, esPaths, frPaths] = Object.values(locales).map((m) =>
      collectKeyPaths(m).sort(),
    );
    expect(esPaths).toEqual(enPaths);
    expect(frPaths).toEqual(enPaths);
  });

  it("has no empty translation values in any locale", () => {
    for (const [locale, messages] of Object.entries(locales)) {
      expect(collectEmptyValues(messages), `empty values in ${locale}`).toEqual([]);
    }
  });
});
