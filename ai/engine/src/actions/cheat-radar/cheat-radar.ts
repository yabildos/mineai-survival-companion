import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { findLoadedBlockPositions } from "../../world/index.js";
import { defineAction } from "../action.js";
import {
  CHEAT_RADAR,
  CHEAT_RADAR_DESCRIPTION,
  cheatRadarAnnotations,
  cheatRadarInputSchema,
  cheatRadarResultSchema,
  parseCheatRadarRequest,
  type CheatRadarMode,
  type CheatRadarRequest,
  type CheatRadarResult,
} from "./contract.js";

const STRUCTURE_BLOCKS = [
  "end_portal_frame", "reinforced_deepslate", "trial_spawner", "vault", "ominous_vault", "suspicious_sand",
  "suspicious_gravel", "bookshelf", "chiseled_bookshelf", "brewing_stand", "bell", "lodestone",
] as const;
const CHEST_BLOCKS = ["chest", "trapped_chest", "barrel", "shulker_box", "white_shulker_box", "black_shulker_box"] as const;
const SPAWNER_BLOCKS = ["spawner", "trial_spawner"] as const;
const PORTAL_BLOCKS = ["nether_portal", "end_portal", "end_portal_frame"] as const;
const PORTAL_HINT_BLOCKS = ["obsidian", "crying_obsidian"] as const;
const DANGER_BLOCKS = ["lava", "fire", "soul_fire", "magma_block", "cactus", "powder_snow"] as const;
const CAVE_BLOCKS = ["air", "cave_air", "water", "lava"] as const;
const HOSTILES = new Set(["zombie", "skeleton", "creeper", "spider", "enderman", "witch", "blaze", "slime", "magma_cube", "hoglin", "phantom", "drowned", "warden", "pillager", "vindicator", "evoker"]);

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hasMode(request: CheatRadarRequest, mode: CheatRadarMode): boolean {
  return request.modes.includes("all") || request.modes.includes(mode);
}

function stateIds(bot: Bot, names: readonly string[]): Set<number> {
  const ids = new Set<number>();
  for (const name of names) {
    const block = bot.registry.blocksByName[name];
    if (!block) continue;
    for (let id = block.minStateId; id <= block.maxStateId; id += 1) ids.add(id);
  }
  return ids;
}

function blockHits(bot: Bot, center: Vec3, names: readonly string[], request: CheatRadarRequest, note?: (name: string) => string | undefined) {
  return findLoadedBlockPositions(bot, { center, stateIds: stateIds(bot, names), radius: request.radius, limit: Number.POSITIVE_INFINITY })
    .filter((position) => (request.minY === null || position.y >= request.minY) && (request.maxY === null || position.y <= request.maxY))
    .slice(0, request.limit)
    .map((position) => {
      const name = bot.blockAt(position)?.name ?? "unknown";
      return { name, x: position.x, y: position.y, z: position.z, distance: round(position.distanceTo(center)), note: note?.(name) };
    });
}

function entityRadar(bot: Bot, center: Vec3, request: CheatRadarRequest) {
  return Object.values(bot.entities ?? {})
    .filter((entity) => entity?.isValid && entity.position && entity.id !== bot.entity.id)
    .map((entity) => {
      const name = entity.name ?? bot.registry.entities[entity.entityType ?? -1]?.name ?? "unknown";
      const distance = entity.position.distanceTo(center);
      const kind = entity.name === "player" ? "player" : entity.name === "item" ? "item" : HOSTILES.has(name) ? "hostile" : "entity";
      return {
        name,
        kind,
        entityId: entity.id,
        distance: round(distance),
        position: { x: round(entity.position.x, 2), y: round(entity.position.y, 2), z: round(entity.position.z, 2) },
        note: kind === "hostile" ? "hostile radar hit" : undefined,
      };
    })
    .filter((entity) => entity.distance <= request.radius)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, request.limit);
}

function hints(report: Pick<CheatRadarResult["radar"], "structures" | "chests" | "spawners" | "portals" | "portalHints" | "dangers" | "caves" | "entities">): string[] {
  const lines: string[] = [];
  if (report.spawners.length > 0) lines.push("Spawner-like blocks loaded nearby; this may indicate a dungeon, trial chamber, or mob farm location.");
  if (report.chests.length > 0) lines.push("Loot containers are loaded nearby; inspect route safety before opening.");
  if (report.portals.some((hit) => hit.name === "end_portal_frame")) lines.push("End portal frame loaded nearby.");
  if (report.portalHints.length > 0) lines.push("Obsidian/crying obsidian nearby may belong to a portal frame; inspect it before navigating.");
  if (report.structures.some((hit) => hit.name === "suspicious_sand" || hit.name === "suspicious_gravel")) lines.push("Archaeology blocks loaded nearby.");
  if (report.caves.length > 8) lines.push("Many underground air/liquid cells loaded; likely cave or ravine space nearby.");
  if (report.dangers.some((hit) => hit.name === "lava")) lines.push("Lava is loaded nearby; avoid blind mining and carry blocks/water where valid.");
  if (report.entities.some((hit) => hit.kind === "hostile")) lines.push("Hostile entities are loaded nearby, possibly behind walls.");
  return lines;
}

export function cheatRadar(bot: Bot, request: CheatRadarRequest): CheatRadarResult {
  const botCenter = bot.entity.position.floored();
  const center = request.center ? new Vec3(request.center.x, request.center.y, request.center.z) : botCenter;
  const emptyBlocks: ReturnType<typeof blockHits> = [];
  const radar = {
    dimension: bot.game.dimension,
    center: { x: center.x, y: center.y, z: center.z },
    centerSource: request.center ? "coordinates" as const : "bot" as const,
    loadedChunks: bot.world.getColumns().length,
    radius: request.radius,
    minY: request.minY,
    maxY: request.maxY,
    structures: hasMode(request, "structures") || hasMode(request, "hints") ? blockHits(bot, center, STRUCTURE_BLOCKS, request) : emptyBlocks,
    caves: hasMode(request, "caves") || hasMode(request, "danger") || hasMode(request, "hints") ? blockHits(bot, center, CAVE_BLOCKS, request, (name) => name === "lava" ? "lava cave danger" : undefined) : emptyBlocks,
    entities: hasMode(request, "entities") || hasMode(request, "danger") || hasMode(request, "hints") ? entityRadar(bot, center, request) : [],
    chests: hasMode(request, "chests") || hasMode(request, "structures") || hasMode(request, "hints") ? blockHits(bot, center, CHEST_BLOCKS, request) : emptyBlocks,
    spawners: hasMode(request, "spawners") || hasMode(request, "structures") || hasMode(request, "hints") ? blockHits(bot, center, SPAWNER_BLOCKS, request) : emptyBlocks,
    portals: hasMode(request, "portals") || hasMode(request, "structures") || hasMode(request, "hints") ? blockHits(bot, center, PORTAL_BLOCKS, request) : emptyBlocks,
    portalHints: hasMode(request, "portals") || hasMode(request, "structures") || hasMode(request, "hints") ? blockHits(bot, center, PORTAL_HINT_BLOCKS, request) : emptyBlocks,
    dangers: hasMode(request, "danger") || hasMode(request, "hints") ? blockHits(bot, center, DANGER_BLOCKS, request, (name) => name === "lava" ? "lava" : "hazard") : emptyBlocks,
    hints: [] as string[],
    note: "Read-only loaded-client-data radar. No commands, no teleporting, no world edits, no unloaded chunks, no seed-wide Chunkbase lookup.",
  };
  radar.hints = hasMode(request, "hints") || request.modes.includes("all") ? hints(radar) : [];
  return { status: "succeeded", radar };
}

function section(title: string, hits: readonly { name: string; x: number; y: number; z: number; distance: number; note?: string }[]): string[] {
  const lines = [`### ${title}: ${hits.length}`];
  for (const hit of hits) lines.push(`- ${hit.name} at ${hit.x}, ${hit.y}, ${hit.z}, ${hit.distance} blocks${hit.note ? `; ${hit.note}` : ""}`);
  if (hits.length === 0) lines.push("- none");
  return lines;
}

export function formatCheatRadarResult(result: CheatRadarResult): string {
  const r = result.radar;
  const lines = [`Cheat radar at ${r.center.x}, ${r.center.y}, ${r.center.z} in \`${r.dimension}\` (center: ${r.centerSource}); ${r.loadedChunks} chunks loaded; radius ${r.radius}.`];
  lines.push(...section("Structures", r.structures), "", ...section("Chests", r.chests), "", ...section("Spawners", r.spawners), "", ...section("Active portal blocks", r.portals), "", ...section("Portal frame hints", r.portalHints), "", ...section("Caves/liquids", r.caves), "", ...section("Dangers", r.dangers));
  lines.push("", `### Entities: ${r.entities.length}`);
  for (const e of r.entities) lines.push(`- #${e.entityId} ${e.name} (${e.kind}) at ${e.position.x}, ${e.position.y}, ${e.position.z}, ${e.distance} blocks${e.note ? `; ${e.note}` : ""}`);
  if (r.entities.length === 0) lines.push("- none");
  lines.push("", "### Hints", ...(r.hints.length ? r.hints.map((line) => `- ${line}`) : ["- none"]), "", r.note);
  return lines.join("\n");
}

export function createCheatRadarAction(bot: Bot) {
  return defineAction({
    name: CHEAT_RADAR,
    description: CHEAT_RADAR_DESCRIPTION,
    inputSchema: cheatRadarInputSchema,
    resultSchema: cheatRadarResultSchema,
    formatResult: formatCheatRadarResult,
    execution: { kind: "information" },
    annotations: cheatRadarAnnotations,
    parse: parseCheatRadarRequest,
    execute: async (request) => cheatRadar(bot, request),
  });
}
