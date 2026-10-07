import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { registryNameSchema } from "../registry-name.js";

export const DELIVER_ITEMS = "deliver_items" as const;
export const DELIVER_ITEMS_DESCRIPTION =
  "Deliver carried items to a player by walking close and tossing them at their feet. If the player is not loaded, walk to their last observed position (remembered for 30 minutes) and reacquire them first. A player never observed by this bot cannot be located without a reported coordinate. Use for handoffs instead of manual follow_player plus drop_item.";

export const deliverItemsInputSchema = z.strictObject({
  to_player: z.string().min(1).max(32).describe("Player username receiving the items."),
  items: z.array(z.strictObject({
    item_name: registryNameSchema,
    count: z.number().int().positive().optional(),
  })).min(1).max(12),
});

export type DeliverItemsRequest = z.output<typeof deliverItemsInputSchema>;

export function parseDeliverItemsRequest(raw: unknown): DeliverItemsRequest {
  return deliverItemsInputSchema.parse(raw ?? {});
}

export const deliverItemsEvidenceSchema = z.strictObject({
  toPlayer: z.string(),
  requestedItems: z.array(z.strictObject({ item: z.string(), count: z.number().int().positive().nullable() })),
  deliveredKinds: z.number().int().nonnegative(),
  failedKinds: z.number().int().nonnegative(),
});

export const deliverItemsResultSchema = actionResultSchema({ delivery: deliverItemsEvidenceSchema });
export type DeliverItemsResult = z.output<typeof deliverItemsResultSchema>;
export type DeliverItemsOutput = ActionOutput<typeof DELIVER_ITEMS, DeliverItemsResult>;

export const deliverItemsAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;
