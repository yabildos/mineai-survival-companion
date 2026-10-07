import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const GET_PATHFINDER_STATUS = "get_pathfinder_status" as const;
export const GET_PATHFINDER_STATUS_DESCRIPTION =
  "Read the current navigation/pathfinder status without moving. Use when MineAI is stuck, slow, planning too long, executing a route, or when another movement tool says navigation is busy.";

export const getPathfinderStatusInputSchema = z.strictObject({});
export type GetPathfinderStatusRequest = z.output<typeof getPathfinderStatusInputSchema>;
export function parseGetPathfinderStatusRequest(raw: unknown): GetPathfinderStatusRequest {
  return getPathfinderStatusInputSchema.parse(raw ?? {});
}

export const pathfinderStatusEvidenceSchema = z.strictObject({
  active: z.boolean(),
  status: z.unknown().nullable(),
  diveBackstop: z.number().int().nullable(),
});

export const getPathfinderStatusResultSchema = actionResultSchema({ pathfinder: pathfinderStatusEvidenceSchema });
export type GetPathfinderStatusResult = z.output<typeof getPathfinderStatusResultSchema>;
export type GetPathfinderStatusOutput = ActionOutput<typeof GET_PATHFINDER_STATUS, GetPathfinderStatusResult>;

export const getPathfinderStatusAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
