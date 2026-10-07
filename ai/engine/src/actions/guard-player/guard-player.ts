import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { createMovements, type NavigationRuntime } from "../../navigation/index.js";
import type { CombatController } from "../../survival/index.js";
import { Budgets } from "../../survival/state/budgets.js";
import { createDiscardedItems, type DiscardedItems } from "../../world/discarded-items.js";
import { defineAction, type ActionContext } from "../action.js";
import { huntMob, huntMobDependencies } from "../hunt-mob/hunt-mob.js";
import { navigate } from "../navigate/navigate.js";
import {
  GUARD_PLAYER,
  GUARD_PLAYER_DESCRIPTION,
  guardPlayerAnnotations,
  guardPlayerInputSchema,
  guardPlayerResultSchema,
  parseGuardPlayerRequest,
  type GuardPlayerRequest,
  type GuardPlayerResult,
} from "./contract.js";

const COMMON_THREAT_DROPS = new Map<string, string>([
  ["zombie", "rotten_flesh"],
  ["skeleton", "bone"],
  ["creeper", "gunpowder"],
  ["spider", "string"],
  ["enderman", "ender_pearl"],
  ["blaze", "blaze_rod"],
  ["witch", "glowstone_dust"],
  ["slime", "slime_ball"],
]);

function round(value: number): number {
  return Number(value.toFixed(2));
}

function targetPlayer(bot: Bot, username: string | undefined) {
  if (username) return bot.players[username]?.entity ?? null;
  return Object.values(bot.players ?? {})
    .map((player) => player.entity)
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity?.isValid && entity.id !== bot.entity.id))
    .sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position))[0] ?? null;
}

function usernameFor(bot: Bot, entityId: number): string | null {
  for (const player of Object.values(bot.players ?? {})) if (player.entity?.id === entityId) return player.username;
  return null;
}

function nearestThreat(bot: Bot, playerPosition: Vec3, radius: number) {
  return Object.values(bot.entities ?? {})
    .filter((entity) => entity?.isValid && entity.position && entity.name && COMMON_THREAT_DROPS.has(entity.name))
    .map((entity) => ({ entity, distance: entity.position.distanceTo(playerPosition) }))
    .filter((entry) => entry.distance <= radius)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  combat: CombatController,
  discarded: DiscardedItems,
  budgets: Budgets,
  request: GuardPlayerRequest,
  context: ActionContext,
): Promise<GuardPlayerResult> {
  const player = targetPlayer(bot, request.username);
  if (!player) {
    return {
      status: "failed",
      error: "[GUARD_PLAYER_NOT_LOADED] No requested or nearby player is loaded.",
      guard: { guardedPlayer: request.username ?? null, followed: false, threat: null, engaged: false, summary: "player not loaded" },
    };
  }
  const guardedPlayer = usernameFor(bot, player.id) ?? request.username ?? null;
  let followed = false;
  if (bot.entity.position.distanceTo(player.position) > request.follow_distance) {
    const feet = player.position.floored();
    await navigate(
      bot,
      { x: feet.x, y: feet.y, z: feet.z, range: request.follow_distance, dig: false, scaffold: true, build: false },
      context,
      { createMovements, navigate: navigation.navigate },
    );
    followed = true;
  }

  const threat = nearestThreat(bot, player.position, request.threat_radius);
  if (!threat) {
    return {
      status: "succeeded",
      guard: { guardedPlayer, followed, threat: null, engaged: false, summary: "no common hostile threat loaded nearby" },
    };
  }

  const name = threat.entity.name!;
  const drop = COMMON_THREAT_DROPS.get(name)!;
  const hunt = await huntMob(
    bot,
    { mobName: name, dropName: drop, count: 1, observeForMs: 0, campSpawner: false, allowWithoutShield: false },
    context,
    huntMobDependencies(bot, navigation, combat, discarded),
  );
  const evidence = {
    guardedPlayer,
    followed,
    threat: {
      name,
      distance: round(threat.distance),
      position: { x: round(threat.entity.position.x), y: round(threat.entity.position.y), z: round(threat.entity.position.z) },
    },
    engaged: hunt.status === "succeeded" || hunt.status === "partial",
    summary: hunt.status === "succeeded" ? "threat engaged" : hunt.error,
  };
  return hunt.status === "failed"
    ? { status: "partial", error: hunt.error, guard: evidence }
    : { status: "succeeded", guard: evidence };
}

export function formatGuardPlayerResult(result: GuardPlayerResult): string {
  const g = result.guard;
  return `Guard ${g.guardedPlayer ?? "nearest player"}: ${result.status}. Followed: ${g.followed ? "yes" : "no"}; threat: ${g.threat ? `${g.threat.name} at ${g.threat.distance} blocks` : "none"}; engaged: ${g.engaged ? "yes" : "no"}. ${g.summary}`;
}

export function createGuardPlayerAction(
  bot: Bot,
  navigation: NavigationRuntime,
  combat: CombatController,
  discarded: DiscardedItems = createDiscardedItems(),
  budgets = new Budgets(),
) {
  return defineAction({
    name: GUARD_PLAYER,
    description: GUARD_PLAYER_DESCRIPTION,
    inputSchema: guardPlayerInputSchema,
    resultSchema: guardPlayerResultSchema,
    formatResult: formatGuardPlayerResult,
    execution: { kind: "task" },
    annotations: guardPlayerAnnotations,
    parse: parseGuardPlayerRequest,
    execute: (request, context) => run(bot, navigation, combat, discarded, budgets, request, context),
  });
}
