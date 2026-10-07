import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const SCENE_SNAPSHOT = "scene_snapshot" as const;
export const SCENE_SNAPSHOT_DESCRIPTION =
  "Compact scene snapshot around MineAI: position, looked-at block, nearby players, hostiles, items, and blocks under/around the bot. Use when the bot seems confused spatially before choosing another action.";

export const sceneSnapshotInputSchema = z.strictObject({
  radius: z.number().int().min(2).max(16).default(8),
});

export type SceneSnapshotRequest = z.output<typeof sceneSnapshotInputSchema>;
export function parseSceneSnapshotRequest(raw: unknown): SceneSnapshotRequest {
  return sceneSnapshotInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });
const entitySchema = z.strictObject({ name: z.string(), distance: z.number(), position: positionSchema });
const blockSchema = z.strictObject({ offset: z.string(), name: z.string().nullable() });

export const sceneSnapshotEvidenceSchema = z.strictObject({
  dimension: z.string(),
  position: positionSchema,
  yaw: z.number(),
  pitch: z.number(),
  lookingAt: z.strictObject({ name: z.string(), position: positionSchema }).nullable(),
  blocks: z.array(blockSchema),
  players: z.array(entitySchema),
  hostiles: z.array(entitySchema),
  items: z.array(entitySchema),
});

export const sceneSnapshotResultSchema = actionResultSchema({ scene: sceneSnapshotEvidenceSchema });
export type SceneSnapshotResult = z.output<typeof sceneSnapshotResultSchema>;
export type SceneSnapshotOutput = ActionOutput<typeof SCENE_SNAPSHOT, SceneSnapshotResult>;

export const sceneSnapshotAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
