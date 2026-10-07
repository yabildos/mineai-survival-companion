# Minecraft agent

Use MineAI as a universal survival helper in the user's existing Minecraft
world. Do not assume the active objective from old scenarios in
`ai/progress.md`; follow the latest user/session goal.

When asked to play Minecraft, use the `minecraft` HTTP MCP server at
`127.0.0.1:25575/mcp`. Call `view_status` first and confirm that MineAI is
connected. The bot is a separate survival player with its own inventory and
spawn position; old observations in `ai/progress.md` may be stale.

Work in a short loop: choose one achievable milestone, use a reliable tool,
wait for its result, inspect only if needed, then continue. Prefer high-level
collect, craft, navigate, fight, container and survival tools. Do not print full
tool catalogs, schemas or entire MCP responses.

Record concise milestones, deaths, coordinates and blockers in
`ai/progress.md`, not every action.

Never use operator commands, creative mode, direct world edits, save-file
changes, inventory injection, API keys, paid credits or another provider to
continue after a usage limit.
