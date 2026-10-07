import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const UNSTUCK = "unstuck" as const;
export const UNSTUCK_DESCRIPTION =
  "Try to recover from being physically stuck without breaking blocks: close windows, jump, step backward and sideways, then report movement. Use after repeated navigation stalls.";

export const unstuckInputSchema = z.strictObject({
  attempts: z.number().int().min(1).max(5).default(3),
});

export type UnstuckRequest = z.output<typeof unstuckInputSchema>;
export function parseUnstuckRequest(raw: unknown): UnstuckRequest {
  return unstuckInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });
export const unstuckEvidenceSchema = z.strictObject({
  attempts: z.number().int().positive(),
  start: positionSchema,
  end: positionSchema,
  moved: z.number().nonnegative(),
  windowClosed: z.boolean(),
});

export const unstuckResultSchema = actionResultSchema({ unstuck: unstuckEvidenceSchema });
export type UnstuckResult = z.output<typeof unstuckResultSchema>;
export type UnstuckOutput = ActionOutput<typeof UNSTUCK, UnstuckResult>;

export const unstuckAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
