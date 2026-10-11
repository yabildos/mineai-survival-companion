import { describe, expect, test } from "bun:test";
import { validateActionCatalog } from "../../src/actions/catalog.js";

describe("MCP action catalog", () => {
  test("accepts unique documented tool names", () => {
    expect(() => validateActionCatalog([
      { name: "view_status", description: "Read current status." },
      { name: "gather_resource", description: "Gather a bounded resource amount." },
    ])).not.toThrow();
  });

  test("rejects duplicate names before server registration", () => {
    expect(() => validateActionCatalog([
      { name: "navigate", description: "First." },
      { name: "navigate", description: "Second." },
    ])).toThrow("Duplicate MCP action 'navigate'");
  });

  test("rejects invalid names and empty descriptions", () => {
    expect(() => validateActionCatalog([{ name: "View Status", description: "Read." }])).toThrow("Invalid MCP action name");
    expect(() => validateActionCatalog([{ name: "view_status", description: "  " }])).toThrow("has no description");
  });
});
