import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const LOADOUT_MANAGER = "loadout_manager" as const;
export const LOADOUT_MANAGER_DESCRIPTION =
  "Inspect whether the carried inventory fits a job profile and produce concrete missing/extra items. It does not move items by itself; use move_slot, use_container, craft_item, gather_resource or drop_item to apply the plan.";

export const LOADOUT_PROFILES = ["mining", "woodcutting", "travel", "combat", "base_work"] as const;
export const loadoutManagerInputSchema = z.strictObject({
  profile: z.enum(LOADOUT_PROFILES),
  strict: z.boolean().default(false).describe("When true, marks common junk as extras more aggressively."),
});
export type LoadoutManagerRequest = z.output<typeof loadoutManagerInputSchema>;
export function parseLoadoutManagerRequest(raw: unknown): LoadoutManagerRequest {
  return loadoutManagerInputSchema.parse(raw ?? {});
}

export const loadoutManagerResultSchema = actionResultSchema({
  loadout: z.strictObject({
    profile: z.enum(LOADOUT_PROFILES),
    ready: z.boolean(),
    freeSlots: z.number().int().nonnegative(),
    missing: z.array(z.string()),
    warnings: z.array(z.string()),
    extras: z.array(z.string()),
    suggestedActions: z.array(z.string()),
  }),
});
export type LoadoutManagerResult = z.output<typeof loadoutManagerResultSchema>;
export type LoadoutManagerOutput = ActionOutput<typeof LOADOUT_MANAGER, LoadoutManagerResult>;

export const loadoutManagerAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;
