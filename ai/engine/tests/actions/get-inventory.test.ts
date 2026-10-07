import { describe, expect, test } from "bun:test";
import {
  formatGetInventoryResult,
  parseGetInventoryRequest,
  type GetInventoryResult,
} from "../../src/actions/get-inventory/index.js";

describe("get_inventory", () => {
  test("accepts an empty request", () => {
    expect(parseGetInventoryRequest({})).toEqual({});
    expect(parseGetInventoryRequest(undefined)).toEqual({});
  });

  test("rejects unexpected input", () => {
    expect(() => parseGetInventoryRequest({ item_name: "diamond" })).toThrow();
  });

  test("formats inventory totals and equipment", () => {
    const result: GetInventoryResult = {
      status: "succeeded",
      inventory: {
        usedSlots: 2,
        freeSlots: 34,
        stacks: [
          { slot: 36, location: "hotbar", name: "diamond_sword", count: 1, held: true, durability: null },
          { slot: 10, location: "main", name: "cooked_beef", count: 12, held: false, durability: null },
        ],
        totals: [
          { name: "cooked_beef", count: 12, slots: [10] },
          { name: "diamond_sword", count: 1, slots: [36] },
        ],
        equipment: {
          hand: "diamond_sword",
          offHand: "shield",
          head: "diamond_helmet",
          torso: "diamond_chestplate",
          legs: "diamond_leggings",
          feet: "diamond_boots",
        },
      },
    };

    expect(formatGetInventoryResult(result)).toContain("Inventory slots: 2 used, 34 free.");
    expect(formatGetInventoryResult(result)).toContain("cooked_beef x12 (10)");
    expect(formatGetInventoryResult(result)).toContain("off-hand `shield`");
  });
});

