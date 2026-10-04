import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { z } from "zod";
import { createMovements, nearGoal, type NavigationRuntime } from "../navigation/index.js";
import { enchantmentsOf } from "../world/enchantments.js";
import { actionResultSchema, defineAction, type ActionContext } from "./action.js";
import { registryNameSchema } from "./registry-name.js";

const position = { x: z.number().int().safe(), y: z.number().int().safe(), z: z.number().int().safe() };
const itemName = registryNameSchema;
const evidence = {
  details: z.string(),
  inventoryBefore: z.array(z.string()),
  inventoryAfter: z.array(z.string()),
  xpBefore: z.number().int().nonnegative(),
  xpAfter: z.number().int().nonnegative(),
};
const resultSchema = actionResultSchema(evidence);
type Result = z.output<typeof resultSchema>;
type Window = NonNullable<Bot["currentWindow"]>;

function inventory(bot: Bot, names: readonly string[]): string[] {
  return names.map((name) => {
    const items = bot.inventory.items().filter((item) => item.name === name);
    const count = items.reduce((sum, item) => sum + item.count, 0);
    const enchants = items.flatMap((item) => enchantmentsOf(bot, item).map((entry) => `${entry.name ?? "unknown"}:${entry.lvl}`));
    return `${name}=${count}${enchants.length ? ` [${enchants.join(", ")}]` : ""}`;
  });
}

function itemCount(bot: Bot, name: string): number {
  return bot.inventory.items().filter((item) => item.name === name).reduce((sum, item) => sum + item.count, 0);
}

function carried(bot: Bot, name: string) {
  return bot.inventory.items().find((item) => item.name === name);
}

function windowItem(window: Window, name: string) {
  return window.slots.slice(window.inventoryStart).find((item) => item?.name === name) ?? null;
}

async function waitForSlot(bot: Bot, window: Window, slot: number, signal?: AbortSignal) {
  for (let tick = 0; tick < 40; tick++) {
    signal?.throwIfAborted();
    if (window.slots[slot]) return window.slots[slot];
    await bot.waitForTicks(1);
  }
  return null;
}

async function approachBlock(bot: Bot, navigation: NavigationRuntime, request: { x: number; y: number; z: number }, expected: readonly string[], signal?: AbortSignal) {
  if (bot.game.gameMode !== "survival") throw new Error("[SURVIVAL_ONLY] Open the world in survival mode.");
  if (bot.currentWindow) throw new Error("[WINDOW_BUSY] Close the current window first.");
  const point = new Vec3(request.x, request.y, request.z);
  if (bot.entity.position.distanceTo(point.offset(0.5, 0.5, 0.5)) > 4.5) {
    await navigation.navigate({ movements: createMovements(bot), goal: nearGoal(point, 2), signal });
  }
  if (bot.entity.position.distanceTo(point.offset(0.5, 0.5, 0.5)) > 4.5) throw new Error("[OUT_OF_REACH] Workstation remains out of reach.");
  const block = bot.blockAt(point);
  if (!block) throw new Error("[UNLOADED] Workstation block is not loaded.");
  if (!expected.includes(block.name)) throw new Error(`[WRONG_BLOCK] Found ${block.name}, expected ${expected.join(" or ")}.`);
  return block;
}

async function approachVillager(bot: Bot, navigation: NavigationRuntime, entityId: number, signal?: AbortSignal) {
  if (bot.game.gameMode !== "survival") throw new Error("[SURVIVAL_ONLY] Open the world in survival mode.");
  if (bot.currentWindow) throw new Error("[WINDOW_BUSY] Close the current window first.");
  let entity = bot.entities[entityId];
  if (!entity || entity.name !== "villager") throw new Error("[NO_VILLAGER] The requested villager is not loaded.");
  if (bot.entity.position.distanceTo(entity.position) > 4.5) {
    await navigation.navigate({ movements: createMovements(bot), goal: nearGoal(entity.position, 2), signal });
  }
  entity = bot.entities[entityId];
  if (!entity || entity.name !== "villager" || bot.entity.position.distanceTo(entity.position) > 4.5) {
    throw new Error("[OUT_OF_REACH] Villager moved away or unloaded.");
  }
  return entity;
}

async function perform(bot: Bot, names: readonly string[], context: ActionContext, operation: () => Promise<string>): Promise<Result> {
  const inventoryBefore = inventory(bot, names);
  const xpBefore = bot.experience.level;
  try {
    context.signal?.throwIfAborted();
    const details = await operation();
    context.signal?.throwIfAborted();
    return { status: "succeeded", details, inventoryBefore, inventoryAfter: inventory(bot, names), xpBefore, xpAfter: bot.experience.level };
  } catch (cause) {
    context.signal?.throwIfAborted();
    return {
      status: "failed", error: cause instanceof Error ? cause.message : String(cause),
      details: "No success was confirmed; inspect the current inventory before retrying.",
      inventoryBefore, inventoryAfter: inventory(bot, names), xpBefore, xpAfter: bot.experience.level,
    };
  }
}

function format(result: Result): string {
  return [result.details, `Before: ${result.inventoryBefore.join("; ")} (XP ${result.xpBefore})`,
    `After: ${result.inventoryAfter.join("; ")} (XP ${result.xpAfter})`,
    ...(result.status === "succeeded" ? [] : [`Blocker: ${result.error}`])].join("\n");
}

const enchantInput = z.strictObject({ ...position,
  item_name: itemName.describe("Carried item to enchant."),
  choice: z.number().int().min(0).max(2).optional().describe("Option 0, 1 or 2. Omit to inspect current offers without spending XP."),
});

export function createEnchantItemAction(bot: Bot, navigation: NavigationRuntime) {
  return defineAction({
    name: "enchant_item", description: "Use a real enchanting table with a carried item and lapis. Omit choice to inspect offers; choose 0–2 to enchant once. Needs XP and nearby bookshelves for strong offers. Reports observed item enchantments and XP; never guarantees a requested random enchantment.",
    inputSchema: enchantInput, resultSchema, formatResult: format, execution: { kind: "task" },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
    parse: (input) => enchantInput.parse(input),
    execute: (request, context) => perform(bot, [request.item_name, "lapis_lazuli"], context, async () => {
      if (!carried(bot, request.item_name)) throw new Error(`[NOT_CARRIED] ${request.item_name}`);
      if (!carried(bot, "lapis_lazuli")) throw new Error("[NO_LAPIS] Carry lapis_lazuli.");
      const block = await approachBlock(bot, navigation, request, ["enchanting_table"], context.signal);
      const table = await bot.openEnchantmentTable(block);
      try {
        const target = windowItem(table, request.item_name);
        const lapis = windowItem(table, "lapis_lazuli");
        if (!target || !lapis) throw new Error("[MISSING_INPUT] Item or lapis was not found in the open window.");
        await table.putTargetItem(target);
        await table.putLapis(lapis);
        for (let tick = 0; tick < 40 && table.enchantments.some((offer) => offer.level < 0); tick++) {
          context.signal?.throwIfAborted();
          await bot.waitForTicks(1);
        }
        const offers = table.enchantments.map((offer, index) => `${index}: level ${offer.level}, expected enchant ${offer.expected.enchant}:${offer.expected.level}`).join("; ");
        if (request.choice === undefined) return `Observed offers: ${offers}. No enchantment selected.`;
        if (table.enchantments[request.choice]?.level < 0) throw new Error("[NO_OFFER] Enchantment options did not load.");
        if (bot.experience.level < table.enchantments[request.choice]!.level) throw new Error("[LOW_XP] Not enough experience levels.");
        await table.enchant(request.choice);
        await table.takeTargetItem();
        if (!carried(bot, request.item_name)) throw new Error("[NOT_RECOVERED] Enchanted item was not returned to inventory.");
        return `Selected offer ${request.choice}. ${offers}`;
      } finally { await table.close(); }
    }),
  });
}

const anvilInput = z.strictObject({ ...position,
  item_name: itemName.describe("Carried target item, such as diamond_pickaxe."),
  second_item_name: itemName.describe("Carried enchanted book or matching item to combine with the target."),
});

export function createUseAnvilAction(bot: Bot, navigation: NavigationRuntime) {
  return defineAction({
    name: "use_anvil", description: "Combine a carried item with a carried enchanted book or compatible item at a real anvil. Pays survival XP and reports observed result. Use this to add Mending or combine enchantments; inspect inventory first.",
    inputSchema: anvilInput, resultSchema, formatResult: format, execution: { kind: "task" },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
    parse: (input) => anvilInput.parse(input),
    execute: (request, context) => perform(bot, [request.item_name, request.second_item_name], context, async () => {
      if (!carried(bot, request.item_name) || !carried(bot, request.second_item_name)) throw new Error("[NOT_CARRIED] Both anvil inputs must be carried.");
      if (request.item_name === request.second_item_name && itemCount(bot, request.item_name) < 2) throw new Error("[NOT_CARRIED] Two matching items are required.");
      const block = await approachBlock(bot, navigation, request, ["anvil", "chipped_anvil", "damaged_anvil"], context.signal);
      const anvil = await bot.openAnvil(block);
      try {
        const window = bot.currentWindow;
        if (!window) throw new Error("[NO_WINDOW] Anvil window did not open.");
        const target = windowItem(window, request.item_name);
        const second = window.slots.slice(window.inventoryStart).filter((item) => item?.name === request.second_item_name)[request.item_name === request.second_item_name ? 1 : 0];
        if (!target || !second) throw new Error("[MISSING_INPUT] Anvil inputs not found in the window.");
        await anvil.combine(target, second);
        if (!carried(bot, request.item_name)) throw new Error("[NOT_RECOVERED] Combined item was not observed in inventory.");
        return `Combined ${request.item_name} with ${request.second_item_name}.`;
      } finally { if (bot.currentWindow) await bot.closeWindow(bot.currentWindow); }
    }),
  });
}

const tradeInput = z.strictObject({
  entity_id: z.number().int().nonnegative().describe("Loaded villager entity ID from view_status."),
  trade_index: z.number().int().nonnegative().optional().describe("Offer index to execute once; omit to inspect current offers."),
});

export function createTradeVillagerAction(bot: Bot, navigation: NavigationRuntime) {
  return defineAction({
    name: "trade_villager", description: "Inspect a loaded villager's real offers or execute one selected offer once with carried payment. Reports item costs, output and observed inventory. Useful for enchanted books, including Mending; no trades are created or changed.",
    inputSchema: tradeInput, resultSchema, formatResult: format, execution: { kind: "task" },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
    parse: (input) => tradeInput.parse(input),
    execute: (request, context) => perform(bot, ["emerald", "book", "enchanted_book"], context, async () => {
      const entity = await approachVillager(bot, navigation, request.entity_id, context.signal);
      const window = await bot.openVillager(entity);
      try {
        const offers = window.trades.map((offer, index) => {
          const second = offer.hasItem2 ? ` + ${offer.inputItem2?.count} ${offer.inputItem2?.name}` : "";
          const components = Reflect.get(offer.outputItem, "components") as unknown;
          const enchants = components ? ` components=${JSON.stringify(components).slice(0, 500)}` : "";
          return `${index}: ${offer.realPrice ?? offer.inputItem1.count} ${offer.inputItem1.name}${second} -> ${offer.outputItem.count} ${offer.outputItem.name}${enchants}${offer.tradeDisabled ? " [disabled]" : ""}`;
        });
        if (request.trade_index === undefined) return `Observed offers: ${offers.join("; ") || "none"}. No trade made.`;
        const offer = window.trades[request.trade_index];
        if (!offer || offer.tradeDisabled) throw new Error("[NO_OFFER] Offer does not exist or is disabled.");
        const before = itemCount(bot, offer.outputItem.name);
        await bot.trade(window, request.trade_index, 1);
        if (itemCount(bot, offer.outputItem.name) <= before) throw new Error("[NO_OUTPUT] Trade output was not observed in inventory.");
        return `Executed offer ${request.trade_index}: ${offers[request.trade_index]}.`;
      } finally { await window.close(); }
    }),
  });
}

const smithInput = z.strictObject({ ...position,
  item_name: itemName.refine((name) => name.startsWith("diamond_"), "Requires a diamond item.").describe("Diamond item to upgrade, such as diamond_pickaxe."),
});

export function createUpgradeNetheriteAction(bot: Bot, navigation: NavigationRuntime) {
  return defineAction({
    name: "upgrade_netherite", description: "Upgrade one carried diamond item at a real smithing table using a carried netherite_upgrade_smithing_template and netherite_ingot. Uses ordinary survival UI slots; confirms that the netherite item entered inventory.",
    inputSchema: smithInput, resultSchema, formatResult: format, execution: { kind: "task" },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
    parse: (input) => smithInput.parse(input),
    execute: (request, context) => {
      const resultName = request.item_name.replace(/^diamond_/, "netherite_");
      return perform(bot, [request.item_name, "netherite_upgrade_smithing_template", "netherite_ingot", resultName], context, async () => {
        for (const name of [request.item_name, "netherite_upgrade_smithing_template", "netherite_ingot"]) {
          if (!carried(bot, name)) throw new Error(`[NOT_CARRIED] ${name}`);
        }
        const block = await approachBlock(bot, navigation, request, ["smithing_table"], context.signal);
        const window = await bot.openBlock(block);
        try {
          if (!String(window.type).includes("smithing")) throw new Error(`[WRONG_WINDOW] ${window.type}`);
          const before = itemCount(bot, resultName);
          for (const [name, slot] of [["netherite_upgrade_smithing_template", 0], [request.item_name, 1], ["netherite_ingot", 2]] as const) {
            context.signal?.throwIfAborted();
            const item = windowItem(window, name);
            if (!item) throw new Error(`[MISSING_INPUT] ${name} not found in smithing window.`);
            await bot.moveSlotItem(item.slot, slot);
          }
          const output = await waitForSlot(bot, window, 3, context.signal);
          if (!output || output.name !== resultName) throw new Error(`[NO_RECIPE] Smithing output was ${output?.name ?? "empty"}, not ${resultName}.`);
          await bot.putAway(3);
          if (itemCount(bot, resultName) <= before) throw new Error("[NO_OUTPUT] Netherite item was not observed in inventory.");
          return `Upgraded ${request.item_name} to ${resultName}.`;
        } finally { await bot.closeWindow(window); }
      });
    },
  });
}
