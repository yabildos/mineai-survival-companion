import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { findLoadedBlockPositions } from "../../world/index.js";
import { defineAction } from "../action.js";
import { blockMatchesSelector } from "../collect-block/collection-facts.js";
import {
  PROSPECT_ORE,
  PROSPECT_ORE_DESCRIPTION,
  parseProspectOreRequest,
  prospectOreAnnotations,
  prospectOreInputSchema,
  prospectOreResultSchema,
  type OreProspectTarget,
  type ProspectOreRequest,
  type ProspectOreResult,
} from "./contract.js";

const TARGET_SELECTORS: Record<OreProspectTarget, readonly string[]> = {
  diamond: ["diamond_ore"],
  ancient_debris: ["ancient_debris"],
  iron: ["iron_ore"],
  gold: ["gold_ore", "nether_gold_ore"],
  coal: ["coal_ore"],
  copper: ["copper_ore"],
  redstone: ["redstone_ore"],
  lapis: ["lapis_ore"],
  emerald: ["emerald_ore"],
};

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function selectedStateIds(bot: Bot, selectors: readonly string[]): Set<number> {
  const stateIds = new Set<number>();
  for (const block of Object.values(bot.registry.blocksByName)) {
    if (!selectors.some((selector) => blockMatchesSelector(block.name, selector))) continue;
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

export function prospectOre(bot: Bot, request: ProspectOreRequest): ProspectOreResult {
  const center = bot.entity.position.floored();
  const targets = request.targets.map((target) => {
    const selectors = TARGET_SELECTORS[target];
    const positions = findLoadedBlockPositions(bot, {
      center,
      stateIds: selectedStateIds(bot, selectors),
      limit: Number.POSITIVE_INFINITY,
      radius: request.radius ?? undefined,
    }).filter((position) => (request.minY === null || position.y >= request.minY) && (request.maxY === null || position.y <= request.maxY));
    const listed = positions.slice(0, request.limitPerTarget).map((position) => ({
      x: position.x,
      y: position.y,
      z: position.z,
      name: nameAt(bot, position),
      distance: round(position.distanceTo(center)),
      nearLava: nearLava(bot, position),
      above: nameAt(bot, position.offset(0, 1, 0)),
      below: nameAt(bot, position.offset(0, -1, 0)),
    }));
    return { target, selectors: [...selectors], found: positions.length, listed };
  });
  return {
    status: "succeeded",
    prospect: {
      dimension: bot.game.dimension,
      center: { x: center.x, y: center.y, z: center.z },
      loadedChunks: bot.world.getColumns().length,
      radius: request.radius,
      minY: request.minY,
      maxY: request.maxY,
      targets,
      guidance: [
        "This is a read-only loaded-chunk scan, not seed-wide Chunkbase data.",
        "Mine valuable ores in small batches and verify pickaxe durability before committing.",
        "Treat lava-adjacent hits as dangerous and approach with blocks, water where legal, food, and an exit path.",
      ],
    },
  };
}

export function formatProspectOreResult(result: ProspectOreResult): string {
  const { prospect } = result;
  const lines = [
    `Ore prospect at ${prospect.center.x}, ${prospect.center.y}, ${prospect.center.z} in \`${prospect.dimension}\`; ${prospect.loadedChunks} chunks loaded.`,
    prospect.radius === null ? "Radius: all loaded chunks." : `Radius: ${prospect.radius} blocks.`,
  ];
  if (prospect.minY !== null || prospect.maxY !== null) lines.push(`Y range: ${prospect.minY ?? "min"}..${prospect.maxY ?? "max"}.`);
  for (const entry of prospect.targets) {
    lines.push("", `### ${entry.target}: ${entry.found} loaded matches`);
    for (const hit of entry.listed) {
      const risk = hit.nearLava ? "; lava adjacent" : "";
      lines.push(`- ${hit.name} at ${hit.x}, ${hit.y}, ${hit.z}, ${hit.distance} blocks away; above ${hit.above}, below ${hit.below}${risk}`);
    }
    if (entry.listed.length === 0) lines.push("- none loaded");
  }
  lines.push("", ...prospect.guidance.map((line) => `- ${line}`));
  return lines.join("\n");
}

export function createProspectOreAction(bot: Bot) {
  return defineAction({
    name: PROSPECT_ORE,
    description: PROSPECT_ORE_DESCRIPTION,
    inputSchema: prospectOreInputSchema,
    resultSchema: prospectOreResultSchema,
    formatResult: formatProspectOreResult,
    execution: { kind: "information" },
    annotations: prospectOreAnnotations,
    parse: parseProspectOreRequest,
    execute: async (request) => prospectOre(bot, request),
  });
}
