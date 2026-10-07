import type { Bot } from "mineflayer";
import type { SqlBotData } from "../../bot-data/sql-bot-data.js";
import { defineAction } from "../action.js";
import {
  TRAIL_MEMORY,
  TRAIL_MEMORY_DESCRIPTION,
  parseTrailMemoryRequest,
  trailMemoryAnnotations,
  trailMemoryInputSchema,
  trailMemoryResultSchema,
  type TrailMemoryRequest,
  type TrailMemoryResult,
} from "./contract.js";

function ensureSchema(data: SqlBotData): void {
  data.withWritableDatabase((db) => db.exec(`
    CREATE TABLE IF NOT EXISTS trail_marks (mark_id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('breadcrumb','hazard','exit','resource','death','stuck')), dimension TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS trail_marks_by_bot ON trail_marks (bot_id, mark_id DESC);
  `), { name: "trail-memory-schema" });
}

function mark(row: Record<string, unknown>) {
  return {
    markId: Number(row.mark_id),
    label: String(row.label),
    kind: row.kind as never,
    dimension: String(row.dimension),
    x: Number(row.x),
    y: Number(row.y),
    z: Number(row.z),
    note: String(row.note),
    createdAt: String(row.created_at),
  };
}

function readMarks(data: SqlBotData, botId: string, request: TrailMemoryRequest) {
  return request.kind
    ? data.read("SELECT * FROM trail_marks WHERE bot_id = ? AND kind = ? ORDER BY mark_id DESC LIMIT ?", botId, request.kind, request.limit).map(mark)
    : data.read("SELECT * FROM trail_marks WHERE bot_id = ? ORDER BY mark_id DESC LIMIT ?", botId, request.limit).map(mark);
}

async function run(bot: Bot, data: SqlBotData, request: TrailMemoryRequest): Promise<TrailMemoryResult> {
  ensureSchema(data);
  const botId = bot.username;
  if (request.operation === "clear") {
    data.transaction((db) => request.kind
      ? db.prepare("DELETE FROM trail_marks WHERE bot_id = ? AND kind = ?").run(botId, request.kind)
      : db.prepare("DELETE FROM trail_marks WHERE bot_id = ?").run(botId), { name: "trail-memory-clear" });
    return { status: "succeeded", trail: { operation: "clear", marks: [] } };
  }
  if (request.operation === "mark") {
    const { x, y, z } = bot.entity.position;
    data.transaction((db) => db.prepare("INSERT INTO trail_marks (bot_id,label,kind,dimension,x,y,z,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(botId, request.label!, request.kind!, bot.game.dimension, x, y, z, request.note!, new Date().toISOString()), { name: "trail-memory-mark" });
  }
  return { status: "succeeded", trail: { operation: request.operation, marks: readMarks(data, botId, request) } };
}

export function formatTrailMemoryResult(result: TrailMemoryResult): string {
  const lines = [`Trail memory ${result.trail.operation}: ${result.trail.marks.length} mark(s).`];
  for (const m of result.trail.marks) lines.push(`- #${m.markId} ${m.kind} ${m.label} @ ${m.dimension} ${m.x.toFixed(1)},${m.y.toFixed(1)},${m.z.toFixed(1)}: ${m.note}`);
  return lines.join("\n");
}

export function createTrailMemoryAction(bot: Bot, data: SqlBotData) {
  return defineAction({
    name: TRAIL_MEMORY,
    description: TRAIL_MEMORY_DESCRIPTION,
    inputSchema: trailMemoryInputSchema,
    resultSchema: trailMemoryResultSchema,
    formatResult: formatTrailMemoryResult,
    execution: { kind: "task" },
    annotations: trailMemoryAnnotations,
    parse: parseTrailMemoryRequest,
    execute: (request) => run(bot, data, request),
  });
}
