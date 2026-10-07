import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const RESPAWN = "respawn" as const;
export const RESPAWN_DESCRIPTION =
  "Request MineAI respawn from the death screen if dead. If already alive, this is a safe no-op. Use after a death or disconnected/recovered session before continuing gameplay.";

export const respawnInputSchema = z.strictObject({
  wait_ticks: z.number().int().min(0).max(200).default(80).describe("Ticks to wait for health/alive state after sending respawn."),
});

export type RespawnRequest = z.output<typeof respawnInputSchema>;

export function parseRespawnRequest(raw: unknown): RespawnRequest {
  return respawnInputSchema.parse(raw ?? {});
}

export const respawnEvidenceSchema = z.strictObject({
  aliveBefore: z.boolean(),
  healthBefore: z.number(),
  aliveAfter: z.boolean(),
  healthAfter: z.number(),
  waitedTicks: z.number().int().nonnegative(),
  requested: z.boolean(),
});

export const respawnResultSchema = actionResultSchema({ respawn: respawnEvidenceSchema });
export type RespawnResult = z.output<typeof respawnResultSchema>;
export type RespawnOutput = ActionOutput<typeof RESPAWN, RespawnResult>;

export const respawnAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} satisfies ToolAnnotations;

