import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  CLOSE_WINDOW,
  CLOSE_WINDOW_DESCRIPTION,
  closeWindowAnnotations,
  closeWindowInputSchema,
  closeWindowOutcomes,
  closeWindowResultSchema,
  parseCloseWindowRequest,
  type CloseWindowResult,
} from "./contract.js";

function selected(bot: Bot) {
  const item = (bot.currentWindow ?? bot.inventory)?.selectedItem;
  return item ? { name: item.name, count: item.count } : null;
}

async function close(bot: Bot): Promise<CloseWindowResult> {
  const window = bot.currentWindow;
  const selectedBefore = selected(bot);
  const base = {
    hadWindow: window !== null,
    windowType: window?.type === undefined ? null : String(window.type),
    selectedBefore,
  };
  if (!window) {
    return { status: "succeeded", window: { ...base, selectedAfter: selected(bot), closed: true } };
  }
  try {
    await bot.closeWindow(window);
  } catch (cause) {
    return {
      status: "failed",
      error: closeWindowOutcomes.failed(cause),
      window: { ...base, selectedAfter: selected(bot), closed: bot.currentWindow === null },
    };
  }
  const selectedAfter = selected(bot);
  if (selectedAfter) {
    return {
      status: "partial",
      error: closeWindowOutcomes.cursorHeld(selectedAfter.name, selectedAfter.count),
      window: { ...base, selectedAfter, closed: bot.currentWindow === null },
    };
  }
  return { status: "succeeded", window: { ...base, selectedAfter, closed: bot.currentWindow === null } };
}

export function formatCloseWindowResult(result: CloseWindowResult): string {
  const { window } = result;
  const before = window.selectedBefore ? `${window.selectedBefore.name} x${window.selectedBefore.count}` : "nothing";
  const after = window.selectedAfter ? `${window.selectedAfter.name} x${window.selectedAfter.count}` : "nothing";
  return `${window.hadWindow ? `Closed ${window.windowType ?? "window"}` : "No window was open"}. Cursor before: ${before}; after: ${after}.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createCloseWindowAction(bot: Bot) {
  return defineAction({
    name: CLOSE_WINDOW,
    description: CLOSE_WINDOW_DESCRIPTION,
    inputSchema: closeWindowInputSchema,
    resultSchema: closeWindowResultSchema,
    formatResult: formatCloseWindowResult,
    execution: { kind: "task" },
    annotations: closeWindowAnnotations,
    parse: parseCloseWindowRequest,
    execute: () => close(bot),
  });
}
