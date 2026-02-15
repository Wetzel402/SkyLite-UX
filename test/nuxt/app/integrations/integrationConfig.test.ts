import { describe, it, expect } from "vitest";

import type { ShoppingListItem } from "~/types/database";

import {
  getIntegrationFields,
  getFieldsForItem,
  getServiceFactories,
} from "../../../../app/integrations/integrationConfig";

describe("integrationConfig", () => {
  describe("getIntegrationFields", () => {
    it("returns dialogFields for known service", () => {
      const fields = getIntegrationFields("iCal");
      expect(Array.isArray(fields)).toBe(true);
    });

    it("returns empty array for unknown service", () => {
      const fields = getIntegrationFields("unknown");
      expect(fields).toEqual([]);
    });
  });

  describe("getFieldsForItem", () => {
    const allFields = [{ key: "a" }, { key: "b" }];

    it("returns allFields when integrationType is undefined", () => {
      expect(getFieldsForItem(null, undefined, allFields)).toEqual(allFields);
    });

    it("returns allFields when integrationType has no filter", () => {
      expect(getFieldsForItem(null, "iCal", allFields)).toEqual(allFields);
    });

    it("returns filtered array for mealie when item is null", () => {
      const fields = [
        { key: "notes" },
        { key: "quantity" },
        { key: "unit" },
        { key: "food" },
      ];
      const result = getFieldsForItem(null, "mealie", fields);
      expect(Array.isArray(result)).toBe(true);
      expect(result.map(f => f.key)).toEqual(["notes", "quantity"]);
    });

    it("returns filtered array for mealie when item has isFood true", () => {
      const fields = [
        { key: "notes" },
        { key: "quantity" },
        { key: "unit" },
        { key: "food" },
      ];
      const item: ShoppingListItem = {
        id: "x",
        name: "",
        checked: false,
        order: 0,
        notes: null,
        quantity: 0,
        unit: null,
        label: null,
        food: null,
        integrationData: { isFood: true },
      };
      const result = getFieldsForItem(item, "mealie", fields);
      expect(Array.isArray(result)).toBe(true);
      expect(result.map(f => f.key)).toEqual([
        "notes",
        "quantity",
        "unit",
        "food",
      ]);
    });

    it("returns filtered array for tandoor when item is null", () => {
      const fields = [{ key: "notes" }, { key: "quantity" }, { key: "unit" }];
      const result = getFieldsForItem(null, "tandoor", fields);
      expect(Array.isArray(result)).toBe(true);
      expect(result.map(f => f.key)).toEqual(["notes", "quantity"]);
    });
  });

  describe("getServiceFactories", () => {
    it("returns factory entries for each integration config", () => {
      const factories = getServiceFactories();
      expect(Array.isArray(factories)).toBe(true);
      expect(factories.length).toBeGreaterThan(0);
      for (const f of factories) {
        expect(f).toHaveProperty("key");
        expect(f).toHaveProperty("factory");
        expect(typeof f.key).toBe("string");
        expect(typeof f.factory).toBe("function");
      }
    });

    it("includes calendar and shopping keys", () => {
      const keys = getServiceFactories().map(f => f.key);
      expect(keys).toContain("calendar:iCal");
      expect(keys).toContain("calendar:google");
      expect(keys).toContain("shopping:mealie");
      expect(keys).toContain("shopping:tandoor");
    });
  });
});
