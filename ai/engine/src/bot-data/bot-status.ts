import { createRequire } from "node:module";
import type { Bot } from "mineflayer";
import type { Item } from "prismarine-item";
import { chunkPosition } from "../world/chunks.js";
import type { SqlBotData } from "./sql-bot-data.js";
import { snapshotTools, type ToolSnapshot } from "../world/tool-tiers.js";

type ItemLoader = (registry: Bot["registry"]) => typeof Item;
const loadItem = createRequire(import.meta.url)("prismarine-item") as ItemLoader;

/** Player inventory window slots that hold worn or off-hand equipment. */
export const EQUIPMENT_SLOTS = Object.freeze({ head: 5, torso: 6, legs: 7, feet: 8, "off-hand": 45 });
export type EquipmentSlot = keyof typeof EQUIPMENT_SLOTS;
export type InventoryLocation = "main" | "hotbar" | EquipmentSlot;

/** Main inventory plus hotbar: the slots `bot.inventory.items()` reports. */
export const CARRIED_SLOT_COUNT = 36;
const HOTBAR_START = 36;
interface LocalEquipmentSnapshot {
  readonly items: Map<number, Item | null>;
  mainHandSlot: number | null;
}
const equipmentSnapshots = new WeakMap<Bot, LocalEquipmentSnapshot>();

function updateInventorySlot(bot: Bot, slot: number, item: Item | null): void {
  // prismarine-windows accepts null in its implementation, but its .d.ts has
  // not caught up. Keep the cast local to this compatibility boundary.
  bot.inventory.updateSlot(slot, item as Item);
}

function playerInventorySlotForEquipment(slot: number, heldSlot: number): number | undefined {
  switch (slot) {
    case 0: return heldSlot;
    case 1: return 45;
    case 2: return 8;
    case 3: return 7;
    case 4: return 6;
    case 5: return 5;
    default: return undefined;
  }
}

/**
 * Mineflayer also receives the server's rendered equipment for the local
 * player. Keep that stream because inventory-window updates can lag behind it
 * (and the local entity's equipment accessor is backed by those same slots).
 */
export function observeEquipmentPackets(bot: Bot): () => void {
  const Item = loadItem(bot.registry);
  const equipment: LocalEquipmentSnapshot = { items: new Map(), mainHandSlot: null };
  const onEquipment = (packet: {
    entityId: number;
    slot?: number;
    item?: object | null;
    equipments?: Array<{ slot: number; item: object | null }>;
  }) => {
    if (packet.entityId !== bot.entity?.id) return;
    const entries = packet.equipments ?? [{ slot: packet.slot, item: packet.item }];
    for (const entry of entries) {
      if (entry.slot === undefined) continue;
      const item = entry.item ? Item.fromNotch(entry.item) : null;
      equipment.items.set(entry.slot, item);
      if (entry.slot === 0) equipment.mainHandSlot = HOTBAR_START + (bot.quickBarSlot ?? 0);
      const playerSlot = playerInventorySlotForEquipment(entry.slot, HOTBAR_START + (bot.quickBarSlot ?? 0));
      if (playerSlot === undefined || !bot.inventory) continue;
      if (item) item.slot = playerSlot;
      // Keep Mineflayer's player inventory in sync with what the server says
      // the local entity is actually wearing or holding. Several engine
      // capabilities read these slots directly.
      updateInventorySlot(bot, playerSlot, item);
    }
  };
  const onRespawn = () => {
    equipment.items.clear();
    equipment.mainHandSlot = null;
  };
  bot._client?.on("entity_equipment", onEquipment);
  bot.on("respawn", onRespawn);
  equipmentSnapshots.set(bot, equipment);
  return () => {
    bot._client?.off("entity_equipment", onEquipment);
    bot.off("respawn", onRespawn);
    equipmentSnapshots.delete(bot);
  };
}

export interface InventoryStack {
  readonly slot: number;
  readonly location: InventoryLocation;
  readonly name: string;
  readonly count: number;
  readonly held: boolean;
  /** Null when the item has no reported durability, including ordinary stackable items. */
  readonly durability: { readonly remaining: number; readonly maximum: number } | null;
}

export interface BotStatusSnapshot {
  readonly botId: string;
  readonly dimension: string;
  readonly gameMode: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly onGround: boolean;
  readonly inWater: boolean;
  readonly health: number;
  readonly food: number;
  readonly saturation: number;
  readonly timeOfDay: number;
  readonly isSleeping: boolean;
  readonly isRaining: boolean;
  readonly inventory: readonly InventoryStack[];
  readonly tools?: ToolSnapshot;
  readonly updatedAt?: string;
}

/** Capture the live bot facts represented by main.bot_status and main.bot_inventory. */
export function snapshotBotStatus(bot: Bot): BotStatusSnapshot {
  const position = bot.entity?.position ?? { x: 0, y: 0, z: 0 };
  const { chunkX, chunkZ } = chunkPosition(position);
  return {
    botId: bot.username || "bot",
    dimension: bot.game?.dimension || "minecraft:overworld",
    gameMode: bot.game?.gameMode || "unknown",
    x: position.x,
    y: position.y,
    z: position.z,
    chunkX,
    chunkZ,
    yaw: bot.entity?.yaw ?? 0,
    pitch: bot.entity?.pitch ?? 0,
    onGround: bot.entity?.onGround ?? true,
    inWater: Reflect.get(bot.entity ?? {}, "isInWater") === true,
    health: bot.health ?? 20,
    food: bot.food ?? 20,
    saturation: bot.foodSaturation ?? 0,
    timeOfDay: bot.time?.timeOfDay ?? 0,
    isSleeping: bot.isSleeping ?? false,
    isRaining: bot.isRaining ?? false,
    inventory: snapshotInventory(bot),
    tools: snapshotTools(bot),
    updatedAt: new Date().toISOString(),
  };
}

/** Every slot the connection owner can see, in player-inventory coordinates. */
export function snapshotInventory(bot: Bot): InventoryStack[] {
  const heldSlot = HOTBAR_START + (bot.quickBarSlot ?? 0);
  // Container packets update this window's player slots. Mineflayer copies
  // them back into bot.inventory only on close. Keep published slot numbers
  // in player-inventory coordinates without mutating Mineflayer's items.
  const window = bot.currentWindow ?? bot.inventory;
  const slotOffset = bot.currentWindow ? bot.currentWindow.inventoryStart - bot.inventory.inventoryStart : 0;
  const carried = (window?.items() ?? []).map((item): InventoryStack => {
    const slot = item.slot - slotOffset;
    return {
      slot,
      location: slot >= HOTBAR_START ? "hotbar" : "main",
      name: item.name,
      count: item.count,
      held: slot === heldSlot,
      durability: itemDurability(item),
    };
  });
  const worn = Object.entries(EQUIPMENT_SLOTS).flatMap(([location, slot]): InventoryStack[] => {
    const item = bot.inventory?.slots?.[slot];
    return item
      ? [
          {
            slot,
            location: location as EquipmentSlot,
            name: item.name,
            count: item.count,
            held: false,
            durability: itemDurability(item),
          },
        ]
      : [];
  });
  const stacks = new Map([...worn, ...carried].map((stack) => [stack.slot, stack]));
  const observedEquipment = equipmentSnapshots.get(bot);
  if (observedEquipment) {
    const heldSlot = HOTBAR_START + (bot.quickBarSlot ?? 0);
    for (const equipmentSlot of [0, 1, 2, 3, 4, 5]) {
      if (!observedEquipment.items.has(equipmentSlot)) continue;
      const playerSlot = equipmentSlot === 0
        ? observedEquipment.mainHandSlot
        : playerInventorySlotForEquipment(equipmentSlot, heldSlot);
      if (playerSlot === null || playerSlot === undefined) continue;
      if (equipmentSlot === 0 && playerSlot !== heldSlot) continue;
      const item = observedEquipment.items.get(equipmentSlot);
      stacks.delete(playerSlot);
      if (!item) continue;
      const location = playerSlot === 45
        ? "off-hand"
        : playerSlot === 5
          ? "head"
          : playerSlot === 6
            ? "torso"
            : playerSlot === 7
              ? "legs"
              : playerSlot === 8
                ? "feet"
                : playerSlot >= HOTBAR_START
                  ? "hotbar"
                  : "main";
      stacks.set(playerSlot, {
        slot: playerSlot,
        location,
        name: item.name,
        count: item.count,
        held: playerSlot === heldSlot,
        durability: itemDurability(item),
      });
    }
  }
  return [...stacks.values()].sort((left, right) => left.slot - right.slot);
}

function itemDurability(item: Item): InventoryStack["durability"] {
  const maximum = item.maxDurability;
  const used = item.durabilityUsed;
  if (!Number.isFinite(maximum) || maximum <= 0 || !Number.isFinite(used)) return null;
  return { remaining: Math.max(0, maximum - used), maximum };
}

/** The stacks occupying the 36 carried slots, as opposed to worn equipment. */
export function carriedStacks(inventory: readonly InventoryStack[]): InventoryStack[] {
  return inventory.filter((stack) => stack.location === "main" || stack.location === "hotbar");
}

/** Replace this bot's queryable live-status row and inventory rows in one transaction. */
export function updateBotStatus(data: SqlBotData, status: BotStatusSnapshot): void {
  const updatedAt = status.updatedAt ?? new Date().toISOString();
  data.transaction((database) => {
    database
      .prepare(
        `INSERT OR REPLACE INTO bot_status (
           bot_id, dimension, game_mode, x, y, z, chunk_x, chunk_z, yaw, pitch, on_ground, in_water,
           health, food, saturation, time_of_day, is_sleeping, is_raining, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        status.botId,
        status.dimension,
        status.gameMode,
        status.x,
        status.y,
        status.z,
        status.chunkX,
        status.chunkZ,
        status.yaw,
        status.pitch,
        Number(status.onGround),
        Number(status.inWater),
        status.health,
        status.food,
        status.saturation,
        status.timeOfDay,
        Number(status.isSleeping),
        Number(status.isRaining),
        updatedAt,
      );
    database.prepare("DELETE FROM bot_inventory WHERE bot_id = ?").run(status.botId);
    const insert = database.prepare(
      "INSERT INTO bot_inventory (bot_id, slot, location, item_name, count, held) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const stack of status.inventory) {
      insert.run(status.botId, stack.slot, stack.location, stack.name, stack.count, Number(stack.held));
    }
    database.prepare("DELETE FROM bot_tools WHERE bot_id = ?").run(status.botId);
    const insertTool = database.prepare(
      "INSERT INTO bot_tools (bot_id, class, category, tier, item_name, slot, durability_left, maximum_durability, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const tools = status.tools ?? { tools: [], armour: [] };
    for (const tool of [...tools.tools, ...tools.armour]) {
      insertTool.run(status.botId, tool.class, tools.tools.includes(tool) ? "tool" : "armour", tool.tier,
        tool.item, tool.slot, tool.durabilityLeft, tool.maximumDurability, updatedAt);
    }
  }, { name: "updateBotStatus" });
}
