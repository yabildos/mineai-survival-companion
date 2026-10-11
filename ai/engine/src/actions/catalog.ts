import type { Action } from "./action.js";

type CatalogEntry = Pick<Action, "name" | "description">;

/** Fail during startup rather than expose an ambiguous or invalid MCP catalog. */
export function validateActionCatalog(actions: readonly CatalogEntry[]): void {
  const owners = new Map<string, number>();
  for (const [index, action] of actions.entries()) {
    if (!/^[a-z][a-z0-9_]{0,127}$/.test(action.name)) {
      throw new Error(`Invalid MCP action name '${action.name}'.`);
    }
    if (!action.description.trim()) throw new Error(`MCP action '${action.name}' has no description.`);
    const previous = owners.get(action.name);
    if (previous !== undefined) throw new Error(`Duplicate MCP action '${action.name}' at catalog indexes ${previous} and ${index}.`);
    owners.set(action.name, index);
  }
}
