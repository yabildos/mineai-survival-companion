import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { EQUIPMENT_DESTINATIONS, equipmentSlotsSchema, type EquipmentDestination } from "../equip/contract.js";

export const UNEQUIP = "unequip" as const;
export const UNEQUIP_DESCRIPTION =
  "Unequip worn armor, off-hand item, or held item into the inventory. Use before dropping worn items, changing armor, freeing the off-hand, or clearing the main hand. Does not craft, fetch, or drop items.";

export const unequipInputSchema = z.strictObject({
  destinations: z
    .array(z.enum(EQUIPMENT_DESTINATIONS))
    .min(1)
    .max(EQUIPMENT_DESTINATIONS.length)
    .describe("Equipment slots to clear: hand, off-hand, head, torso, legs, feet."),
});

export interface UnequipRequest {
  readonly destinations: readonly EquipmentDestination[];
}

export function parseUnequipRequest(raw: unknown): UnequipRequest {
  const value = unequipInputSchema.parse(raw ?? {});
  return { destinations: [...new Set(value.destinations)] };
}

export const unequipEvidenceSchema = z.strictObject({
  cleared: z.array(
    z.strictObject({
      destination: z.enum(EQUIPMENT_DESTINATIONS),
      itemBefore: z.string().nullable(),
      cleared: z.boolean(),
      error: z.string().optional(),
    }),
  ),
  equipment: equipmentSlotsSchema,
});

export const unequipResultSchema = actionResultSchema({ unequip: unequipEvidenceSchema });
export type UnequipResult = z.output<typeof unequipResultSchema>;
export type UnequipOutput = ActionOutput<typeof UNEQUIP, UnequipResult>;

export const unequipAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;

export const unequipOutcomes = {
  rejected: (destination: string, cause: unknown) =>
    `[UNEQUIP_REJECTED] Mineflayer could not unequip ${destination}: ${cause instanceof Error ? cause.message : String(cause)}`,
  notCleared: (destination: string, item: string) =>
    `[UNEQUIP_NOT_CLEARED] ${destination} still contains ${item} after unequip.`,
  incomplete: (failed: number, total: number) =>
    `[UNEQUIP_INCOMPLETE] ${failed} of ${total} slot${total === 1 ? "" : "s"} could not be cleared.`,
} as const;
