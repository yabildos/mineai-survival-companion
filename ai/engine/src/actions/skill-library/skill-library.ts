import type { Bot } from "mineflayer";
import type { SqlBotData } from "../../bot-data/sql-bot-data.js";
import { defineAction } from "../action.js";
import { markdownCodeBlock } from "../markdown.js";
import {
  SKILL_LIBRARY,
  SKILL_LIBRARY_DESCRIPTION,
  parseSkillLibraryRequest,
  skillLibraryAnnotations,
  skillLibraryInputSchema,
  skillLibraryResultSchema,
  type SkillLibraryRequest,
  type SkillLibraryResult,
} from "./contract.js";

function ensureSchema(data: SqlBotData): void {
  data.withWritableDatabase((db) => db.exec(`
    CREATE TABLE IF NOT EXISTS skills (skill_id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, tags_json TEXT NOT NULL CHECK (json_valid(tags_json)), tool_sequence_json TEXT NOT NULL CHECK (json_valid(tool_sequence_json)), success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0), failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0), source TEXT NOT NULL CHECK (source IN ('executor_verified','planner','user')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(bot_id, name)) STRICT;
    CREATE INDEX IF NOT EXISTS skills_by_bot_updated ON skills (bot_id, updated_at DESC);
  `), { name: "skill-library-schema" });
}

function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== "string") return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function skill(row: Record<string, unknown>) {
  return {
    skillId: Number(row.skill_id),
    name: String(row.name),
    description: String(row.description),
    tags: parseJsonArray(row.tags_json).map(String),
    toolSequence: parseJsonArray(row.tool_sequence_json) as never,
    successCount: Number(row.success_count),
    failureCount: Number(row.failure_count),
    source: row.source as never,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function readById(data: SqlBotData, botId: string, id: number) {
  return data.read("SELECT * FROM skills WHERE bot_id = ? AND skill_id = ?", botId, id).map(skill);
}

async function run(bot: Bot, data: SqlBotData, request: SkillLibraryRequest): Promise<SkillLibraryResult> {
  ensureSchema(data);
  const now = new Date().toISOString();
  const botId = bot.username;
  if (request.operation === "save") {
    const id = data.transaction((db) => {
      const row = db.prepare(`
        INSERT INTO skills (bot_id,name,description,tags_json,tool_sequence_json,success_count,failure_count,source,created_at,updated_at)
        VALUES (?,?,?,?,?,0,0,?,?,?)
        ON CONFLICT(bot_id, name) DO UPDATE SET description=excluded.description, tags_json=excluded.tags_json,
          tool_sequence_json=excluded.tool_sequence_json, source=excluded.source, updated_at=excluded.updated_at
        RETURNING skill_id
      `).get(botId, request.name!, request.description!, JSON.stringify(request.tags), JSON.stringify(request.tool_sequence), request.source, now, now) as { skill_id: number };
      return row.skill_id;
    }, { name: "skill-library-save" });
    return { status: "succeeded", library: { operation: request.operation, skills: readById(data, botId, id) } };
  }
  if (request.operation === "find") {
    const like = `%${request.query!.toLowerCase()}%`;
    const skills = data.read(
      "SELECT * FROM skills WHERE bot_id = ? AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags_json) LIKE ?) ORDER BY success_count DESC, updated_at DESC LIMIT ?",
      botId, like, like, like, request.limit,
    ).map(skill);
    return { status: "succeeded", library: { operation: request.operation, skills } };
  }
  if (request.operation === "record_result") {
    data.transaction((db) => db.prepare(`UPDATE skills SET ${request.succeeded === false ? "failure_count = failure_count + 1" : "success_count = success_count + 1"}, updated_at = ? WHERE bot_id = ? AND skill_id = ?`)
      .run(now, botId, request.skill_id!), { name: "skill-library-result" });
    return { status: "succeeded", library: { operation: request.operation, skills: readById(data, botId, request.skill_id!) } };
  }
  data.transaction((db) => {
    if (request.skill_id) db.prepare("DELETE FROM skills WHERE bot_id = ? AND skill_id = ?").run(botId, request.skill_id);
    else db.prepare("DELETE FROM skills WHERE bot_id = ? AND name = ?").run(botId, request.name!);
  }, { name: "skill-library-delete" });
  return { status: "succeeded", library: { operation: request.operation, skills: [] } };
}

export function createSkillLibraryAction(bot: Bot, data: SqlBotData) {
  return defineAction({
    name: SKILL_LIBRARY,
    description: SKILL_LIBRARY_DESCRIPTION,
    inputSchema: skillLibraryInputSchema,
    resultSchema: skillLibraryResultSchema,
    formatResult: (result) => `Skill library ${result.library.operation}: ${result.status}\n\n${markdownCodeBlock(JSON.stringify(result.library, null, 2))}`,
    execution: { kind: "task" },
    annotations: skillLibraryAnnotations,
    parse: parseSkillLibraryRequest,
    execute: (request) => run(bot, data, request),
  });
}
