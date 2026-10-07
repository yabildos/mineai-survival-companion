import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MOB_AGES } from "../../world/mob-age.js";
import { actionResultSchema, type ActionOutput } from "../action.js";
import { registryNameSchema } from "../registry-name.js";
import { MOB_KINDS } from "../view-status/contract.js";

export const GET_ENTITIES = "get_entities" as const;
export const GET_ENTITIES_DESCRIPTION =
  "List loaded entities without moving. Filter by entity names, entity kinds, maximum distance, or include the bot itself. Use this to select exact entity IDs for interaction, combat, bartering, pickup, following or debugging loaded mobs/items.";

export const entityKinds = [...MOB_KINDS, "player", "item", "projectile", "object", "other"] as const;

export const getEntitiesInputSchema = z.strictObject({
  names: z.array(registryNameSchema).min(1).max(16).optional().describe("Entity registry names, such as piglin, sheep, item, enderman, ender_dragon."),
  kinds: z.array(z.enum(entityKinds)).min(1).max(entityKinds.length).optional().describe("Entity categories to include."),
  max_distance: z.number().positive().max(512).optional().describe("Maximum distance in blocks from MineAI."),
  limit: z.number().int().min(1).max(128).default(32).describe("Maximum entities to return, nearest first."),
  include_self: z.boolean().default(false).describe("Whether to include MineAI's own player entity."),
});

export type GetEntitiesRequest = z.output<typeof getEntitiesInputSchema>;

export function parseGetEntitiesRequest(raw: unknown): GetEntitiesRequest {
  return getEntitiesInputSchema.parse(raw ?? {});
}

const positionSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number() });

export const entityObservationSchema = z.strictObject({
  entityId: z.number().int(),
  name: z.string(),
  displayName: z.string().nullable(),
  kind: z.enum(entityKinds),
  distance: z.number().nonnegative(),
  position: positionSchema,
  age: z.enum(MOB_AGES).nullable(),
  health: z.number().nullable(),
  username: z.string().nullable(),
  heldItem: z.string().nullable(),
  droppedItem: z.strictObject({ name: z.string(), count: z.number().int().positive() }).nullable(),
});

export const getEntitiesEvidenceSchema = z.strictObject({
  dimension: z.string(),
  origin: positionSchema,
  totalLoaded: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  listed: z.array(entityObservationSchema),
});

export const getEntitiesResultSchema = actionResultSchema({ entities: getEntitiesEvidenceSchema });
export type EntityObservation = z.output<typeof entityObservationSchema>;
export type GetEntitiesResult = z.output<typeof getEntitiesResultSchema>;
export type GetEntitiesOutput = ActionOutput<typeof GET_ENTITIES, GetEntitiesResult>;

export const getEntitiesAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;

