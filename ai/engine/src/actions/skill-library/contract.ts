import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const SKILL_LIBRARY = "skill_library" as const;
export const SKILL_LIBRARY_DESCRIPTION =
  "Save, find and score reusable tool-call skills. Use after a successful task to preserve the sequence, or before planning to retrieve known recipes.";

export const SKILL_LIBRARY_OPERATIONS = ["save", "find", "record_result", "delete"] as const;
export const SKILL_SOURCES = ["executor_verified", "planner", "user"] as const;

const toolStepSchema = z.strictObject({
  tool: z.string().trim().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().min(1).optional(),
});

export const skillLibraryInputSchema = z.strictObject({
  operation: z.enum(SKILL_LIBRARY_OPERATIONS),
  skill_id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).max(16).default([]),
  tool_sequence: z.array(toolStepSchema).min(1).max(32).optional(),
  query: z.string().trim().min(1).optional(),
  succeeded: z.boolean().optional(),
  source: z.enum(SKILL_SOURCES).default("planner"),
  limit: z.number().int().min(1).max(20).default(8),
});

export type SkillLibraryRequest = z.output<typeof skillLibraryInputSchema>;
export function parseSkillLibraryRequest(raw: unknown): SkillLibraryRequest {
  const value = skillLibraryInputSchema.parse(raw ?? {});
  if (value.operation === "save" && (!value.name || !value.description || !value.tool_sequence)) throw new Error("save requires name, description and tool_sequence.");
  if (value.operation === "find" && !value.query) throw new Error("find requires query.");
  if (value.operation === "record_result" && !value.skill_id) throw new Error("record_result requires skill_id.");
  if (value.operation === "delete" && !value.skill_id && !value.name) throw new Error("delete requires skill_id or name.");
  return value;
}

const skillSchema = z.strictObject({
  skillId: z.number().int(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  toolSequence: z.array(toolStepSchema),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  source: z.enum(SKILL_SOURCES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const skillLibraryReportSchema = z.strictObject({
  operation: z.enum(SKILL_LIBRARY_OPERATIONS),
  skills: z.array(skillSchema),
});

export const skillLibraryResultSchema = actionResultSchema({ library: skillLibraryReportSchema });
export type SkillLibraryResult = z.output<typeof skillLibraryResultSchema>;
export type SkillLibraryOutput = ActionOutput<typeof SKILL_LIBRARY, SkillLibraryResult>;

export const skillLibraryAnnotations = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;
