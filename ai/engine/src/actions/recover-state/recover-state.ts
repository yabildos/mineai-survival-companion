import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  RECOVER_STATE,
  RECOVER_STATE_DESCRIPTION,
  parseRecoverStateRequest,
  recoverStateAnnotations,
  recoverStateInputSchema,
  recoverStateResultSchema,
  type RecoverStateRequest,
  type RecoverStateResult,
} from "./contract.js";

function alive(bot: Bot): boolean {
  return Reflect.get(bot, "isAlive") === true && (bot.health ?? 0) > 0;
}

function freeSlots(bot: Bot): number {
  return bot.inventory.emptySlotCount();
}

async function run(bot: Bot, request: RecoverStateRequest, signal?: AbortSignal): Promise<RecoverStateResult> {
  const aliveBefore = alive(bot);
  let respawnRequested = false;
  if (!aliveBefore) {
    bot.respawn();
    respawnRequested = true;
  }
  let windowClosed = false;
  if (bot.currentWindow) {
    await bot.closeWindow(bot.currentWindow);
    windowClosed = true;
  }
  let waitedTicks = 0;
  for (; waitedTicks < request.wait_ticks; waitedTicks += 1) {
    signal?.throwIfAborted();
    await bot.waitForTicks(1);
  }
  const position = bot.entity.position;
  const evidence = {
    aliveBefore,
    aliveAfter: alive(bot),
    respawnRequested,
    windowClosed,
    health: bot.health ?? 0,
    food: bot.food ?? 0,
    position: { x: Number(position.x.toFixed(2)), y: Number(position.y.toFixed(2)), z: Number(position.z.toFixed(2)) },
    dimension: bot.game.dimension,
    inventoryItems: bot.inventory.items().reduce((sum, item) => sum + item.count, 0),
    freeSlots: freeSlots(bot),
    waitedTicks,
  };
  return evidence.aliveAfter
    ? { status: "succeeded", recovery: evidence }
    : { status: "failed", error: "[RECOVERY_NOT_ALIVE] Bot is still not alive after recovery.", recovery: evidence };
}

export function formatRecoverStateResult(result: RecoverStateResult): string {
  const r = result.recovery;
  return [
    `Recovery ${result.status}. Alive ${r.aliveBefore ? "yes" : "no"} -> ${r.aliveAfter ? "yes" : "no"}; respawn ${r.respawnRequested ? "requested" : "not needed"}; window ${r.windowClosed ? "closed" : "not open"}.`,
    `Health ${r.health}; food ${r.food}; position ${r.position.x}, ${r.position.y}, ${r.position.z} in ${r.dimension}.`,
    `Inventory items ${r.inventoryItems}; free slots ${r.freeSlots}; waited ${r.waitedTicks} ticks.`,
    ...(result.status === "succeeded" ? [] : [`Observed stop: ${result.error}`]),
  ].join("\n");
}

export function createRecoverStateAction(bot: Bot) {
  return defineAction({
    name: RECOVER_STATE,
    description: RECOVER_STATE_DESCRIPTION,
    inputSchema: recoverStateInputSchema,
    resultSchema: recoverStateResultSchema,
    formatResult: formatRecoverStateResult,
    execution: { kind: "task" },
    annotations: recoverStateAnnotations,
    parse: parseRecoverStateRequest,
    execute: (request, context) => run(bot, request, context.signal),
  });
}
