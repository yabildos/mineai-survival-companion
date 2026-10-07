import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const TASK_JOURNAL = "task_journal" as const;
export const TASK_JOURNAL_DESCRIPTION =
  "Create, inspect, advance and repair structured task plans. Use this instead of keeping long goals only in prose: plans have steps, verified sources and classified failures.";

export const TASK_JOURNAL_OPERATIONS = ["create_plan", "list_plans", "get_plan", "update_step", "record_failure", "finish_plan"] as const;
export const TASK_STATUSES = ["active", "paused", "completed", "failed", "abandoned"] as const;
export const STEP_STATUSES = ["pending", "active", "completed", "failed", "skipped"] as const;
export const MEMORY_SOURCES = ["user", "planner", "executor_verified", "observed"] as const;
export const FAILURE_TYPES = ["no_path", "no_tool", "tool_broke", "inventory_full", "player_unloaded", "unsafe_lava", "window_failed", "stuck_loop", "timeout", "missing_resource", "unknown"] as const;

export const taskJournalInputSchema = z.strictObject({
  operation: z.enum(TASK_JOURNAL_OPERATIONS),
  plan_id: z.number().int().positive().optional(),
  step_id: z.number().int().positive().optional(),
  title: z.string().trim().min(1).optional(),
  goal: z.string().trim().min(1).optional(),
  steps: z.array(z.strictObject({
    description: z.string().trim().min(1),
    tool_hint: z.string().trim().min(1).optional(),
    source: z.enum(MEMORY_SOURCES).default("planner"),
  })).min(1).max(24).optional(),
  status: z.enum([...TASK_STATUSES, ...STEP_STATUSES]).optional(),
  failure_type: z.enum(FAILURE_TYPES).optional(),
  summary: z.string().trim().min(1).optional(),
  recovery: z.string().trim().min(1).optional(),
  source: z.enum(MEMORY_SOURCES).default("planner"),
  limit: z.number().int().min(1).max(20).default(5),
});

export type TaskJournalRequest = z.output<typeof taskJournalInputSchema>;
export function parseTaskJournalRequest(raw: unknown): TaskJournalRequest {
  const value = taskJournalInputSchema.parse(raw ?? {});
  if (value.operation === "create_plan" && (!value.title || !value.goal || !value.steps)) throw new Error("create_plan requires title, goal and steps.");
  if (["get_plan", "update_step", "record_failure", "finish_plan"].includes(value.operation) && !value.plan_id) throw new Error(`${value.operation} requires plan_id.`);
  if (value.operation === "update_step" && (!value.step_id || !value.status)) throw new Error("update_step requires step_id and status.");
  if (value.operation === "record_failure" && (!value.failure_type || !value.summary || !value.recovery)) throw new Error("record_failure requires failure_type, summary and recovery.");
  if (value.operation === "finish_plan" && !value.status) throw new Error("finish_plan requires status.");
  return value;
}

const planSchema = z.strictObject({
  planId: z.number().int(),
  title: z.string(),
  goal: z.string(),
  status: z.enum(TASK_STATUSES),
  source: z.enum(MEMORY_SOURCES),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const stepSchema = z.strictObject({
  stepId: z.number().int(),
  planId: z.number().int(),
  stepIndex: z.number().int(),
  description: z.string(),
  status: z.enum(STEP_STATUSES),
  toolHint: z.string().nullable(),
  evidenceSource: z.enum(MEMORY_SOURCES),
  updatedAt: z.string(),
});
const failureSchema = z.strictObject({
  failureId: z.number().int(),
  planId: z.number().int().nullable(),
  stepId: z.number().int().nullable(),
  failureType: z.enum(FAILURE_TYPES),
  summary: z.string(),
  recovery: z.string(),
  source: z.enum(MEMORY_SOURCES),
  recordedAt: z.string(),
});

export const taskJournalReportSchema = z.strictObject({
  operation: z.enum(TASK_JOURNAL_OPERATIONS),
  plans: z.array(planSchema),
  steps: z.array(stepSchema),
  failures: z.array(failureSchema),
});

export const taskJournalResultSchema = actionResultSchema({ journal: taskJournalReportSchema });
export type TaskJournalResult = z.output<typeof taskJournalResultSchema>;
export type TaskJournalOutput = ActionOutput<typeof TASK_JOURNAL, TaskJournalResult>;

export const taskJournalAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;
