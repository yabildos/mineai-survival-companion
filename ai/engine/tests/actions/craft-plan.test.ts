import { describe, expect, test } from "bun:test";
import { planCraftingFromInventory } from "../../src/utils/craft-plan.js";

type RecipeItem = { id: number; count: number };
type Recipe = {
  result: RecipeItem;
  delta: RecipeItem[];
  requiresTable: boolean;
};

function fakeBot(recipes: Map<number, Recipe[]>, inventory: RecipeItem[] = []) {
  const names = new Map([
    [1, "wheat"],
    [2, "bread"],
    [3, "hay_block"],
    [4, "oak_planks"],
    [5, "iron_ingot"],
    [6, "shield"],
  ]);
  return {
    registry: {
      items: Object.fromEntries([...names].map(([id, name]) => [id, { id, name }])),
    },
    inventory: {
      items: () => inventory.map((item) => ({ type: item.id, count: item.count })),
    },
    recipesAll: (id: number) => recipes.get(id) ?? [],
  } as any;
}

describe("craft planner", () => {
  test("reports cyclic recipe ingredients as missing leaves", () => {
    const recipes = new Map<number, Recipe[]>([
      [2, [{ result: { id: 2, count: 1 }, delta: [{ id: 1, count: -3 }, { id: 2, count: 1 }], requiresTable: true }]],
      [1, [{ result: { id: 1, count: 9 }, delta: [{ id: 3, count: -1 }, { id: 1, count: 9 }], requiresTable: false }]],
      [3, [{ result: { id: 3, count: 1 }, delta: [{ id: 1, count: -9 }, { id: 3, count: 1 }], requiresTable: true }]],
    ]);

    const plan = planCraftingFromInventory(fakeBot(recipes), [{ id: 2, name: "bread", count: 1 }]);

    expect(plan.kind).toBe("missing_materials");
    expect(plan.plan.missingMaterials.length).toBeGreaterThan(0);
    expect(plan.plan.missingMaterials).not.toContainEqual({ item: "bread", count: 1 });
  });

  test("keeps normal recursive recipes available when leaves exist", () => {
    const recipes = new Map<number, Recipe[]>([
      [6, [{ result: { id: 6, count: 1 }, delta: [{ id: 4, count: -6 }, { id: 5, count: -1 }, { id: 6, count: 1 }], requiresTable: true }]],
    ]);

    const plan = planCraftingFromInventory(fakeBot(recipes, [{ id: 4, count: 6 }, { id: 5, count: 1 }]), [
      { id: 6, name: "shield", count: 1 },
    ]);

    expect(plan.kind).toBe("ready");
    expect(plan.plan.carriedMaterials).toEqual([{ item: "iron_ingot", count: 1 }, { item: "oak_planks", count: 6 }]);
  });
});
