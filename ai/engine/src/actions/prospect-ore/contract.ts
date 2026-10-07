import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const PROSPECT_ORE = "prospect_ore" as const;
export const PROSPECT_ORE_DESCRIPTION =
  "Read-only ore prospector for already-loaded chunks. It scans common ore targets, ranks nearest visible-in-memory blocks, and flags lava-adjacent hits. " +
  "Use before mining so the bot can choose small batches and avoid wasting tools. It cannot see unloaded chunks or the entire seed.";

export const ORE_PROSPECT_TARGETS = [
  "diamond",
  "ancient_debris",
  "iron",
  "gold",
  "coal",
  "copper",
  "redstone",
  "lapis",
  "emerald",
] as const;

export const prospectOreInputSchema = z.strictObject({
  targets: z.array(z.enum(ORE_PROSPECT_TARGETS)).min(1).max(ORE_PROSPECT_TARGETS.length).default(["diamond"]),
  limit_per_target: z.number().int().min(1).max(32).default(8),
  radius: z.number().int().min(1).max(192).optional(),
  min_y: z.number().int().min(-64).max(320).optional(),
  max_y: z.number().int().min(-64).max(320).optional(),
});

export type ProspectOreInput = z.input<typeof prospectOreInputSchema>;
export type OreProspectTarget = z.output<typeof prospectOreInputSchema>["targets"][number];

export interface ProspectOreRequest {
  readonly targets: readonly OreProspectTarget[];
  readonly limitPerTarget: number;
  readonly radius: number | null;
  readonly minY: number | null;
  readonly maxY: number | null;
}

export function parseProspectOreRequest(raw: unknown): ProspectOreRequest {
  const value = prospectOreInputSchema.parse(raw ?? {});
  const minY = value.min_y ?? null;
  const maxY = value.max_y ?? null;
  if (minY !== null && maxY !== null && minY > maxY) throw new Error("min_y must be less than or equal to max_y.");
  return {
    targets: [...new Set(value.targets)],
    limitPerTarget: value.limit_per_target,
    radius: value.radius ?? null,
    minY,
    maxY,
  };
}

export const oreProspectHitSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  name: z.string(),
  distance: z.number().nonnegative(),
  nearLava: z.boolean(),
  above: z.string(),
  below: z.string(),
});

export const prospectOreReportSchema = z.strictObject({
  dimension: z.string(),
  center: z.strictObject({ x: z.number().int(), y: z.number().int(), z: z.number().int() }),
  loadedChunks: z.number().int().nonnegative(),
  radius: z.number().int().positive().nullable(),
  minY: z.number().int().nullable(),
  maxY: z.number().int().nullable(),
  targets: z.array(
    z.strictObject({
      target: z.enum(ORE_PROSPECT_TARGETS),
      selectors: z.array(z.string()),
      found: z.number().int().nonnegative(),
      listed: z.array(oreProspectHitSchema),
    }),
  ),
  guidance: z.array(z.string()),
});

export const prospectOreResultSchema = actionResultSchema({ prospect: prospectOreReportSchema });
export type ProspectOreResult = z.output<typeof prospectOreResultSchema>;
export type ProspectOreOutput = ActionOutput<typeof PROSPECT_ORE, ProspectOreResult>;

export const prospectOreAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
