import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { registryNameSchema } from "../registry-name.js";

export const GATHER_RESOURCE = "gather_resource" as const;
export const GATHER_RESOURCE_DESCRIPTION =
  "One-call resource gathering macro. Use mode block for mineable blocks, mob_drop for drops from mobs, or craft for inventory crafting. It delegates to the existing high-level tools and reports the result compactly.";

export const gatherResourceInputSchema = z.strictObject({
  mode: z.enum(["block", "mob_drop", "craft"]),
  block_name: registryNameSchema.optional().describe("For mode=block: mineable block selector, such as oak_log, stone, or logs."),
  mob_name: registryNameSchema.optional().describe("For mode=mob_drop: mob registry name."),
  drop_name: registryNameSchema.optional().describe("For mode=mob_drop: requested drop item registry name."),
  item_name: registryNameSchema.optional().describe("For mode=craft: item registry name to craft."),
  // Large requests are executed as bounded batches by the action runner.
  // Keep the per-batch safety limit in collect_block rather than rejecting
  // useful requests such as several stacks of logs at the MCP boundary.
  count: z.number().int().min(1).max(4096).default(1),
  allow_without_shield: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.mode === "block" && !value.block_name) context.addIssue({ code: "custom", path: ["block_name"], message: "block_name is required for mode=block." });
  if (value.mode === "mob_drop" && (!value.mob_name || !value.drop_name)) context.addIssue({ code: "custom", path: ["mob_name"], message: "mob_name and drop_name are required for mode=mob_drop." });
  if (value.mode === "craft" && !value.item_name) context.addIssue({ code: "custom", path: ["item_name"], message: "item_name is required for mode=craft." });
});

export type GatherResourceRequest = z.output<typeof gatherResourceInputSchema>;

export function parseGatherResourceRequest(raw: unknown): GatherResourceRequest {
  return gatherResourceInputSchema.parse(raw ?? {});
}

export const gatherResourceEvidenceSchema = z.strictObject({
  mode: z.enum(["block", "mob_drop", "craft"]),
  target: z.string(),
  requested: z.number().int().positive(),
  summary: z.string(),
});

export const gatherResourceResultSchema = actionResultSchema({ gather: gatherResourceEvidenceSchema });
export type GatherResourceResult = z.output<typeof gatherResourceResultSchema>;
export type GatherResourceOutput = ActionOutput<typeof GATHER_RESOURCE, GatherResourceResult>;

export const gatherResourceAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
