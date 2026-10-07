import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { defineAction } from "../action.js";
import {
  ACTIVATE_BLOCK,
  ACTIVATE_BLOCK_DESCRIPTION,
  activateBlockAnnotations,
  activateBlockInputSchema,
  activateBlockOutcomes,
  activateBlockResultSchema,
  parseActivateBlockRequest,
  type ActivateBlockRequest,
  type ActivateBlockResult,
} from "./contract.js";

const BLOCK_REACH = 4.5;
const FACES = {
  up: new Vec3(0, 1, 0),
  down: new Vec3(0, -1, 0),
  north: new Vec3(0, 0, -1),
  south: new Vec3(0, 0, 1),
  east: new Vec3(1, 0, 0),
  west: new Vec3(-1, 0, 0),
} as const;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function evidence(bot: Bot, request: ActivateBlockRequest, activated: boolean): ActivateBlockResult["interaction"] {
  const block = bot.blockAt(new Vec3(request.x, request.y, request.z));
  return {
    x: request.x,
    y: request.y,
    z: request.z,
    name: block?.name ?? null,
    loaded: !!block,
    distance: round(new Vec3(request.x + 0.5, request.y + 0.5, request.z + 0.5).distanceTo(bot.entity.position)),
    face: request.face,
    activated,
    windowOpened: bot.currentWindow !== null,
  };
}

async function activate(bot: Bot, request: ActivateBlockRequest): Promise<ActivateBlockResult> {
  const block = bot.blockAt(new Vec3(request.x, request.y, request.z));
  if (!block) return { status: "failed", error: activateBlockOutcomes.unloaded, interaction: evidence(bot, request, false) };
  const distance = block.position.offset(0.5, 0.5, 0.5).distanceTo(bot.entity.position);
  if (distance > BLOCK_REACH) {
    return { status: "failed", error: activateBlockOutcomes.outOfReach(distance), interaction: evidence(bot, request, false) };
  }
  try {
    await bot.activateBlock(block, FACES[request.face]);
    return { status: "succeeded", interaction: evidence(bot, request, true) };
  } catch (cause) {
    return { status: "failed", error: activateBlockOutcomes.failed(cause), interaction: evidence(bot, request, false) };
  }
}

export function formatActivateBlockResult(result: ActivateBlockResult): string {
  const { interaction } = result;
  return `${interaction.activated ? "Activated" : "Did not activate"} block ${interaction.name ?? "unloaded"} at ${interaction.x}, ${interaction.y}, ${interaction.z} (${interaction.distance} blocks, face ${interaction.face}). Window open: ${interaction.windowOpened ? "yes" : "no"}.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createActivateBlockAction(bot: Bot) {
  return defineAction({
    name: ACTIVATE_BLOCK,
    description: ACTIVATE_BLOCK_DESCRIPTION,
    inputSchema: activateBlockInputSchema,
    resultSchema: activateBlockResultSchema,
    formatResult: formatActivateBlockResult,
    execution: { kind: "task" },
    annotations: activateBlockAnnotations,
    parse: parseActivateBlockRequest,
    execute: (request) => activate(bot, request),
  });
}

