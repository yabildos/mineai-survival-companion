import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const INSPECT_FURNACE = "inspect_furnace" as const;
export const INSPECT_FURNACE_DESCRIPTION =
  "Open and read one furnace without inserting or taking items. Reports input, fuel, output, cook progress and fuel progress, then closes the window.";

const coordinate = (axis: string) => z.number().int().safe().describe(`Absolute ${axis} coordinate.`);
export const inspectFurnaceInputSchema = z.strictObject({
  x: coordinate("X"),
  y: coordinate("Y"),
  z: coordinate("Z"),
});
export type InspectFurnaceRequest = z.output<typeof inspectFurnaceInputSchema>;
export function parseInspectFurnaceRequest(raw: unknown): InspectFurnaceRequest {
  return inspectFurnaceInputSchema.parse(raw ?? {});
}

const itemSchema = z.strictObject({ name: z.string(), count: z.number().int().positive() }).nullable();
export const inspectFurnaceResultSchema = actionResultSchema({
  furnace: z.strictObject({
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    blockName: z.string().nullable(),
    input: itemSchema,
    fuel: itemSchema,
    output: itemSchema,
    cookProgress: z.number().nullable(),
    fuelProgress: z.number().nullable(),
    closed: z.boolean(),
  }),
});
export type InspectFurnaceResult = z.output<typeof inspectFurnaceResultSchema>;
export type InspectFurnaceOutput = ActionOutput<typeof INSPECT_FURNACE, InspectFurnaceResult>;

export const inspectFurnaceAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
