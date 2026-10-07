import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const WAYPOINT = "waypoint" as const;
export const WAYPOINT_DESCRIPTION =
  "Save, list, delete, or navigate to named waypoints such as base, mine, farm, village, portal, or storage. Use this instead of rediscovering known places.";

export const waypointInputSchema = z.strictObject({
  operation: z.enum(["save", "list", "delete", "go"]),
  name: z.string().trim().min(1).max(48).optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  z: z.number().int().optional(),
  dimension: z.string().trim().min(1).optional(),
  description: z.string().trim().max(200).default(""),
  range: z.number().nonnegative().max(16).default(2),
}).superRefine((value, context) => {
  if (value.operation !== "list" && !value.name) {
    context.addIssue({ code: "custom", path: ["name"], message: "name is required unless operation=list." });
  }
  const coordinates = [value.x, value.y, value.z].filter((coordinate) => coordinate !== undefined).length;
  if (coordinates !== 0 && coordinates !== 3) {
    context.addIssue({ code: "custom", path: ["x"], message: "x, y, and z must be supplied together." });
  }
});

export type WaypointRequest = z.output<typeof waypointInputSchema>;

export function parseWaypointRequest(raw: unknown): WaypointRequest {
  return waypointInputSchema.parse(raw ?? {});
}

const waypointEntrySchema = z.strictObject({
  name: z.string(),
  dimension: z.string(),
  position: z.strictObject({ x: z.number().int(), y: z.number().int(), z: z.number().int() }),
  description: z.string(),
  updatedAt: z.string(),
});

export const waypointEvidenceSchema = z.strictObject({
  operation: z.enum(["save", "list", "delete", "go"]),
  selected: waypointEntrySchema.nullable(),
  waypoints: z.array(waypointEntrySchema),
  navigated: z.boolean(),
});

export const waypointResultSchema = actionResultSchema({ waypoint: waypointEvidenceSchema });
export type WaypointEntry = z.output<typeof waypointEntrySchema>;
export type WaypointResult = z.output<typeof waypointResultSchema>;
export type WaypointOutput = ActionOutput<typeof WAYPOINT, WaypointResult>;

export const waypointAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
