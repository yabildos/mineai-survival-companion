import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  MOVE_SLOT,
  MOVE_SLOT_DESCRIPTION,
  moveSlotAnnotations,
  moveSlotInputSchema,
  moveSlotResultSchema,
  parseMoveSlotRequest,
  type MoveSlotRequest,
  type MoveSlotResult,
} from "./contract.js";

function slotName(bot: Bot, slot: number): string | null {
  return (bot.currentWindow ?? bot.inventory).slots[slot]?.name ?? null;
}

async function run(bot: Bot, request: MoveSlotRequest): Promise<MoveSlotResult> {
  if (bot.currentWindow && !request.allow_window) {
    return {
      status: "failed",
      error: "[WINDOW_OPEN] Close the current window or pass allow_window=true to move window slots.",
      move: { fromSlot: request.from_slot, toSlot: request.to_slot, itemBefore: slotName(bot, request.from_slot), fromAfter: slotName(bot, request.from_slot), toAfter: slotName(bot, request.to_slot) },
    };
  }
  const itemBefore = slotName(bot, request.from_slot);
  if (!itemBefore) {
    return {
      status: "failed",
      error: `[MOVE_SLOT_EMPTY] Slot ${request.from_slot} is empty.`,
      move: { fromSlot: request.from_slot, toSlot: request.to_slot, itemBefore: null, fromAfter: null, toAfter: slotName(bot, request.to_slot) },
    };
  }
  try {
    await bot.moveSlotItem(request.from_slot, request.to_slot);
  } catch (cause) {
    return {
      status: "failed",
      error: `[MOVE_SLOT_FAILED] ${cause instanceof Error ? cause.message : String(cause)}`,
      move: { fromSlot: request.from_slot, toSlot: request.to_slot, itemBefore, fromAfter: slotName(bot, request.from_slot), toAfter: slotName(bot, request.to_slot) },
    };
  }
  return {
    status: "succeeded",
    move: { fromSlot: request.from_slot, toSlot: request.to_slot, itemBefore, fromAfter: slotName(bot, request.from_slot), toAfter: slotName(bot, request.to_slot) },
  };
}

export function formatMoveSlotResult(result: MoveSlotResult): string {
  const m = result.move;
  return `Move slot ${m.fromSlot} -> ${m.toSlot}: ${result.status}. Before: ${m.itemBefore ?? "empty"}; from now ${m.fromAfter ?? "empty"}; to now ${m.toAfter ?? "empty"}${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createMoveSlotAction(bot: Bot) {
  return defineAction({
    name: MOVE_SLOT,
    description: MOVE_SLOT_DESCRIPTION,
    inputSchema: moveSlotInputSchema,
    resultSchema: moveSlotResultSchema,
    formatResult: formatMoveSlotResult,
    execution: { kind: "task" },
    annotations: moveSlotAnnotations,
    parse: parseMoveSlotRequest,
    execute: (request) => run(bot, request),
  });
}
