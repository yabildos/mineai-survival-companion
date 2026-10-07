import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import type { NavigationRuntime } from "../../navigation/index.js";
import { createMovements, exactBlockGoal } from "../../navigation/index.js";
import { snapshotTools } from "../../world/tool-tiers.js";
import { defineAction, type ActionContext } from "../action.js";
import { collectBlock } from "../collect-block/collect-block.js";
import { blockMatchesSelector, inventoryCounts } from "../collect-block/collection-facts.js";
import type { DiscardedItems } from "../../world/discarded-items.js";
import {
  MINING_ASSISTANT,
  MINING_ASSISTANT_DESCRIPTION,
  miningAssistantAnnotations,
  miningAssistantInputSchema,
  miningAssistantResultSchema,
  parseMiningAssistantRequest,
  type MiningAssistantRequest,
  type MiningAssistantResult,
} from "./contract.js";

const FOOD_NAMES = new Set(["bread", "cooked_beef", "cooked_porkchop", "cooked_chicken", "cooked_mutton", "baked_potato", "carrot", "apple", "golden_carrot"]);
const BLOCK_NAMES = new Set(["cobblestone", "cobbled_deepslate", "dirt", "netherrack", "basalt", "stone"]);

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function supplies(bot: Bot): Record<string, number> {
  const counts = inventoryCounts(bot);
  return Object.fromEntries(Object.entries(counts).filter(([name]) => FOOD_NAMES.has(name) || BLOCK_NAMES.has(name) || name.includes("torch") || name.endsWith("_pickaxe") || name === "water_bucket"));
}

function readiness(bot: Bot, request: MiningAssistantRequest): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const tools = snapshotTools(bot);
  const pickaxe = tools.tools.find((tool) => tool.class === "pickaxe");
  const counts = inventoryCounts(bot);
  const freeSlots = bot.inventory.emptySlotCount();
  if (!pickaxe?.item) blockers.push("no pickaxe carried");
  if (pickaxe?.durabilityLeft !== null && pickaxe?.durabilityLeft !== undefined && pickaxe.durabilityLeft < request.count + request.minPickaxeDurabilityReserve)
    blockers.push(`${pickaxe.item} durability ${pickaxe.durabilityLeft} is below requested batch plus reserve`);
  if (request.blockName && blockMatchesSelector("diamond_ore", request.blockName) && !["iron", "diamond", "netherite"].includes(pickaxe?.tier ?? "none"))
    blockers.push("diamond ore requires an iron, diamond, or netherite pickaxe");
  if (request.requireFood && !Object.entries(counts).some(([name, count]) => FOOD_NAMES.has(name) && count > 0)) blockers.push("no carried food");
  if (request.requireBlocks && !Object.entries(counts).some(([name, count]) => BLOCK_NAMES.has(name) && count >= 16)) blockers.push("fewer than 16 carried scaffold/escape blocks");
  if (freeSlots < 2) blockers.push("fewer than 2 free inventory slots");
  return { ready: blockers.length === 0, blockers };
}

function passable(bot: Bot, position: Vec3): boolean {
  const block = bot.blockAt(position);
  return !!block && block.boundingBox === "empty" && block.name !== "lava";
}

function standable(bot: Bot, feet: Vec3): boolean {
  const floor = bot.blockAt(feet.offset(0, -1, 0));
  return passable(bot, feet) && passable(bot, feet.offset(0, 1, 0)) && !!floor && floor.boundingBox === "block" && floor.name !== "magma_block";
}

function loadedExitAbove(bot: Bot): Vec3 | null {
  const here = bot.entity.position.floored();
  for (let y = here.y + 1; y <= Math.min(320, here.y + 96); y += 1) {
    const feet = new Vec3(here.x, y, here.z);
    if (standable(bot, feet)) return feet;
  }
  return null;
}

function evidence(bot: Bot, request: MiningAssistantRequest, ready: boolean, blockers: string[], action: string): MiningAssistantResult["mining"] {
  return {
    operation: request.operation,
    dimension: String(bot.game.dimension),
    position: { x: round(bot.entity.position.x), y: round(bot.entity.position.y), z: round(bot.entity.position.z) },
    freeSlots: bot.inventory.emptySlotCount(),
    foodPoints: bot.food,
    health: bot.health,
    tools: snapshotTools(bot),
    supplies: supplies(bot),
    ready,
    blockers,
    action,
  };
}

function succeeded(bot: Bot, request: MiningAssistantRequest, ready: boolean, blockers: string[], action: string): MiningAssistantResult {
  return { status: "succeeded", mining: evidence(bot, request, ready, blockers, action) };
}

function failed(bot: Bot, request: MiningAssistantRequest, ready: boolean, blockers: string[], action: string, error?: string): MiningAssistantResult {
  return { status: "failed", error: error ?? (blockers.join("; ") || "not ready"), mining: evidence(bot, request, ready, blockers, action) };
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  discarded: DiscardedItems,
  request: MiningAssistantRequest,
  context: ActionContext,
): Promise<MiningAssistantResult> {
  const state = readiness(bot, request);
  if (request.operation === "inspect_loadout")
    return state.ready
      ? succeeded(bot, request, true, [], "inspected mining loadout")
      : failed(bot, request, false, state.blockers, "inspected mining loadout");
  if (request.operation === "safe_mine_batch") {
    if (!state.ready) return failed(bot, request, false, state.blockers, "refused unsafe mining batch");
    const mined = await collectBlock(bot, navigation, {
      selector: request.blockName!,
      requested: Math.min(32, request.count),
      exactTarget: null,
      scaffolding: true,
      allowFullInventory: false,
      onToolLoss: "stop",
    }, context, discarded);
    const action = `safe batch ${request.blockName} x${request.count}: ${mined.status}; gained ${mined.collected.gained}/${mined.collected.requested}`;
    if (mined.status === "succeeded") return succeeded(bot, request, true, [], action);
    const error = "error" in mined ? mined.error : "batch incomplete";
    if (mined.status === "partial") return { status: "partial", error, mining: evidence(bot, request, false, [error], action) };
    if (mined.status === "cancelled") return { status: "cancelled", error, mining: evidence(bot, request, false, [error], action) };
    return failed(bot, request, false, [error], action, error);
  }
  const exit = loadedExitAbove(bot);
  if (!exit) return failed(bot, request, false, ["no loaded standable exit found above current column"], "return_to_surface could not find loaded upper footing");
  const result = await navigation.navigate({
    goal: exactBlockGoal({ x: exit.x, y: exit.y, z: exit.z }),
    movements: createMovements(bot, { allowDigging: true, scaffolding: true }),
    signal: context.signal,
  });
  const ok = result.status === "completed";
  return ok
    ? succeeded(bot, request, true, [], `navigated toward loaded upper exit ${exit.x},${exit.y},${exit.z}: ${result.status}`)
    : failed(bot, request, false, [`navigation ${result.status}`], `navigated toward loaded upper exit ${exit.x},${exit.y},${exit.z}: ${result.status}`, `navigation ${result.status}`);
}

export function formatMiningAssistantResult(result: MiningAssistantResult): string {
  const m = result.mining;
  return [
    `Mining assistant ${m.operation}: ${result.status}. ${m.action}`,
    `Position ${m.position.x}, ${m.position.y}, ${m.position.z} in ${m.dimension}; health ${m.health}, food ${m.foodPoints}, free slots ${m.freeSlots}.`,
    `Ready: ${m.ready}; blockers: ${m.blockers.join("; ") || "none"}.`,
  ].join("\n");
}

export function createMiningAssistantAction(bot: Bot, navigation: NavigationRuntime, discarded: DiscardedItems) {
  return defineAction({
    name: MINING_ASSISTANT,
    description: MINING_ASSISTANT_DESCRIPTION,
    inputSchema: miningAssistantInputSchema,
    resultSchema: miningAssistantResultSchema,
    formatResult: formatMiningAssistantResult,
    execution: { kind: "task" },
    annotations: miningAssistantAnnotations,
    parse: parseMiningAssistantRequest,
    execute: (request, context) => run(bot, navigation, discarded, request, context),
  });
}
