import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const LOOK_AT = "look_at" as const;
export const LOOK_AT_DESCRIPTION =
  "Turn MineAI's camera toward an exact position or loaded entity without moving. Use before screenshots-by-observation, interaction, ranged aiming setup, or checking what the bot is facing.";

const coordinate = z.number().safe();

export const lookAtInputSchema = z
  .strictObject({
    x: coordinate.optional(),
    y: coordinate.optional(),
    z: coordinate.optional(),
    entity_id: z.number().int().nonnegative().optional(),
    force: z.boolean().default(true).describe("Force the look packet instead of waiting for physics smoothing."),
  })
  .superRefine((value, context) => {
    const hasPosition = value.x !== undefined || value.y !== undefined || value.z !== undefined;
    if (hasPosition && !(value.x !== undefined && value.y !== undefined && value.z !== undefined)) {
      context.addIssue({ code: "custom", message: "Position target needs x, y, and z." });
    }
    if (hasPosition === (value.entity_id !== undefined)) {
      context.addIssue({ code: "custom", message: "Give either x/y/z or entity_id." });
    }
  });

export type LookAtRequest =
  | { readonly target: { readonly kind: "position"; readonly x: number; readonly y: number; readonly z: number }; readonly force: boolean }
  | { readonly target: { readonly kind: "entity"; readonly entityId: number }; readonly force: boolean };

export function parseLookAtRequest(raw: unknown): LookAtRequest {
  const value = lookAtInputSchema.parse(raw ?? {});
  return value.entity_id === undefined
    ? { target: { kind: "position", x: value.x!, y: value.y!, z: value.z! }, force: value.force }
    : { target: { kind: "entity", entityId: value.entity_id }, force: value.force };
}

export const lookAtEvidenceSchema = z.strictObject({
  target: z.union([
    z.strictObject({ kind: z.literal("position"), x: z.number(), y: z.number(), z: z.number() }),
    z.strictObject({ kind: z.literal("entity"), entityId: z.number().int(), name: z.string(), position: z.strictObject({ x: z.number(), y: z.number(), z: z.number() }) }),
  ]),
  yaw: z.number(),
  pitch: z.number(),
});

export const lookAtResultSchema = actionResultSchema({ look: lookAtEvidenceSchema });
export type LookAtResult = z.output<typeof lookAtResultSchema>;
export type LookAtOutput = ActionOutput<typeof LOOK_AT, LookAtResult>;

export const lookAtAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

