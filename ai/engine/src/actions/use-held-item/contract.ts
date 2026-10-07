import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const USE_HELD_ITEM = "use_held_item" as const;
export const USE_HELD_ITEM_DESCRIPTION =
  "Start or stop using the currently held item, optionally from the off-hand, without selecting a different item. Use for shields, bows/crossbows, buckets or other right-click item behavior when a specialized tool is unnecessary.";

export const useHeldItemInputSchema = z.strictObject({
  operation: z.enum(["start", "stop"]).default("start"),
  hand: z.enum(["hand", "off-hand"]).default("hand"),
  hold_ticks: z.number().int().min(0).max(200).default(0).describe("Ticks to keep the item active before returning. For stop, this is ignored."),
});

export type UseHeldItemRequest = z.output<typeof useHeldItemInputSchema>;

export function parseUseHeldItemRequest(raw: unknown): UseHeldItemRequest {
  return useHeldItemInputSchema.parse(raw ?? {});
}

export const useHeldItemEvidenceSchema = z.strictObject({
  operation: z.enum(["start", "stop"]),
  hand: z.enum(["hand", "off-hand"]),
  itemBefore: z.string().nullable(),
  itemAfter: z.string().nullable(),
  usingBefore: z.boolean(),
  usingAfter: z.boolean(),
  heldTicks: z.number().int().nonnegative(),
});

export const useHeldItemResultSchema = actionResultSchema({ use: useHeldItemEvidenceSchema });
export type UseHeldItemResult = z.output<typeof useHeldItemResultSchema>;
export type UseHeldItemOutput = ActionOutput<typeof USE_HELD_ITEM, UseHeldItemResult>;

export const useHeldItemAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

