import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { registryNameSchema } from "../registry-name.js";

export const SCAN_LOADED_BLOCKS = "scan_loaded_blocks" as const;
export const SCAN_LOADED_BLOCKS_DESCRIPTION =
  "Read-only x-ray style scan across chunks already loaded by the bot. It lists nearest matching block positions without moving or changing the world. " +
  "Use it for ores, chests, lava, spawners, mushroom blocks, logs, or exact survival checks. It cannot see chunks the client has not loaded.";

export const DEFAULT_SCAN_LIMIT = 16;
export const MAX_SCAN_LIMIT = 128;
export const MAX_SCAN_NAMES = 12;
export const MAX_SCAN_RADIUS = 192;

const coordinate = (axis: string) => z.number().int().safe().describe(`Absolute ${axis} coordinate.`);

export const scanLoadedBlocksInputSchema = z.strictObject({
  block_names: z
    .array(registryNameSchema)
    .min(1)
    .max(MAX_SCAN_NAMES)
    .describe("Block names or known selectors, such as diamond_ore, ancient_debris, chest, logs, wood, or mushroom_tree."),
  limit: z.number().int().min(1).max(MAX_SCAN_LIMIT).default(DEFAULT_SCAN_LIMIT),
  radius: z
    .number()
    .int()
    .min(1)
    .max(MAX_SCAN_RADIUS)
    .optional()
    .describe("Optional horizontal radius from center. Omit to scan every loaded chunk."),
  min_y: z.number().int().min(-64).max(320).optional(),
  max_y: z.number().int().min(-64).max(320).optional(),
  center: z
    .strictObject({ x: coordinate("X"), y: coordinate("Y"), z: coordinate("Z") })
    .optional()
    .describe("Optional scan center. Defaults to the bot's feet."),
});

export type ScanLoadedBlocksInput = z.input<typeof scanLoadedBlocksInputSchema>;

export interface ScanLoadedBlocksRequest {
  readonly blockNames: readonly string[];
  readonly limit: number;
  readonly radius: number | null;
  readonly minY: number | null;
  readonly maxY: number | null;
  readonly center: { readonly x: number; readonly y: number; readonly z: number } | null;
}

export function parseScanLoadedBlocksRequest(raw: unknown): ScanLoadedBlocksRequest {
  const value = scanLoadedBlocksInputSchema.parse(raw ?? {});
  const minY = value.min_y ?? null;
  const maxY = value.max_y ?? null;
  if (minY !== null && maxY !== null && minY > maxY) throw new Error("min_y must be less than or equal to max_y.");
  return {
    blockNames: [...new Set(value.block_names)],
    limit: value.limit,
    radius: value.radius ?? null,
    minY,
    maxY,
    center: value.center ?? null,
  };
}

export const loadedBlockHitSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  name: z.string(),
  distance: z.number().nonnegative(),
  above: z.string(),
  below: z.string(),
  nearLava: z.boolean(),
});

export const scanLoadedBlocksReportSchema = z.strictObject({
  dimension: z.string(),
  center: z.strictObject({ x: z.number().int(), y: z.number().int(), z: z.number().int() }),
  loadedChunks: z.number().int().nonnegative(),
  radius: z.number().int().positive().nullable(),
  minY: z.number().int().nullable(),
  maxY: z.number().int().nullable(),
  results: z.array(
    z.strictObject({
      query: z.string(),
      matchedStates: z.number().int().nonnegative(),
      found: z.number().int().nonnegative(),
      listed: z.array(loadedBlockHitSchema),
    }),
  ),
  note: z.string(),
});

export const scanLoadedBlocksResultSchema = actionResultSchema({ scan: scanLoadedBlocksReportSchema });
export type ScanLoadedBlocksResult = z.output<typeof scanLoadedBlocksResultSchema>;
export type ScanLoadedBlocksOutput = ActionOutput<typeof SCAN_LOADED_BLOCKS, ScanLoadedBlocksResult>;

export const scanLoadedBlocksAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
