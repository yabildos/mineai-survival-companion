import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { inventoryStackSchema } from "../view-status/contract.js";

export const GET_INVENTORY = "get_inventory" as const;
export const GET_INVENTORY_DESCRIPTION =
  "Read only the bot's carried inventory and equipment slots without opening any window or doing world actions. Use this before crafting, equipping, bartering, smelting, container transfers, or long trips when full view_status would be unnecessary.";

export const getInventoryInputSchema = z.strictObject({});
export type GetInventoryRequest = Record<string, never>;

export function parseGetInventoryRequest(raw: unknown): GetInventoryRequest {
  getInventoryInputSchema.parse(raw ?? {});
  return {};
}

export const inventoryTotalsSchema = z.strictObject({
  name: z.string().min(1),
  count: z.number().int().positive(),
  slots: z.array(z.number().int().nonnegative()).min(1),
});

export const getInventoryEvidenceSchema = z.strictObject({
  usedSlots: z.number().int().nonnegative(),
  freeSlots: z.number().int().nonnegative(),
  stacks: z.array(inventoryStackSchema),
  totals: z.array(inventoryTotalsSchema),
  equipment: z.strictObject({
    hand: z.string().nullable(),
    offHand: z.string().nullable(),
    head: z.string().nullable(),
    torso: z.string().nullable(),
    legs: z.string().nullable(),
    feet: z.string().nullable(),
  }),
});

export const getInventoryResultSchema = actionResultSchema({ inventory: getInventoryEvidenceSchema });
export type GetInventoryResult = z.output<typeof getInventoryResultSchema>;
export type GetInventoryOutput = ActionOutput<typeof GET_INVENTORY, GetInventoryResult>;

export const getInventoryAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;

