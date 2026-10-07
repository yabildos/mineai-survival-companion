import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const WAIT_TICKS = "wait_ticks" as const;
export const WAIT_TICKS_DESCRIPTION =
  "Wait in place for a bounded number of Minecraft ticks without starting another gameplay action. Use it to let packets, drops, mob movement, daylight, food, fire, or portal transitions settle before observing again.";

export const waitTicksInputSchema = z.strictObject({
  ticks: z.number().int().min(1).max(1200).default(20).describe("Minecraft ticks to wait. 20 ticks is about one second."),
});

export type WaitTicksRequest = z.output<typeof waitTicksInputSchema>;

export function parseWaitTicksRequest(raw: unknown): WaitTicksRequest {
  return waitTicksInputSchema.parse(raw ?? {});
}

const vitalsSchema = z.strictObject({
  health: z.number(),
  food: z.number(),
  saturation: z.number(),
  position: z.strictObject({ x: z.number(), y: z.number(), z: z.number() }),
  dimension: z.string(),
  timeOfDay: z.number().int(),
});

export const waitTicksEvidenceSchema = z.strictObject({
  requestedTicks: z.number().int().positive(),
  before: vitalsSchema,
  after: vitalsSchema,
});

export const waitTicksResultSchema = actionResultSchema({ wait: waitTicksEvidenceSchema });
export type WaitTicksResult = z.output<typeof waitTicksResultSchema>;
export type WaitTicksOutput = ActionOutput<typeof WAIT_TICKS, WaitTicksResult>;

export const waitTicksAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

