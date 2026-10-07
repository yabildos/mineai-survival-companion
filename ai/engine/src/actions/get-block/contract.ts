import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const GET_BLOCK = "get_block" as const;
export const GET_BLOCK_DESCRIPTION =
  "Read one exact block cell without moving. Use this for quick checks before placing, digging, activating a block, or verifying a known coordinate.";

const coordinate = (axis: string) => z.number().int().safe().describe(`Absolute ${axis} coordinate.`);

export const getBlockInputSchema = z.strictObject({
  x: coordinate("X"),
  y: coordinate("Y"),
  z: coordinate("Z"),
});

export type GetBlockRequest = z.output<typeof getBlockInputSchema>;

export function parseGetBlockRequest(raw: unknown): GetBlockRequest {
  return getBlockInputSchema.parse(raw ?? {});
}

export const getBlockEvidenceSchema = z.strictObject({
  dimension: z.string(),
  block: z.strictObject({
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    loaded: z.boolean(),
    name: z.string().nullable(),
    displayName: z.string().nullable(),
    shape: z.enum(["solid", "open", "liquid", "unknown"]),
    stateId: z.number().int().nullable(),
    properties: z.record(z.string(), z.unknown()),
    distance: z.number().nonnegative(),
  }),
});

export const getBlockResultSchema = actionResultSchema({ observation: getBlockEvidenceSchema });
export type GetBlockResult = z.output<typeof getBlockResultSchema>;
export type GetBlockOutput = ActionOutput<typeof GET_BLOCK, GetBlockResult>;

export const getBlockAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;

