import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const TRAIL_MEMORY = "trail_memory" as const;
export const TRAIL_MEMORY_DESCRIPTION =
  "Remember and read breadcrumb, exit, hazard, resource, death and stuck marks. Use underground and on long trips so MineAI can reason about how it got somewhere and how to return.";

export const TRAIL_MEMORY_OPERATIONS = ["mark", "list", "clear"] as const;
export const TRAIL_MARK_KINDS = ["breadcrumb", "hazard", "exit", "resource", "death", "stuck"] as const;

export const trailMemoryInputSchema = z.strictObject({
  operation: z.enum(TRAIL_MEMORY_OPERATIONS).default("list"),
  kind: z.enum(TRAIL_MARK_KINDS).optional(),
  label: z.string().trim().min(1).max(64).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type TrailMemoryRequest = z.output<typeof trailMemoryInputSchema>;
export function parseTrailMemoryRequest(raw: unknown): TrailMemoryRequest {
  const value = trailMemoryInputSchema.parse(raw ?? {});
  if (value.operation === "mark" && (!value.kind || !value.label || !value.note)) throw new Error("mark requires kind, label and note.");
  return value;
}

const trailMarkSchema = z.strictObject({
  markId: z.number().int(),
  label: z.string(),
  kind: z.enum(TRAIL_MARK_KINDS),
  dimension: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  note: z.string(),
  createdAt: z.string(),
});

export const trailMemoryResultSchema = actionResultSchema({
  trail: z.strictObject({
    operation: z.enum(TRAIL_MEMORY_OPERATIONS),
    marks: z.array(trailMarkSchema),
  }),
});
export type TrailMemoryResult = z.output<typeof trailMemoryResultSchema>;
export type TrailMemoryOutput = ActionOutput<typeof TRAIL_MEMORY, TrailMemoryResult>;

export const trailMemoryAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;
