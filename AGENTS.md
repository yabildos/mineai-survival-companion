# Minecraft agent

Use MineAI as a universal survival helper in the user's current Minecraft
world. Follow the latest goal; never revive an old scenario by default.

When asked to play Minecraft, use the `minecraft` HTTP MCP server at
`127.0.0.1:25575/mcp`. Call `view_status` first and confirm that MineAI is
connected. MineAI is one separate survival player with its own inventory and
spawn point.

Work in a short loop: choose one achievable milestone, use a reliable tool,
wait for its result, inspect only if needed, then continue. Prefer high-level
collect, craft, navigate, fight, container and survival tools. Do not print full
tool catalogs, schemas or entire MCP responses.

Never use operator commands, creative mode, direct world edits, save-file
changes, inventory injection, API keys, paid credits or another provider to
continue after a usage limit.
