import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const ACTIVATE_BLOCK = "activate_block" as const;
export const ACTIVATE_BLOCK_DESCRIPTION =
  "Right-click one loaded reachable block without moving. Use for doors, buttons, levers, beds, crafting stations, containers, portals or other block interactions when a specialized tool is unnecessary.";

const coordinate = (axis: string) => z.number().int().safe().describe(`Absolute ${axis} coordinate.`);
const faceSchema = z.enum(["up", "down", "north", "south", "east", "west"]);

export const activateBlockInputSchema = z.strictObject({
  x: coordinate("X"),
  y: coordinate("Y"),
  z: coordinate("Z"),
  face: faceSchema.default("up").describe("Block face to click."),
});

export interface ActivateBlockRequest {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly face: z.output<typeof faceSchema>;
}

export function parseActivateBlockRequest(raw: unknown): ActivateBlockRequest {
  return activateBlockInputSchema.parse(raw ?? {});
}

export const activateBlockEvidenceSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  name: z.string().nullable(),
  loaded: z.boolean(),
  distance: z.number().nonnegative(),
  face: faceSchema,
  activated: z.boolean(),
  windowOpened: z.boolean(),
});

export const activateBlockResultSchema = actionResultSchema({ interaction: activateBlockEvidenceSchema });
export type ActivateBlockResult = z.output<typeof activateBlockResultSchema>;
export type ActivateBlockOutput = ActionOutput<typeof ACTIVATE_BLOCK, ActivateBlockResult>;

export const activateBlockAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

export const activateBlockOutcomes = {
  unloaded: "[BLOCK_UNLOADED] The requested block is not loaded.",
  outOfReach: (distance: number) => `[BLOCK_OUT_OF_REACH] The requested block is ${distance.toFixed(2)} blocks away.`,
  failed: (cause: unknown) => `[BLOCK_ACTIVATE_FAILED] ${cause instanceof Error ? cause.message : String(cause)}`,
} as const;

