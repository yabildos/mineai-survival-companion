import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const GUARD_PLAYER = "guard_player" as const;
export const GUARD_PLAYER_DESCRIPTION =
  "Stay near a loaded player and engage one nearby common hostile threat when possible. Use for 'protect me', 'follow and defend', or base escort tasks.";

export const guardPlayerInputSchema = z.strictObject({
  username: z.string().min(1).max(16).optional().describe("Player to guard. Omit to guard the nearest loaded player."),
  duration_ticks: z.number().int().min(20).max(1200).default(300),
  follow_distance: z.number().min(2).max(10).default(4),
  threat_radius: z.number().min(4).max(48).default(24),
});

export type GuardPlayerRequest = z.output<typeof guardPlayerInputSchema>;

export function parseGuardPlayerRequest(raw: unknown): GuardPlayerRequest {
  return guardPlayerInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });

export const guardPlayerEvidenceSchema = z.strictObject({
  guardedPlayer: z.string().nullable(),
  followed: z.boolean(),
  threat: z.strictObject({ name: z.string(), distance: z.number(), position: positionSchema }).nullable(),
  engaged: z.boolean(),
  summary: z.string(),
});

export const guardPlayerResultSchema = actionResultSchema({ guard: guardPlayerEvidenceSchema });
export type GuardPlayerResult = z.output<typeof guardPlayerResultSchema>;
export type GuardPlayerOutput = ActionOutput<typeof GUARD_PLAYER, GuardPlayerResult>;

export const guardPlayerAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
