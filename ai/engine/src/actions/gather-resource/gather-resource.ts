import type { Bot } from "mineflayer";
import type { NavigationRuntime } from "../../navigation/index.js";
import { Budgets } from "../../survival/state/budgets.js";
import type { CombatController } from "../../survival/index.js";
import { createDiscardedItems, type DiscardedItems } from "../../world/discarded-items.js";
import { snapshotTools } from "../../world/tool-tiers.js";
import { smeltItem, productionDependencies } from "../smelt-item/smelt-item.js";
import { defineAction, type ActionContext } from "../action.js";
import { collectBlock } from "../collect-block/collect-block.js";
import { craftItem } from "../craft-item/craft-item.js";
import { huntMob, huntMobDependencies } from "../hunt-mob/hunt-mob.js";
import {
  GATHER_RESOURCE,
  GATHER_RESOURCE_DESCRIPTION,
  gatherResourceAnnotations,
  gatherResourceInputSchema,
  gatherResourceResultSchema,
  parseGatherResourceRequest,
  type GatherResourceRequest,
  type GatherResourceResult,
} from "./contract.js";
import { blockMatchesSelector, expectedDropName, inventoryCounts } from "../collect-block/collection-facts.js";

export async function prepareIronAxeReserve(
  bot: Bot,
  navigation: NavigationRuntime,
  discarded: DiscardedItems,
  context: ActionContext,
): Promise<string | null> {
  const axes = () => bot.inventory.items().filter((item) => ["iron_axe", "diamond_axe", "netherite_axe"].includes(item.name))
    .reduce((sum, item) => sum + item.count, 0);
  const carried = (name: string) => inventoryCounts(bot)[name] ?? 0;
  const craft = async (itemName: string, count: number): Promise<string | null> => {
    if (count <= 0) return null;
    const result = await craftItem(bot, navigation, { items: [{ itemName, count }] }, context);
    return result.status === "succeeded" ? null : result.error;
  };
  const collect = async (selector: string, count: number): Promise<string | null> => {
    if (count <= 0) return null;
    const result = await collectBlock(bot, navigation, {
      selector, requested: count, exactTarget: null, scaffolding: true, allowFullInventory: false, onToolLoss: "stop",
    }, context, discarded);
    return result.status === "succeeded" ? null : result.error;
  };

  // A single axe is enough for a bounded woodcutting batch. Requiring an iron
  // axe plus a spare made even small log requests recursively mine and smelt.
  const missingAxes = Math.max(0, 1 - axes());
  if (missingAxes === 0) return null;
  const ironNeeded = missingAxes * 3;
  const currentIron = carried("iron_ingot") + carried("raw_iron");
  const rawNeeded = Math.max(0, ironNeeded - currentIron);

  if (rawNeeded > 0 || carried("coal") < Math.ceil(Math.max(0, ironNeeded - carried("iron_ingot")) / 8)) {
    const pickaxe = snapshotTools(bot).tools.find((tool) => tool.class === "pickaxe");
    if (!pickaxe?.item || pickaxe.tier === "none") {
      const error = await craft("wooden_pickaxe", 1);
      if (error) return `[TREE_TOOL_PREP] Could not craft wooden pickaxe: ${error}`;
    }
    const currentPickaxe = snapshotTools(bot).tools.find((tool) => tool.class === "pickaxe");
    if (!currentPickaxe?.item || currentPickaxe.tier === "wooden") {
      let error: string | null = null;
      error = await collect("stone", Math.max(0, 11 - carried("cobblestone")));
      if (error) return `[TREE_TOOL_PREP] Could not gather cobblestone for a stone pickaxe and furnace: ${error}`;
      error = await craft("stone_pickaxe", 1);
      if (error) return `[TREE_TOOL_PREP] Could not craft stone pickaxe: ${error}`;
    }
    const oreError = await collect("iron_ore", Math.max(0, rawNeeded - carried("raw_iron")));
    if (oreError) return `[TREE_TOOL_PREP] Could not gather iron ore: ${oreError}`;
  }

  const raw = Math.min(64, Math.max(0, ironNeeded - carried("iron_ingot")));
  if (raw > 0) {
    if (carried("cobblestone") < 8 && carried("furnace") === 0) {
      const cobbleError = await collect("stone", 8 - carried("cobblestone"));
      if (cobbleError) return `[TREE_TOOL_PREP] Could not gather cobblestone for furnace: ${cobbleError}`;
    }
    const furnaceError = await craft("furnace", Math.max(0, 1 - carried("furnace")));
    if (furnaceError) return `[TREE_TOOL_PREP] Could not craft furnace: ${furnaceError}`;
    const coalNeeded = Math.ceil(raw / 8);
    if ((snapshotTools(bot).tools.find((tool) => tool.class === "pickaxe")?.tier ?? "none") === "wooden") {
      const pickaxeError = await craft("wooden_pickaxe", 1);
      if (pickaxeError) return `[TREE_TOOL_PREP] Could not craft a pickaxe for coal: ${pickaxeError}`;
      const stoneError = await collect("stone", Math.max(0, 11 - carried("cobblestone")));
      if (stoneError) return `[TREE_TOOL_PREP] Could not gather cobblestone for a stone pickaxe and furnace: ${stoneError}`;
      const stonePickaxeError = await craft("stone_pickaxe", 1);
      if (stonePickaxeError) return `[TREE_TOOL_PREP] Could not craft stone pickaxe: ${stonePickaxeError}`;
    }
    const coalError = await collect("coal_ore", Math.max(0, coalNeeded - carried("coal")));
    if (coalError) return `[TREE_TOOL_PREP] Could not gather coal for smelting: ${coalError}`;
    const smelted = await smeltItem(bot, navigation, {
      itemName: "raw_iron", count: raw, fuelItemName: "coal", temporaryWorkstation: true,
    }, context, productionDependencies(navigation.navigate));
    if (smelted.status !== "succeeded") return `[TREE_TOOL_PREP] Could not smelt iron: ${smelted.error}`;
  }
  const craftAxesError = await craft("iron_axe", missingAxes);
  if (craftAxesError || axes() < 1) return `[TREE_AXE_REQUIRED] Could not make one iron axe: ${craftAxesError ?? "axe not verified"}`;
  return null;
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  combat: CombatController,
  discarded: DiscardedItems,
  budgets: Budgets,
  request: GatherResourceRequest,
  context: ActionContext,
): Promise<GatherResourceResult> {
  if (request.mode === "block") {
    const isWoodHarvest = /(?:_log|_wood|_stem|_hyphae)$/.test(request.block_name!);
    const ironAxes = () => bot.inventory.items()
      .filter((item) => item.name === "iron_axe" || item.name === "diamond_axe" || item.name === "netherite_axe")
      .reduce((sum, item) => sum + item.count, 0);
    const hasIronAxe = () => {
      const axe = snapshotTools(bot).tools.find((tool) => tool.class === "axe");
      return !!axe?.item && ["iron", "diamond", "netherite"].includes(axe.tier);
    };
    if (isWoodHarvest && (ironAxes() < 1 || !hasIronAxe())) {
      const preparationError = await prepareIronAxeReserve(bot, navigation, discarded, context);
      if (preparationError) {
        return {
          status: "failed", error: preparationError,
          gather: { mode: request.mode, target: request.block_name!, requested: request.count, summary: "no wood gathered; automatic iron-axe preparation could not complete" },
        };
      }
    }
    // The collector deliberately caps a single mining run at 32 so it can
    // re-price tools and routes.  A gather request may be larger: keep the
    // same action alive and run bounded batches until the requested net gain
    // is reached.  This prevents "12 stacks" from silently becoming 32.
    const requested = request.count;
    let gained = 0;
    let lastError: string | null = null;
    while (gained < requested) {
      context.signal?.throwIfAborted();
      if (isWoodHarvest && !hasIronAxe()) {
        const carriedReplacement = ironAxes() > 0;
        if (!carriedReplacement) {
          const preparationError = await prepareIronAxeReserve(bot, navigation, discarded, context);
          if (preparationError) {
            lastError = preparationError;
            break;
          }
        }
        if (!hasIronAxe()) {
          // A spare is in inventory, but collect_block only equips tools when
          // starting a mining run; begin the next bounded batch to activate it.
        }
      }
      const batch = Math.min(32, requested - gained);
      const countTarget = () => {
        const counts = inventoryCounts(bot);
        const itemNames = new Set(Object.keys(bot.registry.blocksByName)
          .filter((name) => blockMatchesSelector(name, request.block_name!))
          .map((name) => expectedDropName(bot, name)));
        return [...itemNames].reduce((sum, name) => sum + (counts[name] ?? 0), 0);
      };
      const before = countTarget();
      const result = await collectBlock(
        bot,
        navigation,
        {
          selector: request.block_name!,
          requested: batch,
          exactTarget: null,
          scaffolding: true,
          allowFullInventory: false,
          // Mining a large resource goal should continue with the spare
          // pickaxes already carried. Trees intentionally stop at a broken
          // axe so the reserve-axe preparation below can repair the tool set.
          onToolLoss: isWoodHarvest ? "stop" : "continue",
        },
        context,
        discarded,
      );
      const after = countTarget();
      // collect_block already verifies its net inventory gain. Prefer that
      // evidence when the composite action's inventory view lags the nested
      // collector (otherwise a successful ore batch can be reported as zero).
      const batchGained = Math.max(Math.max(0, after - before), result.collected.gained);
      gained += batchGained;
      if (result.status !== "succeeded") {
        lastError = result.error;
        if (isWoodHarvest && (ironAxes() > 0 || !hasIronAxe())) {
          // Retry this quantity with the carried reserve; progress is still
          // measured from inventory deltas so no already collected wood is lost.
          // Re-run reserve preparation after the final axe breaks; this also
          // repairs tools before the next batch when materials are available.
          const preparationError = await prepareIronAxeReserve(bot, navigation, discarded, context);
          if (!preparationError && hasIronAxe()) continue;
          lastError = preparationError ?? lastError;
        }
        break;
      }
      if (batchGained <= 0) {
        lastError = "[GATHER_NO_PROGRESS] Batch completed without gaining the requested block.";
        break;
      }
    }
    const summary = gained >= requested ? `block collection completed (${gained}/${requested})` : `${gained}/${requested}; ${lastError ?? "stopped"}`;
    return gained >= requested
      ? { status: "succeeded", gather: { mode: request.mode, target: request.block_name!, requested, summary } }
      : { status: "partial", error: lastError ?? "[GATHER_PARTIAL] Resource collection stopped before the requested amount.", gather: { mode: request.mode, target: request.block_name!, requested, summary } };
  }

  if (request.mode === "mob_drop") {
    const result = await huntMob(
      bot,
      {
        mobName: request.mob_name!,
        dropName: request.drop_name!,
        count: Math.min(request.count, 32),
        observeForMs: 0,
        campSpawner: false,
        allowWithoutShield: request.allow_without_shield,
      },
      context,
      huntMobDependencies(bot, navigation, combat, discarded),
    );
    const summary = result.status === "succeeded" ? "mob drop collection completed" : result.error;
    return result.status === "succeeded"
      ? { status: "succeeded", gather: { mode: request.mode, target: request.drop_name!, requested: Math.min(request.count, 32), summary } }
      : { status: result.status, error: result.error, gather: { mode: request.mode, target: request.drop_name!, requested: Math.min(request.count, 32), summary } };
  }

  const result = await craftItem(
    bot,
    navigation,
    {
      items: [{ itemName: request.item_name!, count: request.count }],
    },
    context,
  );
  const summary = result.status === "succeeded" ? "crafting completed" : result.error;
  return result.status === "succeeded"
    ? { status: "succeeded", gather: { mode: request.mode, target: request.item_name!, requested: request.count, summary } }
    : { status: result.status, error: result.error, gather: { mode: request.mode, target: request.item_name!, requested: request.count, summary } };
}

export function formatGatherResourceResult(result: GatherResourceResult): string {
  const g = result.gather;
  return `Gather ${g.mode} ${g.target} x${g.requested}: ${result.status}. ${g.summary}`;
}

export function createGatherResourceAction(
  bot: Bot,
  navigation: NavigationRuntime,
  combat: CombatController,
  discarded: DiscardedItems = createDiscardedItems(),
  budgets = new Budgets(),
) {
  return defineAction({
    name: GATHER_RESOURCE,
    description: GATHER_RESOURCE_DESCRIPTION,
    inputSchema: gatherResourceInputSchema,
    resultSchema: gatherResourceResultSchema,
    formatResult: formatGatherResourceResult,
    execution: { kind: "task" },
    annotations: gatherResourceAnnotations,
    parse: parseGatherResourceRequest,
    execute: (request, context) => run(bot, navigation, combat, discarded, budgets, request, context),
  });
}
