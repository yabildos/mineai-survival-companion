import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { findLoadedBlockPositions } from "../../world/index.js";
import { defineAction } from "../action.js";
import { blockMatchesSelector } from "../collect-block/collection-facts.js";
import {
  SCAN_LOADED_BLOCKS,
  SCAN_LOADED_BLOCKS_DESCRIPTION,
  parseScanLoadedBlocksRequest,
  scanLoadedBlocksAnnotations,
  scanLoadedBlocksInputSchema,
  scanLoadedBlocksResultSchema,
  type ScanLoadedBlocksRequest,
  type ScanLoadedBlocksResult,
} from "./contract.js";

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function selectedStateIds(bot: Bot, selector: string): Set<number> {
  const stateIds = new Set<number>();
  for (const block of Object.values(bot.registry.blocksByName)) {
    if (!blockMatchesSelector(block.name, selector)) continue;
    for (let stateId = block.minStateId; stateId <= block.maxStateId; stateId += 1) stateIds.add(stateId);
  }
  return stateIds;
}

function nameAt(bot: Bot, position: Vec3): string {
  return bot.blockAt(position)?.name ?? "unloaded";
}

function nearLava(bot: Bot, position: Vec3): boolean {
  const offsets = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;
  return offsets.some(([x, y, z]) => nameAt(bot, position.offset(x, y, z)) === "lava");
}

export function scanLoadedBlocks(bot: Bot, request: ScanLoadedBlocksRequest): ScanLoadedBlocksResult {
  const center = request.center ? new Vec3(request.center.x, request.center.y, request.center.z) : bot.entity.position.floored();
  const results = request.blockNames.map((query) => {
    const stateIds = selectedStateIds(bot, query);
    const positions = findLoadedBlockPositions(bot, {
      center,
      stateIds,
      limit: Number.POSITIVE_INFINITY,
      radius: request.radius ?? undefined,
    }).filter((position) => (request.minY === null || position.y >= request.minY) && (request.maxY === null || position.y <= request.maxY));
    const listed = positions.slice(0, request.limit).map((position) => ({
      x: position.x,
      y: position.y,
      z: position.z,
      name: nameAt(bot, position),
      distance: round(position.distanceTo(center)),
      above: nameAt(bot, position.offset(0, 1, 0)),
      below: nameAt(bot, position.offset(0, -1, 0)),
      nearLava: nearLava(bot, position),
    }));
    return { query, matchedStates: stateIds.size, found: positions.length, listed };
  });
  return {
    status: "succeeded",
    scan: {
      dimension: bot.game.dimension,
      center: { x: center.x, y: center.y, z: center.z },
      loadedChunks: bot.world.getColumns().length,
      radius: request.radius,
      minY: request.minY,
      maxY: request.maxY,
      results,
      note: "Read-only loaded-chunk scan. It sees only chunks already loaded by the bot, not the whole seed.",
    },
  };
}

export function formatScanLoadedBlocksResult(result: ScanLoadedBlocksResult): string {
  const { scan } = result;
  const lines = [
    `Loaded scan at ${scan.center.x}, ${scan.center.y}, ${scan.center.z} in \`${scan.dimension}\`; ${scan.loadedChunks} chunks loaded.`,
    scan.radius === null ? "Radius: all loaded chunks." : `Radius: ${scan.radius} blocks.`,
  ];
  if (scan.minY !== null || scan.maxY !== null) lines.push(`Y range: ${scan.minY ?? "min"}..${scan.maxY ?? "max"}.`);
  for (const entry of scan.results) {
    lines.push("", `### ${entry.query}: ${entry.found} loaded matches (${entry.matchedStates} states)`);
    for (const hit of entry.listed) {
      const risk = hit.nearLava ? "; lava adjacent" : "";
      lines.push(`- ${hit.name} at ${hit.x}, ${hit.y}, ${hit.z}, ${hit.distance} blocks away; above ${hit.above}, below ${hit.below}${risk}`);
    }
    if (entry.listed.length === 0) lines.push("- none loaded");
  }
  lines.push("", scan.note);
  return lines.join("\n");
}

export function createScanLoadedBlocksAction(bot: Bot) {
  return defineAction({
    name: SCAN_LOADED_BLOCKS,
    description: SCAN_LOADED_BLOCKS_DESCRIPTION,
    inputSchema: scanLoadedBlocksInputSchema,
    resultSchema: scanLoadedBlocksResultSchema,
    formatResult: formatScanLoadedBlocksResult,
    execution: { kind: "information" },
    annotations: scanLoadedBlocksAnnotations,
    parse: parseScanLoadedBlocksRequest,
    execute: async (request) => scanLoadedBlocks(bot, request),
  });
}
