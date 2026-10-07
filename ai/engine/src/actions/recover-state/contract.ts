import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const RECOVER_STATE = "recover_state" as const;
export const RECOVER_STATE_DESCRIPTION =
  "Recover from common confused states: respawn if dead, close an open window, wait briefly for packets, and report vitals/inventory summary. Use after death, stuck tools, unexpected windows, or before resuming a failed plan.";

export const recoverStateInputSchema = z.strictObject({
  wait_ticks: z.number().int().min(0).max(200).default(40).describe("Ticks to wait after recovery steps."),
});

export type RecoverStateRequest = z.output<typeof recoverStateInputSchema>;

export function parseRecoverStateRequest(raw: unknown): RecoverStateRequest {
  return recoverStateInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });

export const recoverStateEvidenceSchema = z.strictObject({
  aliveBefore: z.boolean(),
  aliveAfter: z.boolean(),
  respawnRequested: z.boolean(),
  windowClosed: z.boolean(),
  health: z.number(),
  food: z.number(),
  position: positionSchema,
  dimension: z.string(),
  inventoryItems: z.number().int().nonnegative(),
  freeSlots: z.number().int().nonnegative(),
  waitedTicks: z.number().int().nonnegative(),
});

export const recoverStateResultSchema = actionResultSchema({ recovery: recoverStateEvidenceSchema });
export type RecoverStateResult = z.output<typeof recoverStateResultSchema>;
export type RecoverStateOutput = ActionOutput<typeof RECOVER_STATE, RecoverStateResult>;

export const recoverStateAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
