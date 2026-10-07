# MineAI architecture

MineAI is a survival-mode companion player, not a command bot. It joins a normal Java Edition world through Mineflayer, observes the same loaded world a player would, and helps through ordinary actions: walking, mining, crafting, fighting, trading, building, carrying supplies and recovering from danger.

The project is reusable companion infrastructure for the user's current world. Any old scenario is historical unless the user explicitly asks to resume it.

## Product principles

- No cheats: no operator commands, creative mode, inventory injection, save edits or direct world mutation.
- No mods required: the Minecraft client/world may be vanilla or Fabric with no bot-specific mod.
- Companion behavior: tools should support helping a player, following instructions, carrying supplies, scouting, fighting, farming and building.
- Fresh observations beat stale notes: persistent memory is useful, but live world state is authoritative.
- Small tools matter: every complex task needs cheap inspection and recovery tools so the agent can debug without using unsafe fallbacks.

## Layers

### Protocol

`src/server/` owns HTTP/MCP transport, async foreground protocol, rendering and liveness. It should not contain Minecraft strategy. It publishes actions, validates MCP input, records calls and turns action outputs into Markdown or JSON.

### Session

`src/session/` owns physical body arbitration. At most one foreground owner moves or clicks at a time. Reflexes may preempt foreground work and either settle or allow resumable actions to continue.

### Runtime composition

`src/runtime/` wires Mineflayer, persistent bot data, navigation, survival, diagnostics and the action catalog. It is the place for long-lived observers and lifecycle ownership.

### Actions

`src/actions/` is the public tool catalog. Each action owns its schema, parse step, execution mode, result evidence and Markdown receipt.

New actions should be either:

- read-only inspection tools,
- narrow control/recovery tools,
- high-level survival-aware tasks built from navigation/world/survival helpers.

Avoid one-off raw Mineflayer scripts in actions when a reusable helper belongs in `world/`, `navigation/`, `survival/` or `bot-data/`.

### Navigation

`src/navigation/` plans and executes routes through ports (`WorldView`, `NavigationBot`, `Goal`). Callers should import from `src/navigation/index.ts`, not from internals.

### Survival

`src/survival/` observes hazards and owns reflex policy and combat response. Ordinary actions should cooperate with it instead of duplicating emergency logic.

### World

`src/world/` contains pure or Mineflayer-adjacent Minecraft domain facts: blocks, fluids, crafting, food, inventory, entity geometry, tool tiers and hazards.

### Bot data

`src/bot-data/` owns durable observations: notes, inventory/status snapshots, events, action logs, incidents, frontier chunks and observed containers.

## Directory standards

Every action directory should follow this shape:

```text
src/actions/example-tool/
  contract.ts      constants, Zod schemas, parse function, result types, error codes
  example-tool.ts  execution and formatting
  index.ts         exports only
```

Large domain-specific actions may add focused helper files, but action directories should not become mini-frameworks. If three actions need the same helper, move it out of the action directory.

Avoid adding more large multi-tool files like `advanced-workstations.ts`; split them into action directories when touched.

## Error model

Tool results should use stable bracketed codes where possible, for example `[WINDOW_BUSY]` or `[EQUIP_NOT_CARRIED]`.

Use these categories:

- input/schema refusal: bad MCP arguments before execution,
- action failure: valid request, action could not complete,
- partial success: some requested effect is confirmed,
- runtime failure: body busy, cancellation, disconnect, protocol crash,
- diagnostic incident: detailed stack or packet evidence stored outside normal response.

Normal MCP output should be actionable and concise. Raw stack traces belong in incidents and logs, not the default tool receipt.

## Test strategy

Tests should start cheap and close to the code:

- contract parsing and defaults,
- result formatting,
- pure world helpers,
- inventory/equipment slot mapping,
- action catalog registration,
- protocol rendering for success/failure,
- regression fixtures for packet/window issues.

Only then add scenario tests with Mineflayer or a live Minecraft world. A world test is valuable, but it should not be the first line of defense.
