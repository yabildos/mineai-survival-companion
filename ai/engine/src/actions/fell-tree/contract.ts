import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const FELL_TREE = "fell_tree" as const;
export const FELL_TREE_DESCRIPTION =
  "Fell one nearby connected tree-like structure completely: overworld logs, Nether stems/hyphae, or huge mushroom stems/caps. Use this instead of collect_block when the user asks to chop a tree or mushroom tree.";

export const fellTreeInputSchema = z.strictObject({
  max_blocks: z.number().int().min(1).max(256).default(128),
  include_mushroom_caps: z.boolean().default(true),
});

export type FellTreeRequest = z.output<typeof fellTreeInputSchema>;
export function parseFellTreeRequest(raw: unknown): FellTreeRequest {
  return fellTreeInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number().int(), y: z.number().int(), z: z.number().int() });
export const fellTreeEvidenceSchema = z.strictObject({
  found: z.number().int().nonnegative(),
  broken: z.number().int().nonnegative(),
  start: positionSchema.nullable(),
  remaining: z.number().int().nonnegative(),
});

export const fellTreeResultSchema = actionResultSchema({ tree: fellTreeEvidenceSchema });
export type FellTreeResult = z.output<typeof fellTreeResultSchema>;
export type FellTreeOutput = ActionOutput<typeof FELL_TREE, FellTreeResult>;

export const fellTreeAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
