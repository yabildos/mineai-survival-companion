import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { actionResultSchema, type ActionOutput } from "../action.js";

export const CLOSE_WINDOW = "close_window" as const;
export const CLOSE_WINDOW_DESCRIPTION =
  "Close the currently open Minecraft window, if any, without moving items deliberately. Use after inspect/open interactions or when a GUI may be blocking normal actions.";

export const closeWindowInputSchema = z.strictObject({});
export type CloseWindowRequest = Record<string, never>;

export function parseCloseWindowRequest(raw: unknown): CloseWindowRequest {
  closeWindowInputSchema.parse(raw ?? {});
  return {};
}

const selectedItemSchema = z.strictObject({ name: z.string(), count: z.number().int().positive() }).nullable();

export const closeWindowEvidenceSchema = z.strictObject({
  hadWindow: z.boolean(),
  windowType: z.string().nullable(),
  selectedBefore: selectedItemSchema,
  selectedAfter: selectedItemSchema,
  closed: z.boolean(),
});

export const closeWindowResultSchema = actionResultSchema({ window: closeWindowEvidenceSchema });
export type CloseWindowResult = z.output<typeof closeWindowResultSchema>;
export type CloseWindowOutput = ActionOutput<typeof CLOSE_WINDOW, CloseWindowResult>;

export const closeWindowAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;

export const closeWindowOutcomes = {
  failed: (cause: unknown) => `[WINDOW_CLOSE_FAILED] ${cause instanceof Error ? cause.message : String(cause)}`,
  cursorHeld: (name: string, count: number) => `[WINDOW_CURSOR_HELD] Closed the window but cursor still holds ${name} x${count}.`,
} as const;

