import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const FOLLOW_PLAYER = "follow_player" as const;
export const FOLLOW_PLAYER_DESCRIPTION =
  "Follow a player for a bounded time. Remember observed player positions for 30 minutes; if the player is out of tracking range, walk to the last observed position and try to reacquire them. A player never observed by this bot cannot be located without a reported coordinate.";

export const followPlayerInputSchema = z.strictObject({
  username: z.string().min(1).max(16).optional().describe("Player username to follow. Omit to follow the nearest loaded player."),
  follow_distance: z.number().min(2).max(12).default(4).describe("Desired distance from the player in blocks."),
  duration_ticks: z.number().int().min(20).max(2400).default(400).describe("Maximum follow duration. 20 ticks is about one second."),
  repath_ticks: z.number().int().min(10).max(200).default(40).describe("Ticks to wait between distance checks when already close."),
  dig: z.boolean().default(false).describe("Allow pathfinder to dig blocks while following. Off by default to avoid damaging the user's base."),
  scaffold: z.boolean().default(true).describe("Allow carried scaffold blocks for safe routing while following."),
});

export type FollowPlayerRequest = z.output<typeof followPlayerInputSchema>;

export function parseFollowPlayerRequest(raw: unknown): FollowPlayerRequest {
  return followPlayerInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });

export const followPlayerEvidenceSchema = z.strictObject({
  username: z.string().nullable(),
  requestedUsername: z.string().nullable(),
  durationTicks: z.number().int().nonnegative(),
  checks: z.number().int().nonnegative(),
  navigations: z.number().int().nonnegative(),
  start: positionSchema,
  end: positionSchema,
  lastPlayerPosition: positionSchema.nullable(),
  lastDistance: z.number().nullable(),
});

export const followPlayerResultSchema = actionResultSchema({ follow: followPlayerEvidenceSchema });
export type FollowPlayerResult = z.output<typeof followPlayerResultSchema>;
export type FollowPlayerOutput = ActionOutput<typeof FOLLOW_PLAYER, FollowPlayerResult>;

export const followPlayerAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

export const followPlayerOutcomes = {
  noPlayer: (username: string | undefined) =>
    username ? `[FOLLOW_PLAYER_NOT_FOUND] Player ${username} is not loaded and has no fresh remembered position.` : "[FOLLOW_PLAYER_NO_PLAYER] No other loaded player or fresh remembered position was observed.",
  navigationStopped: (reason: string) => `[FOLLOW_PLAYER_NAVIGATION_STOPPED] ${reason}`,
} as const;
