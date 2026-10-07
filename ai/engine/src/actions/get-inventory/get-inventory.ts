import type { Bot } from "mineflayer";
import { CARRIED_SLOT_COUNT, snapshotBotStatus, type InventoryStack } from "../../bot-data/index.js";
import { defineAction } from "../action.js";
import { equipmentSlots } from "../equip/equip.js";
import {
  GET_INVENTORY,
  GET_INVENTORY_DESCRIPTION,
  getInventoryAnnotations,
  getInventoryInputSchema,
  getInventoryResultSchema,
  parseGetInventoryRequest,
  type GetInventoryResult,
} from "./contract.js";

function totals(stacks: readonly InventoryStack[]) {
  const grouped = new Map<string, { name: string; count: number; slots: number[] }>();
  for (const stack of stacks) {
    const entry = grouped.get(stack.name) ?? { name: stack.name, count: 0, slots: [] };
    entry.count += stack.count;
    entry.slots.push(stack.slot);
    grouped.set(stack.name, entry);
  }
  return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function observe(bot: Bot): GetInventoryResult {
  const snapshot = snapshotBotStatus(bot);
  const carried = snapshot.inventory.filter((stack) => stack.location === "main" || stack.location === "hotbar");
  return {
    status: "succeeded",
    inventory: {
      usedSlots: carried.length,
      freeSlots: CARRIED_SLOT_COUNT - carried.length,
      stacks: [...snapshot.inventory],
      totals: totals(snapshot.inventory),
      equipment: equipmentSlots(bot),
    },
  };
}

export function formatGetInventoryResult(result: GetInventoryResult): string {
  const { inventory } = result;
  const totalsText = inventory.totals.length
    ? inventory.totals.map((item) => `${item.name} x${item.count} (${item.slots.join(", ")})`).join("; ")
    : "empty";
  const equipment = inventory.equipment;
  return [
    `Inventory slots: ${inventory.usedSlots} used, ${inventory.freeSlots} free.`,
    `Totals: ${totalsText}.`,
    `Equipment: hand \`${equipment.hand ?? "nothing"}\`, off-hand \`${equipment.offHand ?? "nothing"}\`, head \`${equipment.head ?? "-"}\`, torso \`${equipment.torso ?? "-"}\`, legs \`${equipment.legs ?? "-"}\`, feet \`${equipment.feet ?? "-"}\`.`,
  ].join("\n");
}

export function createGetInventoryAction(bot: Bot) {
  return defineAction({
    name: GET_INVENTORY,
    description: GET_INVENTORY_DESCRIPTION,
    inputSchema: getInventoryInputSchema,
    resultSchema: getInventoryResultSchema,
    formatResult: formatGetInventoryResult,
    execution: { kind: "information" },
    annotations: getInventoryAnnotations,
    parse: parseGetInventoryRequest,
    execute: () => Promise.resolve(observe(bot)),
  });
}

