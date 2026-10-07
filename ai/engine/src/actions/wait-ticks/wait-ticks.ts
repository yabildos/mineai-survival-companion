import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  WAIT_TICKS,
  WAIT_TICKS_DESCRIPTION,
  parseWaitTicksRequest,
  waitTicksAnnotations,
  waitTicksInputSchema,
  waitTicksResultSchema,
  type WaitTicksRequest,
  type WaitTicksResult,
} from "./contract.js";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function snapshot(bot: Bot) {
  const position = bot.entity.position;
  return {
    health: round(bot.health ?? 0, 1),
    food: bot.food ?? 0,
    saturation: round(bot.foodSaturation ?? 0, 1),
    position: { x: round(position.x), y: round(position.y), z: round(position.z) },
    dimension: bot.game.dimension,
    timeOfDay: bot.time.timeOfDay,
  };
}

async function wait(bot: Bot, request: WaitTicksRequest, signal?: AbortSignal): Promise<WaitTicksResult> {
  const before = snapshot(bot);
  for (let remaining = request.ticks; remaining > 0; remaining -= 1) {
    signal?.throwIfAborted();
    await bot.waitForTicks(1);
  }
  signal?.throwIfAborted();
  return { status: "succeeded", wait: { requestedTicks: request.ticks, before, after: snapshot(bot) } };
}

export function formatWaitTicksResult(result: WaitTicksResult): string {
  const { wait } = result;
  return [
    `Waited ${wait.requestedTicks} tick${wait.requestedTicks === 1 ? "" : "s"}.`,
    `Health ${wait.before.health} -> ${wait.after.health}; food ${wait.before.food} -> ${wait.after.food}; saturation ${wait.before.saturation} -> ${wait.after.saturation}.`,
    `Position ${wait.before.position.x}, ${wait.before.position.y}, ${wait.before.position.z} -> ${wait.after.position.x}, ${wait.after.position.y}, ${wait.after.position.z}; time ${wait.before.timeOfDay} -> ${wait.after.timeOfDay}.`,
  ].join("\n");
}

export function createWaitTicksAction(bot: Bot) {
  return defineAction({
    name: WAIT_TICKS,
    description: WAIT_TICKS_DESCRIPTION,
    inputSchema: waitTicksInputSchema,
    resultSchema: waitTicksResultSchema,
    formatResult: formatWaitTicksResult,
    execution: { kind: "task" },
    annotations: waitTicksAnnotations,
    parse: parseWaitTicksRequest,
    execute: (request, context) => wait(bot, request, context.signal),
  });
}

