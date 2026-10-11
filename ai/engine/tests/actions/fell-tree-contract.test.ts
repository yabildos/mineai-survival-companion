import { describe, expect, it } from "bun:test";
import { fellTreeInputSchema } from "../../src/actions/fell-tree/contract.js";

describe("fell_tree contract", () => {
  it("defaults to a batch large enough for whole mushroom trees", () => {
    expect(fellTreeInputSchema.parse({}).max_blocks).toBe(128);
    expect(fellTreeInputSchema.parse({ max_blocks: 256 }).max_blocks).toBe(256);
  });
});
