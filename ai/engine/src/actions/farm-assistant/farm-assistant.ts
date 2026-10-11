import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import type { NavigationRuntime } from "../../navigation/index.js";
import { useItemAt } from "../../world/item-use.js";
import { createDiscardedItems, type DiscardedItems } from "../../world/discarded-items.js";
import { defineAction, type ActionContext } from "../action.js";
import { collectBlock } from "../collect-block/collect-block.js";
import {
  FARM_ASSISTANT,
  FARM_ASSISTANT_DESCRIPTION,
  cropIsMature,
  farmAssistantAnnotations,
  farmAssistantInputSchema,
  farmAssistantResultSchema,
  parseFarmAssistantRequest,
  type FarmAssistantRequest,
  type FarmAssistantResult,
} from "./contract.js";

const CROPS = ["wheat", "carrots", "potatoes", "beetroots"] as const;
type CropName = (typeof CROPS)[number];
const SEEDS: Record<CropName, string> = {
  wheat: "wheat_seeds",
  carrots: "carrot",
  potatoes: "potato",
  beetroots: "beetroot_seeds",
};

function cropAt(bot: Bot, position: Vec3) {
  const block = bot.blockAt(position);
  if (!block || !CROPS.includes(block.name as CropName)) return null;
  const crop = block.name as CropName;
  const properties = block.getProperties();
  const age = Number(properties.age ?? 0);
  return { block, crop, age, mature: cropIsMature(crop, age) };
}

function scan(bot: Bot, radius: number) {
  return bot.findBlocks({
    matching: (block) => CROPS.includes(block.name as CropName),
    maxDistance: radius,
    count: 128,
  }).map((position) => position.floored())
    .map((position) => ({ position, observed: cropAt(bot, position) }))
    .filter((entry): entry is { position: Vec3; observed: NonNullable<ReturnType<typeof cropAt>> } => entry.observed !== null)
    .sort((left, right) => left.position.distanceTo(bot.entity.position) - right.position.distanceTo(bot.entity.position));
}

function cropEvidence(entries: ReturnType<typeof scan>): FarmAssistantResult["farm"]["crops"] {
  return entries.map(({ position, observed }) => ({
    crop: observed.crop,
    position: { x: position.x, y: position.y, z: position.z },
    age: observed.age,
    mature: observed.mature,
  }));
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  discarded: DiscardedItems,
  request: FarmAssistantRequest,
  context: ActionContext,
): Promise<FarmAssistantResult> {
  const entries = scan(bot, request.radius);
  const matureEntries = entries.filter((entry) => entry.observed.mature);
  const farm = {
    operation: request.operation,
    scanned: entries.length,
    mature: matureEntries.length,
    harvested: 0,
    replanted: 0,
    crops: cropEvidence(entries),
  } as const;
  if (request.operation === "inspect") return { status: "succeeded", farm };

  let harvested = 0;
  let replanted = 0;
  let error: string | null = null;
  for (const entry of matureEntries.slice(0, request.max_crops)) {
    context.signal?.throwIfAborted();
    const live = cropAt(bot, entry.position);
    if (!live?.mature) continue;
    const support = bot.blockAt(entry.position.offset(0, -1, 0));
    if (!support || support.name !== "farmland") {
      error = `[FARM_SOIL_CHANGED] ${live.crop} at ${entry.position} is no longer on loaded farmland.`;
      break;
    }
    const seedName = SEEDS[live.crop];
    const seedsBefore = bot.inventory.items().filter((item) => item.name === seedName).reduce((sum, item) => sum + item.count, 0);
    if (live.crop === "wheat" || live.crop === "beetroots") {
      if (seedsBefore < 1) {
        error = `[FARM_SEED_MISSING] Need one ${seedName} before harvesting ${live.crop}; plot left intact.`;
        break;
      }
    } else if (seedsBefore < 2) {
      error = `[FARM_SEED_RESERVE] Need at least two ${seedName} before harvesting ${live.crop}; one must remain for replanting.`;
      break;
    }

    const harvest = await collectBlock(bot, navigation, {
      selector: live.crop,
      requested: 1,
      exactTarget: entry.position,
      scaffolding: false,
      allowFullInventory: false,
      onToolLoss: "stop",
    }, context, discarded);
    if (harvest.status !== "succeeded") {
      error = harvest.error;
      break;
    }
    harvested += 1;
    const replantedCell = bot.blockAt(entry.position);
    const farmland = bot.blockAt(entry.position.offset(0, -1, 0));
    const seed = bot.inventory.items().find((item) => item.name === seedName);
    if (!seed || !farmland || farmland.name !== "farmland" || !replantedCell || replantedCell.name !== "air") {
      error = `[FARM_REPLANT_BLOCKED] Harvested ${live.crop}, but the original farmland cell is not ready for replanting.`;
      break;
    }
    const planted = await useItemAt(bot, {
      item: seed,
      lookAt: { x: entry.position.x + 0.5, y: entry.position.y - 0.15, z: entry.position.z + 0.5 },
      on: { block: farmland, face: { x: 0, y: 1, z: 0 } },
      expectedCells: [{ position: entry.position, matches: (block) => block.name === live.crop }],
      signal: context.signal,
    });
    if (planted.kind !== "used") {
      error = `[FARM_REPLANT_FAILED] Harvested ${live.crop}, but replant was not verified: ${planted.error}`;
      break;
    }
    replanted += 1;
  }

  const result = {
    ...farm,
    harvested,
    replanted,
    crops: cropEvidence(entries),
  };
  if (error) return { status: harvested > replanted ? "partial" : "failed", error, farm: result };
  return { status: "succeeded", farm: result };
}

export function formatFarmAssistantResult(result: FarmAssistantResult): string {
  const { farm } = result;
  return `Farm ${farm.operation}: ${result.status}; inspected ${farm.scanned}, mature ${farm.mature}, harvested ${farm.harvested}, replanted ${farm.replanted}.${result.status === "succeeded" ? "" : `\n${result.error}`}`;
}

export function createFarmAssistantAction(bot: Bot, navigation: NavigationRuntime, discarded = createDiscardedItems()) {
  return defineAction({
    name: FARM_ASSISTANT,
    description: FARM_ASSISTANT_DESCRIPTION,
    inputSchema: farmAssistantInputSchema,
    resultSchema: farmAssistantResultSchema,
    formatResult: formatFarmAssistantResult,
    execution: { kind: "task" },
    annotations: farmAssistantAnnotations,
    parse: parseFarmAssistantRequest,
    execute: (request, context) => run(bot, navigation, discarded, request, context),
  });
}
