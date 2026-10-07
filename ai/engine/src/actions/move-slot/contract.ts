import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const MOVE_SLOT = "move_slot" as const;
export const MOVE_SLOT_DESCRIPTION =
  "Move or swap exact player inventory/window slots. Use for precise inventory cleanup after get_inventory/view_status. Refuses while a container window is open unless allow_window is true.";

export const moveSlotInputSchema = z.strictObject({
  from_slot: z.number().int().min(0).max(90),
  to_slot: z.number().int().min(0).max(90),
  allow_window: z.boolean().default(false),
});

export type MoveSlotRequest = z.output<typeof moveSlotInputSchema>;
export function parseMoveSlotRequest(raw: unknown): MoveSlotRequest {
  const value = moveSlotInputSchema.parse(raw ?? {});
  if (value.from_slot === value.to_slot) throw new Error("from_slot and to_slot must differ.");
  return value;
}

export const moveSlotResultSchema = actionResultSchema({
  move: z.strictObject({
    fromSlot: z.number().int(),
    toSlot: z.number().int(),
    itemBefore: z.string().nullable(),
    fromAfter: z.string().nullable(),
    toAfter: z.string().nullable(),
  }),
});
export type MoveSlotResult = z.output<typeof moveSlotResultSchema>;
export type MoveSlotOutput = ActionOutput<typeof MOVE_SLOT, MoveSlotResult>;

export const moveSlotAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;
