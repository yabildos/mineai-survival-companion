import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { defineAction } from "../action.js";
import {
  INSPECT_FURNACE,
  INSPECT_FURNACE_DESCRIPTION,
  inspectFurnaceAnnotations,
  inspectFurnaceInputSchema,
  inspectFurnaceResultSchema,
  parseInspectFurnaceRequest,
  type InspectFurnaceRequest,
  type InspectFurnaceResult,
} from "./contract.js";

function item(value: { name: string; count: number } | null | undefined) {
  return value ? { name: value.name, count: value.count } : null;
}

async function run(bot: Bot, request: InspectFurnaceRequest): Promise<InspectFurnaceResult> {
  const block = bot.blockAt(new Vec3(request.x, request.y, request.z));
  const base = { x: request.x, y: request.y, z: request.z, blockName: block?.name ?? null };
  if (!block) return { status: "failed", error: "[FURNACE_BLOCK_UNLOADED] Furnace cell is not loaded.", furnace: { ...base, input: null, fuel: null, output: null, cookProgress: null, fuelProgress: null, closed: bot.currentWindow === null } };
  if (block.name !== "furnace") return { status: "failed", error: `[FURNACE_NOT_PRESENT] ${block.name} is not a furnace.`, furnace: { ...base, input: null, fuel: null, output: null, cookProgress: null, fuelProgress: null, closed: bot.currentWindow === null } };
  let window: Awaited<ReturnType<Bot["openFurnace"]>> | null = null;
  try {
    window = await bot.openFurnace(block);
    const state = window as typeof window & { progress?: number | null; fuel?: number | null };
    const result: InspectFurnaceResult = {
      status: "succeeded",
      furnace: {
        ...base,
        input: item(window.inputItem()),
        fuel: item(window.fuelItem()),
        output: item(window.outputItem()),
        cookProgress: typeof state.progress === "number" ? state.progress : null,
        fuelProgress: typeof state.fuel === "number" ? state.fuel : null,
        closed: false,
      },
    };
    window.close();
    result.furnace.closed = bot.currentWindow === null;
    return result;
  } catch (cause) {
    if (window) window.close();
    return { status: "failed", error: `[FURNACE_OPEN_FAILED] ${cause instanceof Error ? cause.message : String(cause)}`, furnace: { ...base, input: null, fuel: null, output: null, cookProgress: null, fuelProgress: null, closed: bot.currentWindow === null } };
  }
}

export function formatInspectFurnaceResult(result: InspectFurnaceResult): string {
  const f = result.furnace;
  const show = (v: { name: string; count: number } | null) => (v ? `${v.name} x${v.count}` : "empty");
  return `Furnace ${f.x},${f.y},${f.z}: input ${show(f.input)}, fuel ${show(f.fuel)}, output ${show(f.output)}, cook ${f.cookProgress ?? "unknown"}, fuel progress ${f.fuelProgress ?? "unknown"}, closed ${f.closed ? "yes" : "no"}${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createInspectFurnaceAction(bot: Bot) {
  return defineAction({
    name: INSPECT_FURNACE,
    description: INSPECT_FURNACE_DESCRIPTION,
    inputSchema: inspectFurnaceInputSchema,
    resultSchema: inspectFurnaceResultSchema,
    formatResult: formatInspectFurnaceResult,
    execution: { kind: "information" },
    annotations: inspectFurnaceAnnotations,
    parse: parseInspectFurnaceRequest,
    execute: (request) => run(bot, request),
  });
}
