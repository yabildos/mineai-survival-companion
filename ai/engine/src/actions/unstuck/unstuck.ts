import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  UNSTUCK,
  UNSTUCK_DESCRIPTION,
  parseUnstuckRequest,
  unstuckAnnotations,
  unstuckInputSchema,
  unstuckResultSchema,
  type UnstuckRequest,
  type UnstuckResult,
} from "./contract.js";

function pos(bot: Bot) {
  const p = bot.entity.position;
  return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), z: Number(p.z.toFixed(2)) };
}

async function hold(bot: Bot, controls: string[], ticks: number, signal?: AbortSignal): Promise<void> {
  for (const control of controls) bot.setControlState(control as any, true);
  try {
    for (let i = 0; i < ticks; i += 1) {
      signal?.throwIfAborted();
      await bot.waitForTicks(1);
    }
  } finally {
    for (const control of controls) bot.setControlState(control as any, false);
  }
}

async function run(bot: Bot, request: UnstuckRequest, signal?: AbortSignal): Promise<UnstuckResult> {
  const startVector = bot.entity.position.clone();
  const start = pos(bot);
  let windowClosed = false;
  if (bot.currentWindow) {
    await bot.closeWindow(bot.currentWindow);
    windowClosed = true;
  }
  const patterns = [["jump"], ["back"], ["left"], ["right"], ["jump", "back"]];
  for (let i = 0; i < request.attempts; i += 1) {
    await hold(bot, patterns[i % patterns.length]!, 12, signal);
    await bot.waitForTicks(4);
  }
  const moved = Number(bot.entity.position.distanceTo(startVector).toFixed(2));
  const evidence = { attempts: request.attempts, start, end: pos(bot), moved, windowClosed };
  return moved >= 0.35
    ? { status: "succeeded", unstuck: evidence }
    : { status: "partial", error: "[UNSTUCK_LOW_MOVEMENT] Bot moved less than 0.35 blocks.", unstuck: evidence };
}

export function formatUnstuckResult(result: UnstuckResult): string {
  const u = result.unstuck;
  return `Unstuck ${result.status}: moved ${u.moved} blocks after ${u.attempts} attempts; window ${u.windowClosed ? "closed" : "not open"}. Start ${u.start.x},${u.start.y},${u.start.z}; end ${u.end.x},${u.end.y},${u.end.z}.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createUnstuckAction(bot: Bot) {
  return defineAction({
    name: UNSTUCK,
    description: UNSTUCK_DESCRIPTION,
    inputSchema: unstuckInputSchema,
    resultSchema: unstuckResultSchema,
    formatResult: formatUnstuckResult,
    execution: { kind: "task" },
    annotations: unstuckAnnotations,
    parse: parseUnstuckRequest,
    execute: (request, context) => run(bot, request, context.signal),
  });
}
