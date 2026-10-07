import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { defineAction } from "../action.js";
import {
  SCENE_SNAPSHOT,
  SCENE_SNAPSHOT_DESCRIPTION,
  parseSceneSnapshotRequest,
  sceneSnapshotAnnotations,
  sceneSnapshotInputSchema,
  sceneSnapshotResultSchema,
  type SceneSnapshotRequest,
  type SceneSnapshotResult,
} from "./contract.js";

const HOSTILES = new Set(["zombie", "skeleton", "creeper", "spider", "enderman", "witch", "blaze", "slime", "magma_cube", "hoglin", "phantom", "drowned"]);

function round(value: number): number {
  return Number(value.toFixed(2));
}

function pos(value: { x: number; y: number; z: number }) {
  return { x: round(value.x), y: round(value.y), z: round(value.z) };
}

function entities(bot: Bot, radius: number, kind: "player" | "hostile" | "item") {
  return Object.values(bot.entities ?? {})
    .filter((entity) => entity?.isValid && entity.position && entity.id !== bot.entity.id)
    .filter((entity) => {
      if (kind === "player") return entity.name === "player";
      if (kind === "item") return entity.name === "item";
      return Boolean(entity.name && HOSTILES.has(entity.name));
    })
    .map((entity) => ({ name: entity.name ?? "unknown", distance: round(entity.position.distanceTo(bot.entity.position)), position: pos(entity.position) }))
    .filter((entity) => entity.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);
}

function run(bot: Bot, request: SceneSnapshotRequest): SceneSnapshotResult {
  const feet = bot.entity.position.floored();
  const offsets = [
    new Vec3(0, -1, 0), new Vec3(0, 0, 0), new Vec3(0, 1, 0),
    new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1),
  ];
  const looked = bot.blockAtCursor(32);
  return {
    status: "succeeded",
    scene: {
      dimension: bot.game.dimension,
      position: pos(bot.entity.position),
      yaw: round(bot.entity.yaw),
      pitch: round(bot.entity.pitch),
      lookingAt: looked ? { name: looked.name, position: pos(looked.position) } : null,
      blocks: offsets.map((offset) => {
        const at = feet.plus(offset);
        return { offset: `${offset.x},${offset.y},${offset.z}`, name: bot.blockAt(at)?.name ?? null };
      }),
      players: entities(bot, request.radius, "player"),
      hostiles: entities(bot, request.radius, "hostile"),
      items: entities(bot, request.radius, "item"),
    },
  };
}

export function formatSceneSnapshotResult(result: SceneSnapshotResult): string {
  const s = result.scene;
  return [
    `Scene at ${s.position.x}, ${s.position.y}, ${s.position.z} in ${s.dimension}; looking at ${s.lookingAt ? `${s.lookingAt.name} ${s.lookingAt.position.x},${s.lookingAt.position.y},${s.lookingAt.position.z}` : "nothing"}.`,
    `Blocks: ${s.blocks.map((b) => `${b.offset}:${b.name ?? "unloaded"}`).join("; ")}`,
    `Players: ${s.players.map((e) => `${e.name}@${e.distance}`).join(", ") || "none"}. Hostiles: ${s.hostiles.map((e) => `${e.name}@${e.distance}`).join(", ") || "none"}. Items: ${s.items.map((e) => `${e.name}@${e.distance}`).join(", ") || "none"}.`,
  ].join("\n");
}

export function createSceneSnapshotAction(bot: Bot) {
  return defineAction({
    name: SCENE_SNAPSHOT,
    description: SCENE_SNAPSHOT_DESCRIPTION,
    inputSchema: sceneSnapshotInputSchema,
    resultSchema: sceneSnapshotResultSchema,
    formatResult: formatSceneSnapshotResult,
    execution: { kind: "information" },
    annotations: sceneSnapshotAnnotations,
    parse: parseSceneSnapshotRequest,
    execute: (request) => Promise.resolve(run(bot, request)),
  });
}
