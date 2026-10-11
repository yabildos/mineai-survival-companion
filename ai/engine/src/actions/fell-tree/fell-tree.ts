import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { createMovements, type NavigationRuntime } from "../../navigation/index.js";
import { createDiscardedItems, type DiscardedItems } from "../../world/discarded-items.js";
import { droppedItemName, pickupObservedItem } from "../../world/item-pickup.js";
import { defineAction, type ActionContext } from "../action.js";
import { collectBlock } from "../collect-block/collect-block.js";
import { craftItem } from "../craft-item/craft-item.js";
import { snapshotTools } from "../../world/tool-tiers.js";
import { inventoryCounts } from "../collect-block/collection-facts.js";
import {
  FELL_TREE,
  FELL_TREE_DESCRIPTION,
  fellTreeAnnotations,
  fellTreeInputSchema,
  fellTreeResultSchema,
  parseFellTreeRequest,
  type FellTreeRequest,
  type FellTreeResult,
} from "./contract.js";

function treeBlock(name: string, includeCaps: boolean): boolean {
  if (name.endsWith("_log") || name.endsWith("_stem") || name.endsWith("_wood") || name.endsWith("_hyphae")) return true;
  return includeCaps && (name === "mushroom_stem" || name === "red_mushroom_block" || name === "brown_mushroom_block");
}

function key(position: Vec3): string {
  return `${position.x},${position.y},${position.z}`;
}

const AXE_NAMES = ["wooden_axe", "stone_axe", "iron_axe", "diamond_axe", "netherite_axe"] as const;

async function prepareFellingAxe(
  bot: Bot,
  navigation: NavigationRuntime,
  discarded: DiscardedItems,
  context: ActionContext,
): Promise<string | null> {
  if (bot.inventory.items().some((item) => AXE_NAMES.includes(item.name as (typeof AXE_NAMES)[number]))) return null;

  const counts = inventoryCounts(bot);
  const itemName = (counts.diamond ?? 0) >= 3
    ? "diamond_axe"
    : (counts.iron_ingot ?? 0) >= 3
      ? "iron_axe"
      : (counts.cobblestone ?? 0) >= 3
        ? "stone_axe"
        : "wooden_axe";
  const carriedCount = (name: string) => inventoryCounts(bot)[name] ?? 0;
  const tableId = bot.registry.blocksByName.crafting_table?.id;
  const tableNearby = tableId !== undefined && bot.findBlock({ matching: tableId, maxDistance: 4 }) !== null;
  const needsTable = !tableNearby && carriedCount("crafting_table") === 0;
  const current = inventoryCounts(bot);
  const plankEquivalent = Object.entries(current).reduce((total, [name, count]) => {
    if (name.endsWith("_planks")) return total + count;
    if (name.endsWith("_log") || name.endsWith("_wood") || name.endsWith("_hyphae") || name === "crimson_stem" || name === "warped_stem")
      return total + count * 4;
    return total;
  }, 0);
  const axePlanks = itemName === "wooden_axe" ? 5 : 2;
  const planksNeeded = axePlanks + (needsTable ? 4 : 0);
  const logsNeeded = Math.ceil(Math.max(0, planksNeeded - plankEquivalent) / 4);
  if (logsNeeded > 0) {
    const gathered = await collectBlock(bot, navigation, {
      selector: "logs", requested: logsNeeded, exactTarget: null, scaffolding: false,
      allowFullInventory: false, onToolLoss: "stop",
    }, context, discarded);
    if (gathered.status !== "succeeded") return `[TREE_TOOL_PREP] Could not gather ${logsNeeded} logs for ${itemName}: ${gathered.error}`;
  }
  if (needsTable) {
    const table = await craftItem(bot, navigation, { items: [{ itemName: "crafting_table", count: 1 }] }, context);
    if (table.status !== "succeeded" || carriedCount("crafting_table") < 1) {
      return `[TREE_TOOL_PREP] Could not prepare a crafting table for ${itemName}: ${table.status === "succeeded" ? "item was not observed in inventory" : table.error}`;
    }
  }
  const crafted = await craftItem(bot, navigation, { items: [{ itemName, count: 1 }] }, context);
  if (crafted.status !== "succeeded" || !bot.inventory.items().some((item) => item.name === itemName)) {
    return `[TREE_TOOL_PREP] Could not prepare ${itemName}: ${crafted.status === "succeeded" ? "item was not observed in inventory" : crafted.error}`;
  }
  return null;
}

const NEIGHBOURS = [
  new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, -1, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1),
  new Vec3(1, 1, 0), new Vec3(-1, 1, 0), new Vec3(0, 1, 1), new Vec3(0, 1, -1),
];

function nearestSeed(bot: Bot, includeCaps: boolean): Vec3 | null {
  const origin = bot.entity.position;
  const positions = bot.findBlocks({
    matching: (block) => treeBlock(block.name, includeCaps),
    maxDistance: 48,
    count: 256,
  });
  // A nearest log can be at the crown, where navigation has to solve a route
  // onto foliage. Prefer trunk bases supported by ordinary terrain so the
  // first target belongs to a tree the lumberjack can approach from the ground.
  const bases = positions.filter((position) => {
    const below = bot.blockAt(position.offset(0, -1, 0));
    return below !== null && below.boundingBox === "block" && !treeBlock(below.name, includeCaps);
  });
  const candidates = bases.length > 0 ? bases : positions;
  candidates.sort((left, right) => {
    const score = (position: Vec3) => {
      const dx = position.x - origin.x;
      const dy = position.y - origin.y;
      const dz = position.z - origin.z;
      // Horizontal approach distance matters most; vertical offset still
      // breaks ties in favour of nearby, reachable trunks.
      return dx * dx + dz * dz + dy * dy * 2;
    };
    return score(left) - score(right);
  });
  return candidates[0] ?? null;
}

function cluster(bot: Bot, seed: Vec3, request: FellTreeRequest): Vec3[] {
  const seen = new Set<string>();
  const queue = [seed.floored()];
  const result: Vec3[] = [];
  while (queue.length > 0 && result.length < request.max_blocks) {
    const current = queue.shift()!;
    if (seen.has(key(current))) continue;
    seen.add(key(current));
    const block = bot.blockAt(current);
    if (!block || !treeBlock(block.name, request.include_mushroom_caps)) continue;
    result.push(current);
    for (const offset of NEIGHBOURS) {
      const next = current.plus(offset).floored();
      if (!seen.has(key(next))) queue.push(next);
    }
  }
  result.sort((a, b) => b.y - a.y || a.distanceTo(bot.entity.position) - b.distanceTo(bot.entity.position));
  return result;
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  discarded: DiscardedItems,
  request: FellTreeRequest,
  context: ActionContext,
): Promise<FellTreeResult> {
  const axeCount = () => bot.inventory.items().filter((item) => AXE_NAMES.includes(item.name as (typeof AXE_NAMES)[number]))
    .reduce((sum, item) => sum + item.count, 0);
  const prepareError = await prepareFellingAxe(bot, navigation, discarded, context);
  if (prepareError) {
    return { status: "failed", error: prepareError, tree: { found: 0, broken: 0, start: null, remaining: 0 } };
  }
  const seed = nearestSeed(bot, request.include_mushroom_caps);
  if (!seed) {
    return { status: "failed", error: "[TREE_NOT_FOUND] No nearby loaded tree, stem, or mushroom tree block was found.", tree: { found: 0, broken: 0, start: null, remaining: 0 } };
  }
  const targets = cluster(bot, seed, request);
  let broken = 0;
  const groups = new Map<string, Vec3[]>();
  for (const target of targets) {
    const block = bot.blockAt(target);
    if (!block || !treeBlock(block.name, request.include_mushroom_caps)) continue;
    const cells = groups.get(block.name) ?? [];
    cells.push(target);
    groups.set(block.name, cells);
  }
  for (const [blockName, group] of groups) {
    let remainingCells = group;
    while (remainingCells.length > 0) {
      context.signal?.throwIfAborted();
      const activeAxe = snapshotTools(bot).tools.find((tool) => tool.class === "axe");
      if (!activeAxe?.item || activeAxe.tier === "none" || axeCount() < 1) {
        const error = await prepareFellingAxe(bot, navigation, discarded, context);
        if (error) {
          return { status: broken > 0 ? "partial" : "failed", error, tree: { found: targets.length, broken, start: { x: seed.x, y: seed.y, z: seed.z }, remaining: targets.length - broken } };
        }
      }
      const result = await collectBlock(
        bot,
        navigation,
        {
          selector: blockName,
          requested: remainingCells.length,
          exactTarget: null,
          exactTargets: remainingCells,
          scaffolding: true,
          allowFullInventory: false,
          onToolLoss: "stop",
        },
        context,
        discarded,
      );
      const next = remainingCells.filter((target) => {
        const block = bot.blockAt(target);
        return block !== null && treeBlock(block.name, request.include_mushroom_caps);
      });
      broken += remainingCells.length - next.length;
      if (next.length === 0) break;
      if (result.status !== "succeeded" && result.error.includes("[TOOL_TIER_LOST]")) {
        remainingCells = next;
        continue;
      }
      if (result.status === "succeeded" || next.length === remainingCells.length) {
        return {
          status: broken > 0 ? "partial" : "failed",
          error: result.status === "succeeded" ? "[TREE_NOT_CONFIRMED] The collector reported success while connected wood remains." : result.error,
          tree: { found: targets.length, broken, start: { x: seed.x, y: seed.y, z: seed.z }, remaining: targets.length - broken },
        };
      }
      remainingCells = next;
    }
  }
  const remaining = Math.max(0, targets.length - broken);
  const evidence = { found: targets.length, broken, start: { x: seed.x, y: seed.y, z: seed.z }, remaining };
  if (remaining > 0) {
    return {
      status: broken > 0 ? "partial" : "failed",
      error: `[TREE_PARTIAL] ${remaining} connected logs had no safe reachable route after bounded batch collection.`,
      tree: evidence,
    };
  }
  // Keep cleanup local and bounded: only pick up spruce saplings in the
  // immediate tree area, and never turn felling one tree into a forest sweep.
  const saplings = Object.values(bot.entities)
    .filter((entity) => droppedItemName(entity) === "spruce_sapling")
    .filter((entity) => entity.position.distanceTo(seed) <= 12)
    .slice(0, 8);
  for (const entity of saplings) {
    context.signal?.throwIfAborted();
    const before = inventoryCounts(bot).spruce_sapling ?? 0;
    let collected = false;
    const onCollect = (collector: { id: number }, item: { id: number }) => {
      if (collector.id === bot.entity.id && item.id === entity.id) collected = true;
    };
    bot.on("playerCollect", onCollect);
    try {
      await pickupObservedItem(bot, {
        entityId: entity.id,
        navigate: navigation.navigate,
        movements: createMovements(bot),
        signal: context.signal,
        hasArrived: () => collected && (inventoryCounts(bot).spruce_sapling ?? 0) > before,
        timeoutMs: 8_000,
        settleMs: { itemGone: 300, pickup: 300 },
      });
    } finally {
      bot.off("playerCollect", onCollect);
    }
  }
  return broken > 0 ? { status: "succeeded", tree: evidence } : { status: "failed", error: "[TREE_NOT_FELLED] No blocks were broken.", tree: evidence };
}

export function formatFellTreeResult(result: FellTreeResult): string {
  const t = result.tree;
  return `Fell tree ${result.status}: broke ${t.broken}/${t.found} connected blocks; remaining ${t.remaining}.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createFellTreeAction(bot: Bot, navigation: NavigationRuntime, discarded: DiscardedItems = createDiscardedItems()) {
  return defineAction({
    name: FELL_TREE,
    description: FELL_TREE_DESCRIPTION,
    inputSchema: fellTreeInputSchema,
    resultSchema: fellTreeResultSchema,
    formatResult: formatFellTreeResult,
    execution: { kind: "task" },
    annotations: fellTreeAnnotations,
    parse: parseFellTreeRequest,
    execute: (request, context) => run(bot, navigation, discarded, request, context),
  });
}
