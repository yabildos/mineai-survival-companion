import type { Bot } from "mineflayer";
import type { SqlBotData } from "../../bot-data/sql-bot-data.js";
import { defineAction } from "../action.js";
import { markdownCodeBlock } from "../markdown.js";
import {
  TASK_JOURNAL,
  TASK_JOURNAL_DESCRIPTION,
  parseTaskJournalRequest,
  taskJournalAnnotations,
  taskJournalInputSchema,
  taskJournalResultSchema,
  type TaskJournalRequest,
  type TaskJournalResult,
} from "./contract.js";

function ensureSchema(data: SqlBotData): void {
  data.withWritableDatabase((db) => db.exec(`
    CREATE TABLE IF NOT EXISTS task_plans (plan_id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, title TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active','paused','completed','failed','abandoned')), source TEXT NOT NULL CHECK (source IN ('user','planner','executor_verified','observed')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS task_plans_by_bot_status ON task_plans (bot_id, status, plan_id DESC);
    CREATE TABLE IF NOT EXISTS task_steps (step_id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL, step_index INTEGER NOT NULL CHECK (step_index >= 0), description TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','active','completed','failed','skipped')), tool_hint TEXT, evidence_source TEXT NOT NULL CHECK (evidence_source IN ('user','planner','executor_verified','observed')), updated_at TEXT NOT NULL, FOREIGN KEY(plan_id) REFERENCES task_plans(plan_id) ON DELETE CASCADE) STRICT;
    CREATE INDEX IF NOT EXISTS task_steps_by_plan ON task_steps (plan_id, step_index);
    CREATE TABLE IF NOT EXISTS task_failures (failure_id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, step_id INTEGER, bot_id TEXT NOT NULL, failure_type TEXT NOT NULL CHECK (failure_type IN ('no_path','no_tool','tool_broke','inventory_full','player_unloaded','unsafe_lava','window_failed','stuck_loop','timeout','missing_resource','unknown')), summary TEXT NOT NULL, recovery TEXT NOT NULL, source TEXT NOT NULL CHECK (source IN ('executor_verified','observed','planner','user')), recorded_at TEXT NOT NULL, FOREIGN KEY(plan_id) REFERENCES task_plans(plan_id) ON DELETE SET NULL, FOREIGN KEY(step_id) REFERENCES task_steps(step_id) ON DELETE SET NULL) STRICT;
  `), { name: "task-journal-schema" });
}

function plan(row: Record<string, unknown>) {
  return { planId: Number(row.plan_id), title: String(row.title), goal: String(row.goal), status: row.status as never, source: row.source as never, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function step(row: Record<string, unknown>) {
  return { stepId: Number(row.step_id), planId: Number(row.plan_id), stepIndex: Number(row.step_index), description: String(row.description), status: row.status as never, toolHint: row.tool_hint === null ? null : String(row.tool_hint), evidenceSource: row.evidence_source as never, updatedAt: String(row.updated_at) };
}
function failure(row: Record<string, unknown>) {
  return { failureId: Number(row.failure_id), planId: row.plan_id === null ? null : Number(row.plan_id), stepId: row.step_id === null ? null : Number(row.step_id), failureType: row.failure_type as never, summary: String(row.summary), recovery: String(row.recovery), source: row.source as never, recordedAt: String(row.recorded_at) };
}

function readPlan(data: SqlBotData, planId: number, botId: string) {
  return data.read("SELECT * FROM task_plans WHERE plan_id = ? AND bot_id = ?", planId, botId).map(plan);
}
function readSteps(data: SqlBotData, planId: number) {
  return data.read("SELECT * FROM task_steps WHERE plan_id = ? ORDER BY step_index", planId).map(step);
}
function readFailures(data: SqlBotData, planId: number | null, botId: string) {
  return (planId
    ? data.read("SELECT * FROM task_failures WHERE plan_id = ? ORDER BY failure_id DESC LIMIT 20", planId)
    : data.read("SELECT * FROM task_failures WHERE bot_id = ? ORDER BY failure_id DESC LIMIT 20", botId)
  ).map(failure);
}

async function run(bot: Bot, data: SqlBotData, request: TaskJournalRequest): Promise<TaskJournalResult> {
  ensureSchema(data);
  const now = new Date().toISOString();
  const botId = bot.username;
  if (request.operation === "create_plan") {
    const planId = data.transaction((db) => {
      const row = db.prepare("INSERT INTO task_plans (bot_id,title,goal,status,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?) RETURNING plan_id")
        .get(botId, request.title!, request.goal!, "active", request.source, now, now) as { plan_id: number };
      const insert = db.prepare("INSERT INTO task_steps (plan_id,step_index,description,status,tool_hint,evidence_source,updated_at) VALUES (?,?,?,?,?,?,?)");
      request.steps!.forEach((s, i) => insert.run(row.plan_id, i, s.description, i === 0 ? "active" : "pending", s.tool_hint ?? null, s.source, now));
      return row.plan_id;
    }, { name: "task-journal-create" });
    return { status: "succeeded", journal: { operation: request.operation, plans: readPlan(data, planId, botId), steps: readSteps(data, planId), failures: [] } };
  }
  if (request.operation === "list_plans") {
    return { status: "succeeded", journal: { operation: request.operation, plans: data.read("SELECT * FROM task_plans WHERE bot_id = ? ORDER BY plan_id DESC LIMIT ?", botId, request.limit).map(plan), steps: [], failures: readFailures(data, null, botId) } };
  }
  if (request.operation === "update_step") {
    data.transaction((db) => {
      db.prepare("UPDATE task_steps SET status = ?, evidence_source = ?, updated_at = ? WHERE step_id = ? AND plan_id = ?")
        .run(request.status!, request.source, now, request.step_id!, request.plan_id!);
      db.prepare("UPDATE task_plans SET updated_at = ? WHERE plan_id = ? AND bot_id = ?").run(now, request.plan_id!, botId);
    }, { name: "task-journal-update-step" });
  } else if (request.operation === "record_failure") {
    data.transaction((db) => {
      db.prepare("INSERT INTO task_failures (plan_id,step_id,bot_id,failure_type,summary,recovery,source,recorded_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(request.plan_id!, request.step_id ?? null, botId, request.failure_type!, request.summary!, request.recovery!, request.source, now);
      if (request.step_id) db.prepare("UPDATE task_steps SET status = 'failed', evidence_source = ?, updated_at = ? WHERE step_id = ?").run(request.source, now, request.step_id);
      db.prepare("UPDATE task_plans SET updated_at = ? WHERE plan_id = ? AND bot_id = ?").run(now, request.plan_id!, botId);
    }, { name: "task-journal-failure" });
  } else if (request.operation === "finish_plan") {
    data.transaction((db) => db.prepare("UPDATE task_plans SET status = ?, source = ?, updated_at = ? WHERE plan_id = ? AND bot_id = ?")
      .run(request.status!, request.source, now, request.plan_id!, botId), { name: "task-journal-finish" });
  }
  return { status: "succeeded", journal: { operation: request.operation, plans: readPlan(data, request.plan_id!, botId), steps: readSteps(data, request.plan_id!), failures: readFailures(data, request.plan_id!, botId) } };
}

export function createTaskJournalAction(bot: Bot, data: SqlBotData) {
  return defineAction({
    name: TASK_JOURNAL,
    description: TASK_JOURNAL_DESCRIPTION,
    inputSchema: taskJournalInputSchema,
    resultSchema: taskJournalResultSchema,
    formatResult: (result) => `Task journal ${result.journal.operation}: ${result.status}\n\n${markdownCodeBlock(JSON.stringify(result.journal, null, 2))}`,
    execution: { kind: "task" },
    annotations: taskJournalAnnotations,
    parse: parseTaskJournalRequest,
    execute: (request) => run(bot, data, request),
  });
}
