import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import type { SqlBotData } from "../../bot-data/sql-bot-data.js";
import { createMovements, type NavigationRuntime } from "../../navigation/index.js";
import { prepareBotForMovement } from "../../session/prepare-body.js";
import { knownPlayerLocationFromData, rememberPlayerLocationInData } from "../../world/player-locations.js";
import { defineAction, type ActionContext } from "../action.js";
import { navigate } from "../navigate/navigate.js";
import {
  FOLLOW_PLAYER,
  FOLLOW_PLAYER_DESCRIPTION,
  followPlayerAnnotations,
  followPlayerInputSchema,
  followPlayerOutcomes,
  followPlayerResultSchema,
  parseFollowPlayerRequest,
  type FollowPlayerRequest,
  type FollowPlayerResult,
} from "./contract.js";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function position(value: { x: number; y: number; z: number }) {
  return { x: round(value.x), y: round(value.y), z: round(value.z) };
}

function targetPlayer(bot: Bot, username: string | undefined) {
  if (username) return bot.players[username]?.entity ?? null;
  const candidates = Object.values(bot.players ?? {})
    .map((player) => player.entity)
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity?.isValid && entity.id !== bot.entity.id));
  candidates.sort((left, right) => left.position.distanceTo(bot.entity.position) - right.position.distanceTo(bot.entity.position));
  return candidates[0] ?? null;
}

function usernameFor(bot: Bot, entityId: number): string | null {
  for (const player of Object.values(bot.players ?? {})) {
    if (player.entity?.id === entityId) return player.username;
  }
  return null;
}

// Mineflayer removes an entity when a player leaves the bot's tracking range.
// Keep the last observed position so a follow request can walk back into that
// area and reacquire the live entity instead of failing immediately.

async function waitTicks(bot: Bot, ticks: number, signal?: AbortSignal): Promise<number> {
  let waited = 0;
  for (; waited < ticks; waited += 1) {
    signal?.throwIfAborted();
    await bot.waitForTicks(1);
  }
  return waited;
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  data: SqlBotData,
  request: FollowPlayerRequest,
  context: ActionContext,
): Promise<FollowPlayerResult> {
  const start = position(bot.entity.position);
  let elapsed = 0;
  let checks = 0;
  let navigations = 0;
  let followedUsername: string | null = request.username ?? null;
  let lastPlayerPosition: ReturnType<typeof position> | null = null;
  let lastDistance: number | null = null;

  while (elapsed < request.duration_ticks) {
    context.signal?.throwIfAborted();
    const player = targetPlayer(bot, request.username);
    checks += 1;
    if (!player) {
      const known = request.username ? knownPlayerLocationFromData(data, request.username, bot.game.dimension) : null;
      const fresh = known;
      if (fresh) {
        navigations += 1;
        const route = await navigate(
          bot,
          { ...known.position, x: Math.floor(known.position.x), y: Math.floor(known.position.y), z: Math.floor(known.position.z), range: request.follow_distance, dig: request.dig, scaffold: request.scaffold, build: false },
          context,
          { createMovements, navigate: navigation.navigate },
        );
        elapsed += 1;
        if (route.status === "failed" || route.status === "cancelled") {
          const knownPosition = new Vec3(known.position.x, known.position.y, known.position.z);
          const evidence = { username: followedUsername, requestedUsername: request.username ?? null, durationTicks: elapsed, checks, navigations, start, end: position(bot.entity.position), lastPlayerPosition: position(known.position), lastDistance: round(bot.entity.position.distanceTo(knownPosition)) };
          return { status: "partial", error: followPlayerOutcomes.navigationStopped(route.error), follow: evidence };
        }
        continue;
      }
      const evidence = {
        username: followedUsername,
        requestedUsername: request.username ?? null,
        durationTicks: elapsed,
        checks,
        navigations,
        start,
        end: position(bot.entity.position),
        lastPlayerPosition,
        lastDistance,
      };
      return { status: elapsed > 0 ? "partial" : "failed", error: followPlayerOutcomes.noPlayer(request.username), follow: evidence };
    }

    followedUsername = usernameFor(bot, player.id) ?? followedUsername;
    lastPlayerPosition = position(player.position);
    if (followedUsername) rememberPlayerLocationInData(data, followedUsername, lastPlayerPosition, bot.game.dimension);
    lastDistance = round(player.position.distanceTo(bot.entity.position));
    if (lastDistance <= request.follow_distance) {
      elapsed += await waitTicks(bot, Math.min(request.repath_ticks, request.duration_ticks - elapsed), context.signal);
      continue;
    }

    navigations += 1;
    const target = player.position.floored();
    const route = await navigate(
      bot,
      {
        x: target.x,
        y: target.y,
        z: target.z,
        range: request.follow_distance,
        dig: request.dig,
        scaffold: request.scaffold,
        build: false,
      },
      context,
      { createMovements, navigate: navigation.navigate },
    );
    elapsed += 1;
    if (route.status === "failed" || route.status === "cancelled") {
      const evidence = {
        username: followedUsername,
        requestedUsername: request.username ?? null,
        durationTicks: elapsed,
        checks,
        navigations,
        start,
        end: position(bot.entity.position),
        lastPlayerPosition,
        lastDistance,
      };
      return { status: "partial", error: followPlayerOutcomes.navigationStopped(route.error), follow: evidence };
    }
  }

  const evidence = {
    username: followedUsername,
    requestedUsername: request.username ?? null,
    durationTicks: elapsed,
    checks,
    navigations,
    start,
    end: position(bot.entity.position),
    lastPlayerPosition,
    lastDistance,
  };
  return { status: "succeeded", follow: evidence };
}

export function formatFollowPlayerResult(result: FollowPlayerResult): string {
  const { follow } = result;
  const target = follow.username ?? follow.requestedUsername ?? "nearest loaded player";
  const lines = [
    `Followed ${target} for ${follow.durationTicks} ticks.`,
    `Checks: ${follow.checks}; navigations: ${follow.navigations}; last distance: ${follow.lastDistance ?? "unknown"}.`,
    `Start: ${follow.start.x}, ${follow.start.y}, ${follow.start.z}; end: ${follow.end.x}, ${follow.end.y}, ${follow.end.z}.`,
  ];
  if (follow.lastPlayerPosition) {
    lines.push(`Last player position: ${follow.lastPlayerPosition.x}, ${follow.lastPlayerPosition.y}, ${follow.lastPlayerPosition.z}.`);
  }
  if (result.status !== "succeeded") lines.push(`Observed stop: ${result.error}`);
  return lines.join("\n");
}

export function createFollowPlayerAction(bot: Bot, navigation: NavigationRuntime, data: SqlBotData) {
  return defineAction({
    name: FOLLOW_PLAYER,
    description: FOLLOW_PLAYER_DESCRIPTION,
    inputSchema: followPlayerInputSchema,
    resultSchema: followPlayerResultSchema,
    formatResult: formatFollowPlayerResult,
    execution: { kind: "task", prepare: () => prepareBotForMovement(bot, navigation) },
    annotations: followPlayerAnnotations,
    parse: parseFollowPlayerRequest,
    execute: (request, context) => run(bot, navigation, data, request, context),
  });
}
