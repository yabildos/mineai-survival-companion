import { describe, expect, test } from "bun:test";
import { inferEquipmentDestination, parseEquipRequest } from "../../src/actions/equip/index.js";

describe("equip contract", () => {
  test("infers conventional equipment destinations", () => {
    expect(inferEquipmentDestination("diamond_helmet")).toBe("head");
    expect(inferEquipmentDestination("elytra")).toBe("torso");
    expect(inferEquipmentDestination("diamond_leggings")).toBe("legs");
    expect(inferEquipmentDestination("golden_boots")).toBe("feet");
    expect(inferEquipmentDestination("shield")).toBe("off-hand");
    expect(inferEquipmentDestination("diamond_sword")).toBe("hand");
  });

  test("normalizes parsed requests", () => {
    expect(parseEquipRequest({ items: [{ item_name: "shield" }] })).toEqual({
      items: [{ itemName: "shield", destination: "off-hand" }],
    });
    expect(parseEquipRequest({ items: [{ item_name: "bow", destination: "hand", source_slot: 36 }] })).toEqual({
      items: [{ itemName: "bow", destination: "hand", sourceSlot: 36 }],
    });
  });
});
