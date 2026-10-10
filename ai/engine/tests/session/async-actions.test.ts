import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { AsyncActions } from "../../src/session/async-actions.js";

const output = {
  action: "navigate",
  durationMs: 100,
  result: { status: "failed", error: "[NAVIGATION_STOPPED] no path" },
} as const;

function runner() {
  return {
    ownership: () => ({ current: null, reserved: null, transfer: null, connected: true }),
    status: () => ({ busy: false, activeAction: null, owner: "idle" }),
    progress: () => null,
    request: () => null,
    cancelRequest: () => ({ kind: "idle", reason: "not running" }),
  };
}

function store(records: any[]) {
  return {
    load: () => records.map((record) => structuredClone(record)),
    readAll: () => records.map((record) => structuredClone(record)),
    write: (updated: readonly any[]) => {
      for (const record of updated) {
        const index = records.findIndex((candidate) => candidate.actionId === record.actionId);
        if (index >= 0) records[index] = structuredClone(record);
        else records.push(structuredClone(record));
      }
    },
  };
}

describe("AsyncActions durable refresh", () => {
  test("wait can retrieve and acknowledge a terminal record written by another connection", async () => {
    const records = [{
      actionId: "action-1",
      submissionId: "submission-1",
      action: "navigate",
      arguments: { x: 1, y: 2, z: 3 },
      admittedAt: "2026-10-08T04:00:00.000Z",
      requestId: 1,
      rationale: null,
      resultRetrieved: false,
      checkpoint: null,
      terminal: null,
    }];
    const actions = new AsyncActions(runner() as any, (() => Promise.resolve(output)) as any, store(records));

    records[0] = { ...records[0], terminal: { output } };

    const result = await actions.wait("action-1", 1000);
    expect(result.state).toBe("settled");
    expect(records[0].resultRetrieved).toBe(true);
  });

  test("submit reports a durable nonterminal action as the active action", () => {
    const records = [{
      actionId: "remote-action",
      submissionId: "remote-submission",
      action: "navigate",
      arguments: { x: 1 },
      admittedAt: "2026-10-08T04:00:00.000Z",
      requestId: 1,
      rationale: null,
      resultRetrieved: false,
      checkpoint: null,
      terminal: null,
    }];
    const durable = store(records);
    const actions = new AsyncActions(
      runner() as any,
      (() => Promise.resolve(output)) as any,
      { ...durable, load: () => [] },
    );
    const action = {
      name: "wait_ticks",
      parse: (input: unknown) => input,
      outputSchema: z.any(),
    };

    const result = actions.submit(action as any, {}, { submission_id: "next" }, 2);
    expect(result).toEqual(expect.objectContaining({
      state: "refused",
      code: "ACTION_BUSY",
      activeActionId: "remote-action",
    }));
  });
});
