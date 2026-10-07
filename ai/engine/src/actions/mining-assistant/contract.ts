import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { registryNameSchema } from "../registry-name.js";
import { toolSnapshotSchema } from "../../world/tool-tiers.js";

export const MINING_ASSISTANT = "mining_assistant" as const;
export const MINING_ASSISTANT_DESCRIPTION =
  "Small mining safety assistant. It can inspect whether MineAI is ready for mining, mine one bounded safe batch, or navigate toward a loaded surface/upper exit. Use it instead of huge ore requests that can break the pickaxe or strand the bot underground.";

export const MINING_ASSISTANT_OPERATIONS = ["inspect_loadout", "safe_mine_batch", "return_to_surface"] as const;

export const miningAssistantInputSchema = z.strictObject({
  operation: z.enum(MINING_ASSISTANT_OPERATIONS).default("inspect_loadout"),
  block_name: registryNameSchema.optional().describe("Block selector for safe_mine_batch, such as diamond_ore, iron_ore, ancient_debris, stone."),
  count: z.number().int().min(1).max(32).default(8),
  min_pickaxe_durability_reserve: z.number().int().min(0).max(256).default(32),
  require_food: z.boolean().default(true),
  require_blocks: z.boolean().default(true),
});

export type MiningAssistantInput = z.input<typeof miningAssistantInputSchema>;
export type MiningAssistantOperation = z.output<typeof miningAssistantInputSchema>["operation"];

export interface MiningAssistantRequest {
  readonly operation: MiningAssistantOperation;
  readonly blockName: string | null;
  readonly count: number;
  readonly minPickaxeDurabilityReserve: number;
  readonly requireFood: boolean;
  readonly requireBlocks: boolean;
}

export function parseMiningAssistantRequest(raw: unknown): MiningAssistantRequest {
  const value = miningAssistantInputSchema.parse(raw ?? {});
  if (value.operation === "safe_mine_batch" && !value.block_name) throw new Error("block_name is required for safe_mine_batch.");
  return {
    operation: value.operation,
    blockName: value.block_name ?? null,
    count: value.count,
    minPickaxeDurabilityReserve: value.min_pickaxe_durability_reserve,
    requireFood: value.require_food,
    requireBlocks: value.require_blocks,
  };
}

export const miningAssistantReportSchema = z.strictObject({
  operation: z.enum(MINING_ASSISTANT_OPERATIONS),
  dimension: z.string(),
  position: z.strictObject({ x: z.number(), y: z.number(), z: z.number() }),
  freeSlots: z.number().int().nonnegative(),
  foodPoints: z.number().int().nonnegative(),
  health: z.number().nonnegative(),
  tools: toolSnapshotSchema,
  supplies: z.record(z.string(), z.number().int().nonnegative()),
  ready: z.boolean(),
  blockers: z.array(z.string()),
  action: z.string(),
});

export const miningAssistantResultSchema = actionResultSchema({ mining: miningAssistantReportSchema });
export type MiningAssistantResult = z.output<typeof miningAssistantResultSchema>;
export type MiningAssistantOutput = ActionOutput<typeof MINING_ASSISTANT, MiningAssistantResult>;

export const miningAssistantAnnotations = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;
