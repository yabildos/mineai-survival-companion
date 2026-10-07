import type { Bot } from "mineflayer";
import { entityHealth } from "../../world/end-fight.js";
import { observeMobAge } from "../../world/mob-age.js";
import { defineAction } from "../action.js";
import {
  GET_ENTITIES,
  GET_ENTITIES_DESCRIPTION,
  entityKinds,
  getEntitiesAnnotations,
  getEntitiesInputSchema,
  getEntitiesResultSchema,
  parseGetEntitiesRequest,
  type EntityObservation,
  type GetEntitiesRequest,
  type GetEntitiesResult,
} from "./contract.js";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function classify(bot: Bot, entity: NonNullable<Bot["entity"]>): (typeof entityKinds)[number] {
  if (entity.id === bot.entity.id || entity.name === "player") return "player";
  if (entity.name === "item") return "item";
  const registered = bot.registry.entities[entity.entityType ?? -1];
  if (registered?.type && entityKinds.includes(registered.type as (typeof entityKinds)[number])) {
    return registered.type as (typeof entityKinds)[number];
  }
  if (["arrow", "spectral_arrow", "trident", "fireball", "small_fireball", "dragon_fireball", "snowball", "egg"].includes(entity.name ?? "")) {
    return "projectile";
  }
  return registered ? "object" : "other";
}

function username(bot: Bot, entityId: number): string | null {
  for (const player of Object.values(bot.players ?? {})) {
    if (player.entity?.id === entityId) return player.username;
  }
  return null;
}

function observe(bot: Bot, request: GetEntitiesRequest): GetEntitiesResult {
  const origin = bot.entity.position;
  const names = request.names ? new Set(request.names) : null;
  const kinds = request.kinds ? new Set(request.kinds) : null;
  const all = Object.values(bot.entities ?? {}).filter((entity) => entity?.isValid && entity.position);
  const matched: EntityObservation[] = [];
  for (const entity of all) {
    if (!request.include_self && entity.id === bot.entity.id) continue;
    const kind = classify(bot, entity as NonNullable<Bot["entity"]>);
    const name = entity.name ?? bot.registry.entities[entity.entityType ?? -1]?.name ?? "unknown";
    if (names && !names.has(name)) continue;
    if (kinds && !kinds.has(kind)) continue;
    const distance = entity.position.distanceTo(origin);
    if (request.max_distance !== undefined && distance > request.max_distance) continue;
    const dropped = entity.name === "item" ? entity.getDroppedItem() : null;
    matched.push({
      entityId: entity.id,
      name,
      displayName: entity.displayName ?? null,
      kind,
      distance: round(distance, 2),
      position: { x: round(entity.position.x, 2), y: round(entity.position.y, 2), z: round(entity.position.z, 2) },
      age: kind === "animal" || kind === "passive" || kind === "hostile" || kind === "mob" ? observeMobAge(bot, entity) : null,
      health: entityHealth(bot, entity),
      username: username(bot, entity.id),
      heldItem: entity.equipment?.[0]?.name ?? null,
      droppedItem: dropped ? { name: dropped.name, count: dropped.count } : null,
    });
  }
  matched.sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name));
  return {
    status: "succeeded",
    entities: {
      dimension: bot.game.dimension,
      origin: { x: round(origin.x, 2), y: round(origin.y, 2), z: round(origin.z, 2) },
      totalLoaded: all.length,
      matched: matched.length,
      listed: matched.slice(0, request.limit),
    },
  };
}

export function formatGetEntitiesResult(result: GetEntitiesResult): string {
  const { entities } = result;
  const lines = [
    `Loaded entities in \`${entities.dimension}\`: ${entities.totalLoaded}; matched ${entities.matched}; listed ${entities.listed.length}.`,
  ];
  for (const entity of entities.listed) {
    const extras = [
      entity.username ? `player ${entity.username}` : null,
      entity.age,
      entity.health === null ? null : `health ${entity.health}`,
      entity.heldItem ? `holding ${entity.heldItem}` : null,
      entity.droppedItem ? `${entity.droppedItem.name} x${entity.droppedItem.count}` : null,
    ].filter(Boolean);
    lines.push(
      `- #${entity.entityId} ${entity.name} (${entity.kind}) at ${entity.position.x}, ${entity.position.y}, ${entity.position.z}; ${entity.distance} blocks${extras.length ? `; ${extras.join(", ")}` : ""}`,
    );
  }
  if (entities.listed.length === 0) lines.push("- none");
  return lines.join("\n");
}

export function createGetEntitiesAction(bot: Bot) {
  return defineAction({
    name: GET_ENTITIES,
    description: GET_ENTITIES_DESCRIPTION,
    inputSchema: getEntitiesInputSchema,
    resultSchema: getEntitiesResultSchema,
    formatResult: formatGetEntitiesResult,
    execution: { kind: "information" },
    annotations: getEntitiesAnnotations,
    parse: parseGetEntitiesRequest,
    execute: (request) => Promise.resolve(observe(bot, request)),
  });
}

