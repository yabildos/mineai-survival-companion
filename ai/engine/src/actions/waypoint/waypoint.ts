import type { Bot } from "mineflayer";
import type { NavigationRuntime } from "../../navigation/index.js";
import { prepareBotForMovement } from "../../session/prepare-body.js";
import type { SqlBotData } from "../../bot-data/sql-bot-data.js";
import { defineAction, type ActionContext } from "../action.js";
import { navigate } from "../navigate/navigate.js";
import { createMovements } from "../../navigation/index.js";
import {
  WAYPOINT,
  WAYPOINT_DESCRIPTION,
  parseWaypointRequest,
  waypointAnnotations,
  waypointInputSchema,
  waypointResultSchema,
  type WaypointEntry,
  type WaypointRequest,
  type WaypointResult,
} from "./contract.js";

const PREFIX = "WAYPOINT ";
const DELETE_PREFIX = "WAYPOINT_DELETE ";

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function readWaypoints(data: SqlBotData): WaypointEntry[] {
  const rows = data.read(
    "SELECT note, remembered_at FROM notes WHERE note LIKE 'WAYPOINT %' OR note LIKE 'WAYPOINT_DELETE %' ORDER BY note_id ASC LIMIT 1000",
  );
  const active = new Map<string, WaypointEntry>();
  for (const row of rows) {
    const note = String(row.note);
    if (note.startsWith(DELETE_PREFIX)) {
      active.delete(normalize(note.slice(DELETE_PREFIX.length)));
      continue;
    }
    if (!note.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(note.slice(PREFIX.length)) as WaypointEntry;
      active.set(normalize(parsed.name), parsed);
    } catch {
      // Ignore malformed historical notes; the action should remain usable.
    }
  }
  return [...active.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function saveNote(data: SqlBotData, bot: Bot, note: string, context: string): void {
  const { x, y, z } = bot.entity.position;
  data.transaction((database) => {
    database.prepare(
      `INSERT INTO notes (bot_id, note, context, remembered_at, dimension, x, y, z, world_age_ticks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(bot.username, note, context, new Date().toISOString(), bot.game.dimension, x, y, z, bot.time.age ?? null);
  }, { name: "waypoint-note" });
}

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  data: SqlBotData,
  request: WaypointRequest,
  context: ActionContext,
): Promise<WaypointResult> {
  if (request.operation === "list") {
    return { status: "succeeded", waypoint: { operation: "list", selected: null, waypoints: readWaypoints(data), navigated: false } };
  }
  if (request.operation === "save") {
    const position = bot.entity.position.floored();
    const entry: WaypointEntry = {
      name: request.name!,
      dimension: request.dimension ?? bot.game.dimension,
      position: { x: request.x ?? position.x, y: request.y ?? position.y, z: request.z ?? position.z },
      description: request.description,
      updatedAt: new Date().toISOString(),
    };
    saveNote(data, bot, `${PREFIX}${JSON.stringify(entry)}`, `Saved waypoint ${entry.name}.`);
    return { status: "succeeded", waypoint: { operation: "save", selected: entry, waypoints: readWaypoints(data), navigated: false } };
  }
  if (request.operation === "delete") {
    const before = readWaypoints(data);
    const selected = before.find((entry) => normalize(entry.name) === normalize(request.name!)) ?? null;
    saveNote(data, bot, `${DELETE_PREFIX}${request.name!}`, `Deleted waypoint ${request.name!}.`);
    return { status: "succeeded", waypoint: { operation: "delete", selected, waypoints: readWaypoints(data), navigated: false } };
  }

  const waypoints = readWaypoints(data);
  const selected = waypoints.find((entry) => normalize(entry.name) === normalize(request.name!)) ?? null;
  if (!selected) {
    return { status: "failed", error: `[WAYPOINT_NOT_FOUND] No waypoint named ${request.name!}.`, waypoint: { operation: "go", selected: null, waypoints, navigated: false } };
  }
  if (selected.dimension !== bot.game.dimension) {
    return { status: "failed", error: `[WAYPOINT_DIMENSION_MISMATCH] Waypoint ${selected.name} is in ${selected.dimension}, but MineAI is in ${bot.game.dimension}.`, waypoint: { operation: "go", selected, waypoints, navigated: false } };
  }
  const route = await navigate(
    bot,
    { ...selected.position, range: request.range, dig: true, scaffold: true, build: false },
    context,
    { createMovements, navigate: navigation.navigate },
  );
  return route.status === "succeeded"
    ? { status: "succeeded", waypoint: { operation: "go", selected, waypoints, navigated: true } }
    : { status: "partial", error: route.error, waypoint: { operation: "go", selected, waypoints, navigated: false } };
}

export function formatWaypointResult(result: WaypointResult): string {
  const w = result.waypoint;
  const selected = w.selected ? `${w.selected.name} @ ${w.selected.dimension} ${w.selected.position.x},${w.selected.position.y},${w.selected.position.z}` : "none";
  return `Waypoint ${w.operation}: ${result.status}. Selected: ${selected}. Stored: ${w.waypoints.length}. Navigated: ${w.navigated ? "yes" : "no"}${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createWaypointAction(bot: Bot, navigation: NavigationRuntime, data: SqlBotData) {
  return defineAction({
    name: WAYPOINT,
    description: WAYPOINT_DESCRIPTION,
    inputSchema: waypointInputSchema,
    resultSchema: waypointResultSchema,
    formatResult: formatWaypointResult,
    execution: { kind: "task", prepare: () => prepareBotForMovement(bot, navigation) },
    annotations: waypointAnnotations,
    parse: parseWaypointRequest,
    execute: (request, context) => run(bot, navigation, data, request, context),
  });
}
