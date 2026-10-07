import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const CHEAT_RADAR = "cheat_radar" as const;
export const CHEAT_RADAR_DESCRIPTION =
  "Read-only radar over already loaded client data. It can scan loaded structures, chests, spawners, portals, cave air, dangers, entities and seedless structure hints without commands, mods or world changes. Optionally center a scan at explicit x/y/z coordinates. It cannot see unloaded chunks or query the world seed.";

export const CHEAT_RADAR_MODES = ["all", "structures", "caves", "entities", "chests", "spawners", "portals", "danger", "hints"] as const;

export const cheatRadarInputSchema = z.strictObject({
  modes: z.array(z.enum(CHEAT_RADAR_MODES)).min(1).max(CHEAT_RADAR_MODES.length).default(["all"]),
  radius: z.number().int().min(8).max(192).default(96).describe("Horizontal radius around MineAI or the optional coordinate center."),
  limit: z.number().int().min(1).max(64).default(16).describe("Maximum hits per category."),
  center_x: z.number().int().min(-30_000_000).max(30_000_000).optional(),
  center_y: z.number().int().min(-64).max(320).optional(),
  center_z: z.number().int().min(-30_000_000).max(30_000_000).optional(),
  min_y: z.number().int().min(-64).max(320).optional(),
  max_y: z.number().int().min(-64).max(320).optional(),
});

export type CheatRadarMode = (typeof CHEAT_RADAR_MODES)[number];
export interface CheatRadarRequest {
  readonly modes: readonly CheatRadarMode[];
  readonly radius: number;
  readonly limit: number;
  readonly center: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly minY: number | null;
  readonly maxY: number | null;
}

export function parseCheatRadarRequest(raw: unknown): CheatRadarRequest {
  const value = cheatRadarInputSchema.parse(raw ?? {});
  const minY = value.min_y ?? null;
  const maxY = value.max_y ?? null;
  if (minY !== null && maxY !== null && minY > maxY) throw new Error("min_y must be less than or equal to max_y.");
  const suppliedCenter = [value.center_x, value.center_y, value.center_z].filter((coordinate) => coordinate !== undefined).length;
  if (suppliedCenter !== 0 && suppliedCenter !== 3) throw new Error("center_x, center_y, and center_z must be supplied together.");
  const center = suppliedCenter === 3
    ? { x: value.center_x!, y: value.center_y!, z: value.center_z! }
    : null;
  return { modes: [...new Set(value.modes)], radius: value.radius, limit: value.limit, center, minY, maxY };
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });
const blockHitSchema = z.strictObject({
  name: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  distance: z.number().nonnegative(),
  note: z.string().optional(),
});
const entityHitSchema = z.strictObject({
  name: z.string(),
  kind: z.string(),
  entityId: z.number().int(),
  distance: z.number().nonnegative(),
  position: positionSchema,
  note: z.string().optional(),
});

export const cheatRadarReportSchema = z.strictObject({
  dimension: z.string(),
  center: positionSchema,
  loadedChunks: z.number().int().nonnegative(),
  radius: z.number().int(),
  centerSource: z.enum(["bot", "coordinates"]),
  minY: z.number().int().nullable(),
  maxY: z.number().int().nullable(),
  structures: z.array(blockHitSchema),
  caves: z.array(blockHitSchema),
  entities: z.array(entityHitSchema),
  chests: z.array(blockHitSchema),
  spawners: z.array(blockHitSchema),
  portals: z.array(blockHitSchema),
  portalHints: z.array(blockHitSchema),
  dangers: z.array(blockHitSchema),
  hints: z.array(z.string()),
  note: z.string(),
});

export const cheatRadarResultSchema = actionResultSchema({ radar: cheatRadarReportSchema });
export type CheatRadarResult = z.output<typeof cheatRadarResultSchema>;
export type CheatRadarOutput = ActionOutput<typeof CHEAT_RADAR, CheatRadarResult>;

export const cheatRadarAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
