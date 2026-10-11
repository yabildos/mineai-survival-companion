import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const FARM_ASSISTANT = "farm_assistant" as const;
export const FARM_ASSISTANT_DESCRIPTION =
  "Inspect a nearby loaded crop plot or harvest and replant mature wheat, carrots, potatoes, and beetroot on existing farmland. It does not till soil, place water, or build new plots.";

export const farmAssistantInputSchema = z.strictObject({
  operation: z.enum(["inspect", "harvest_replant"]).default("inspect"),
  radius: z.number().int().min(1).max(24).default(8),
  max_crops: z.number().int().min(1).max(8).default(4),
});

export type FarmAssistantRequest = z.output<typeof farmAssistantInputSchema>;
export function parseFarmAssistantRequest(raw: unknown): FarmAssistantRequest {
  return farmAssistantInputSchema.parse(raw ?? {});
}

const cropSchema = z.strictObject({
  crop: z.enum(["wheat", "carrots", "potatoes", "beetroots"]),
  position: z.strictObject({ x: z.number().int(), y: z.number().int(), z: z.number().int() }),
  age: z.number().int().nonnegative(),
  mature: z.boolean(),
});

export const farmAssistantResultSchema = actionResultSchema({
  farm: z.strictObject({
    operation: z.enum(["inspect", "harvest_replant"]),
    scanned: z.number().int().nonnegative(),
    mature: z.number().int().nonnegative(),
    harvested: z.number().int().nonnegative(),
    replanted: z.number().int().nonnegative(),
    crops: z.array(cropSchema),
  }),
});
export type FarmAssistantResult = z.output<typeof farmAssistantResultSchema>;
export type FarmAssistantOutput = ActionOutput<typeof FARM_ASSISTANT, FarmAssistantResult>;

export const farmAssistantAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

export function cropIsMature(crop: string, age: number): boolean {
  const maximumAge: Record<string, number> = { wheat: 7, carrots: 7, potatoes: 7, beetroots: 3 };
  return age >= (maximumAge[crop] ?? Number.POSITIVE_INFINITY);
}
