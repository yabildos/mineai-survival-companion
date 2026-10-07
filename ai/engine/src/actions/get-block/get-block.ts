import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { isLiquid } from "../../world/index.js";
import { defineAction } from "../action.js";
import {
  GET_BLOCK,
  GET_BLOCK_DESCRIPTION,
  getBlockAnnotations,
  getBlockInputSchema,
  getBlockResultSchema,
  parseGetBlockRequest,
  type GetBlockRequest,
  type GetBlockResult,
} from "./contract.js";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function observe(bot: Bot, request: GetBlockRequest): GetBlockResult {
  const position = new Vec3(request.x, request.y, request.z);
  const block = bot.blockAt(position);
  const distance = round(position.offset(0.5, 0.5, 0.5).distanceTo(bot.entity.position), 2);
  const observation = {
    dimension: bot.game.dimension,
    block: block
      ? {
          x: request.x,
          y: request.y,
          z: request.z,
          loaded: true,
          name: block.name,
          displayName: block.displayName,
          shape: isLiquid(block) ? ("liquid" as const) : block.boundingBox === "block" ? ("solid" as const) : ("open" as const),
          stateId: block.stateId,
          properties: (block.getProperties?.() ?? {}) as Record<string, unknown>,
          distance,
        }
      : {
          x: request.x,
          y: request.y,
          z: request.z,
          loaded: false,
          name: null,
          displayName: null,
          shape: "unknown" as const,
          stateId: null,
          properties: {},
          distance,
        },
  };
  return { status: "succeeded", observation };
}

export function formatGetBlockResult(result: GetBlockResult): string {
  const { block, dimension } = result.observation;
  if (!block.loaded) {
    return `Block ${block.x}, ${block.y}, ${block.z} in \`${dimension}\` is not loaded; distance ${block.distance} blocks.`;
  }
  const props = Object.keys(block.properties).length ? ` properties ${JSON.stringify(block.properties)}` : "";
  return `Block ${block.x}, ${block.y}, ${block.z} in \`${dimension}\`: ${block.name} (${block.shape}), state ${block.stateId}, distance ${block.distance} blocks.${props}`;
}

export function createGetBlockAction(bot: Bot) {
  return defineAction({
    name: GET_BLOCK,
    description: GET_BLOCK_DESCRIPTION,
    inputSchema: getBlockInputSchema,
    resultSchema: getBlockResultSchema,
    formatResult: formatGetBlockResult,
    execution: { kind: "information" },
    annotations: getBlockAnnotations,
    parse: parseGetBlockRequest,
    execute: (request) => Promise.resolve(observe(bot, request)),
  });
}

