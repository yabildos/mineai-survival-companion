import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const INSPECT_VILLAGER = "inspect_villager" as const;
export const INSPECT_VILLAGER_DESCRIPTION =
  "Open a loaded villager and read real trade offers without trading. Use before trade_villager so the bot does not spend emeralds blindly.";

export const inspectVillagerInputSchema = z.strictObject({
  entity_id: z.number().int().nonnegative(),
});
export type InspectVillagerRequest = z.output<typeof inspectVillagerInputSchema>;
export function parseInspectVillagerRequest(raw: unknown): InspectVillagerRequest {
  return inspectVillagerInputSchema.parse(raw ?? {});
}

const offerSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  input1: z.strictObject({ name: z.string(), count: z.number().int().positive() }),
  input2: z.strictObject({ name: z.string(), count: z.number().int().positive() }).nullable(),
  output: z.strictObject({ name: z.string(), count: z.number().int().positive() }),
  disabled: z.boolean(),
  realPrice: z.number().int().nullable(),
});

export const inspectVillagerResultSchema = actionResultSchema({
  villager: z.strictObject({
    entityId: z.number().int(),
    distance: z.number(),
    offers: z.array(offerSchema),
    closed: z.boolean(),
  }),
});
export type InspectVillagerResult = z.output<typeof inspectVillagerResultSchema>;
export type InspectVillagerOutput = ActionOutput<typeof INSPECT_VILLAGER, InspectVillagerResult>;

export const inspectVillagerAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
