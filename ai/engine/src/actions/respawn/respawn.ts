import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  RESPAWN,
  RESPAWN_DESCRIPTION,
  parseRespawnRequest,
  respawnAnnotations,
  respawnInputSchema,
  respawnResultSchema,
  type RespawnRequest,
  type RespawnResult,
} from "./contract.js";

function alive(bot: Bot): boolean {
  return Reflect.get(bot, "isAlive") === true;
}

async function run(bot: Bot, request: RespawnRequest, signal?: AbortSignal): Promise<RespawnResult> {
  const aliveBefore = alive(bot);
  const healthBefore = bot.health ?? 0;
  let requested = false;
  if (!aliveBefore || healthBefore <= 0) {
    bot.respawn();
    requested = true;
  }
  let waitedTicks = 0;
  for (; waitedTicks < request.wait_ticks; waitedTicks += 1) {
    signal?.throwIfAborted();
    if (alive(bot) && (bot.health ?? 0) > 0) break;
    await bot.waitForTicks(1);
  }
  const evidence = {
    aliveBefore,
    healthBefore,
    aliveAfter: alive(bot),
    healthAfter: bot.health ?? 0,
    waitedTicks,
    requested,
  };
  return evidence.aliveAfter && evidence.healthAfter > 0
    ? { status: "succeeded", respawn: evidence }
    : { status: "failed", error: "[RESPAWN_NOT_CONFIRMED] Alive health was not observed after respawn request.", respawn: evidence };
}

export function formatRespawnResult(result: RespawnResult): string {
  const { respawn } = result;
  return `${respawn.requested ? "Requested respawn" : "Respawn not needed"}. Alive ${respawn.aliveBefore ? "yes" : "no"} -> ${respawn.aliveAfter ? "yes" : "no"}; health ${respawn.healthBefore} -> ${respawn.healthAfter}; waited ${respawn.waitedTicks} ticks.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createRespawnAction(bot: Bot) {
  return defineAction({
    name: RESPAWN,
    description: RESPAWN_DESCRIPTION,
    inputSchema: respawnInputSchema,
    resultSchema: respawnResultSchema,
    formatResult: formatRespawnResult,
    execution: { kind: "task" },
    annotations: respawnAnnotations,
    parse: parseRespawnRequest,
    execute: (request, context) => run(bot, request, context.signal),
  });
}
