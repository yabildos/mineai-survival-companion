# MineAI

MineAI is a single-player survival companion for Minecraft Java. It joins a world as an ordinary player and helps with the user's current task: exploration, gathering, crafting, farming, combat, carrying items, and practical builds. It does not require a Minecraft mod and does not use creative mode, operator commands, inventory injection, or save-file edits.

The MCP runtime is based on [Mine AI MCP](https://github.com/aibengineering/mine-ai-mcp), distributed under MIT; its license and upstream commit are preserved in `ai/engine/LICENSE` and `ai/engine/UPSTREAM.txt`. Project-specific files do not claim a blanket license.

## Requirements

- Nix with flakes on Linux.
- Minecraft Java 1.21.4, or a tested compatible version.
- A world opened to LAN.
- Codex CLI logged in with `codex login`.
- Network access to the Minecraft LAN host.

## Start

1. Open the world to LAN in Minecraft and note its port (default 1234).
2. From this directory, run:

```sh
./run-ai.sh
```

To use a different LAN port or give MineAI a task:

```sh
./run-ai.sh 25565 "follow me and bring the iron from the nearby chest"
```

MineAI starts one Minecraft player and one MCP endpoint at `http://127.0.0.1:25575/mcp`; Codex controls that player in the same terminal. Press Ctrl+C to stop the session. Other clients can connect to the MCP endpoint while the host is running.

```sh
./run-ai.sh status
./run-ai.sh stop
```

For another Minecraft version, set `MINECRAFT_AI_VERSION`. For an authenticated server, set `MINECRAFT_AI_AUTH=microsoft` and complete the Mineflayer account login flow. The default `offline` authentication is intended only for offline-mode/LAN servers.

## From A Clean Checkout

```sh
nix --extra-experimental-features 'nix-command flakes' develop .#ai --command \
  bun install --cwd ai/engine --frozen-lockfile --production
./run-ai.sh
```

Run checks:

```sh
nix --extra-experimental-features 'nix-command flakes' develop .#ai --command \
  bun install --cwd ai/engine --frozen-lockfile
nix --extra-experimental-features 'nix-command flakes' develop .#ai --command \
  bun run --cwd ai/engine verify
```

For runtime-only installs, use the `--production` install command above.
For checks, install development dependencies as shown here.

After MineAI has created local memory, inspect it read-only with
`bun run --cwd ai/engine audit:bot-data`.

Runtime databases, logs, and the isolated home directory are kept under `data/` and are excluded from Git. They are local state, not portable project assets.

## Design

- `run-ai.sh`: one-process launcher and session lifecycle.
- `.codex/config.toml`: single local MCP connection.
- `ai/engine/src/server/`: MCP transport and runtime host.
- `ai/engine/src/session/`: foreground action ownership and cancellation.
- `ai/engine/src/actions/`: validated high-level tools.
- `ai/engine/src/navigation/`: route planning and movement.
- `ai/engine/src/survival/`: safety reflexes and combat.
- `ai/engine/src/world/`: Minecraft rules and inventory facts.
- `ai/engine/src/bot-data/`: world-scoped notes and observations.
- `ai/playbook.md`, `ai/skills.md`: concise operating rules and task recipes.

The bot only observes loaded world data available through its normal game connection. It cannot inspect unexplored chunks or guarantee perfect autonomous play. Destructive actions should be bounded and verified in-world.

## License And Attribution

MineAI includes and modifies the MIT-licensed Mine AI MCP engine. Preserve the included upstream license and commit attribution when redistributing that engine. Other project-specific material is published without an additional license grant unless a file says otherwise.
