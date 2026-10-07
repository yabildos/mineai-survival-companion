import type { Bot } from "mineflayer";
import { snapshotTools } from "../../world/tool-tiers.js";
import { defineAction } from "../action.js";
import { inventoryCounts } from "../collect-block/collection-facts.js";
import {
  LOADOUT_MANAGER,
  LOADOUT_MANAGER_DESCRIPTION,
  loadoutManagerAnnotations,
  loadoutManagerInputSchema,
  loadoutManagerResultSchema,
  parseLoadoutManagerRequest,
  type LoadoutManagerRequest,
  type LoadoutManagerResult,
} from "./contract.js";

const FOODS = ["bread", "cooked_beef", "cooked_porkchop", "cooked_chicken", "baked_potato", "golden_carrot", "apple"];
const BLOCKS = ["cobblestone", "cobbled_deepslate", "dirt", "netherrack", "stone"];
const JUNK = ["rotten_flesh", "poisonous_potato", "granite", "diorite", "andesite", "gravel"];

function sum(counts: Record<string, number>, names: readonly string[]): number {
  return names.reduce((total, name) => total + (counts[name] ?? 0), 0);
}

function hasAny(counts: Record<string, number>, names: readonly string[]): boolean {
  return sum(counts, names) > 0;
}

function run(bot: Bot, request: LoadoutManagerRequest): LoadoutManagerResult {
  const counts = inventoryCounts(bot);
  const tools = snapshotTools(bot);
  const pickaxe = tools.tools.find((tool) => tool.class === "pickaxe");
  const axe = tools.tools.find((tool) => tool.class === "axe");
  const sword = tools.tools.find((tool) => tool.class === "sword");
  const missing: string[] = [];
  const warnings: string[] = [];
  const extras: string[] = [];
  const suggestedActions: string[] = [];
  const freeSlots = bot.inventory.emptySlotCount();

  const requireFood = (n: number) => { if (sum(counts, FOODS) < n) missing.push(`food x${n}`); };
  const requireBlocks = (n: number) => { if (sum(counts, BLOCKS) < n) missing.push(`escape/scaffold blocks x${n}`); };
  if (request.profile === "mining") {
    if (!pickaxe?.item) missing.push("pickaxe");
    else if (pickaxe.durabilityLeft !== null && pickaxe.durabilityLeft < 64) warnings.push(`${pickaxe.item} durability below 64`);
    requireFood(4); requireBlocks(32);
    if (!hasAny(counts, ["water_bucket"])) warnings.push("no water bucket");
    if (freeSlots < 5) warnings.push("fewer than 5 free slots");
    suggestedActions.push("Use mining_assistant inspect_loadout, prospect_ore/cheat_radar, then safe_mine_batch.");
  } else if (request.profile === "woodcutting") {
    if (!axe?.item || !["iron", "diamond", "netherite"].includes(axe.tier)) missing.push("iron/diamond/netherite axe");
    requireFood(2);
    if (freeSlots < 6) warnings.push("fewer than 6 free slots for logs/saplings");
    suggestedActions.push("Use fell_tree, not collect_block on only lower logs.");
  } else if (request.profile === "combat") {
    if (!sword?.item) missing.push("weapon");
    if ((counts.shield ?? 0) === 0 && bot.inventory.slots[45]?.name !== "shield") missing.push("shield");
    requireFood(6);
    suggestedActions.push("Use guard_player or hunt_mob after equipping weapon/shield.");
  } else if (request.profile === "travel") {
    requireFood(6); requireBlocks(32);
    if (!hasAny(counts, ["boat", "oak_boat", "spruce_boat"])) warnings.push("no boat");
    suggestedActions.push("Save important places with waypoint before long travel.");
  } else {
    if (freeSlots < 8) warnings.push("fewer than 8 free slots for base work");
    suggestedActions.push("Use use_container inspect before withdrawals and move_slot for exact inventory cleanup.");
  }
  if (request.strict) for (const name of JUNK) if ((counts[name] ?? 0) > 0) extras.push(name);
  for (const name of extras) suggestedActions.push(`Consider drop_item in_a_hole or use_container deposit for ${name}.`);
  const ready = missing.length === 0 && warnings.length === 0;
  const loadout = { profile: request.profile, ready, freeSlots, missing, warnings, extras, suggestedActions };
  return ready
    ? { status: "succeeded", loadout }
    : { status: "partial", error: [...missing, ...warnings].join("; ") || "loadout has warnings", loadout };
}

export function formatLoadoutManagerResult(result: LoadoutManagerResult): string {
  const l = result.loadout;
  return `Loadout ${l.profile}: ${l.ready ? "ready" : "not ready"}; free slots ${l.freeSlots}.\nMissing: ${l.missing.join(", ") || "none"}.\nWarnings: ${l.warnings.join(", ") || "none"}.\nExtras: ${l.extras.join(", ") || "none"}.\nActions: ${l.suggestedActions.join(" ")}`;
}

export function createLoadoutManagerAction(bot: Bot) {
  return defineAction({
    name: LOADOUT_MANAGER,
    description: LOADOUT_MANAGER_DESCRIPTION,
    inputSchema: loadoutManagerInputSchema,
    resultSchema: loadoutManagerResultSchema,
    formatResult: formatLoadoutManagerResult,
    execution: { kind: "information" },
    annotations: loadoutManagerAnnotations,
    parse: parseLoadoutManagerRequest,
    execute: async (request) => run(bot, request),
  });
}
