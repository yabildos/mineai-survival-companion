import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const ACTIVATE_ENTITY = "activate_entity" as const;
export const ACTIVATE_ENTITY_DESCRIPTION =
  "Right-click one loaded entity by ID without choosing a substitute. Use for ordinary interactions such as giving gold to a selected piglin or opening entity interactions when a higher-level tool is unnecessary.";

export const activateEntityInputSchema = z.strictObject({
  entity_id: z.number().int().nonnegative().describe("Loaded entity ID from get_entities or view_status."),
});

export interface ActivateEntityRequest {
  readonly entityId: number;
}

export function parseActivateEntityRequest(raw: unknown): ActivateEntityRequest {
  const value = activateEntityInputSchema.parse(raw ?? {});
  return { entityId: value.entity_id };
}

export const activateEntityEvidenceSchema = z.strictObject({
  entityId: z.number().int(),
  name: z.string(),
  distance: z.number().nonnegative().nullable(),
  activated: z.boolean(),
});

export const activateEntityResultSchema = actionResultSchema({ interaction: activateEntityEvidenceSchema });
export type ActivateEntityResult = z.output<typeof activateEntityResultSchema>;
export type ActivateEntityOutput = ActionOutput<typeof ACTIVATE_ENTITY, ActivateEntityResult>;

export const activateEntityAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

export const activateEntityOutcomes = {
  unavailable: (id: number) => `[ENTITY_UNAVAILABLE] Entity #${id} is not loaded.`,
  outOfReach: (id: number, distance: number) => `[ENTITY_OUT_OF_REACH] Entity #${id} is ${distance.toFixed(2)} blocks away.`,
  failed: (cause: unknown) => `[ENTITY_ACTIVATE_FAILED] ${cause instanceof Error ? cause.message : String(cause)}`,
} as const;

