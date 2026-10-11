#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "../../..");
const explicit = process.argv[2];

function latestDatabase(): string {
  if (explicit) return path.resolve(root, explicit);
  const proc = Bun.spawnSync({
    cmd: ["bash", "-lc", "find data/bot-data -type f \\( -name '*.sqlite' -o -name '*.db' -o -name '*.sqlite3' \\) -printf '%T@ %p\\n' | sort -nr | head -1 | cut -d' ' -f2-"],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const file = proc.stdout.toString().trim();
  if (!file) throw new Error("No SQLite bot database found under data/bot-data.");
  return path.resolve(root, file);
}

function rows<T>(db: Database, sql: string): T[] {
  return db.query(sql).all() as T[];
}

function scalar<T>(db: Database, sql: string, fallback: T): T {
  const row = db.query(sql).get() as Record<string, T> | null;
  return row ? Object.values(row)[0] ?? fallback : fallback;
}

function hasTable(name: string): boolean {
  return db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== null;
}

function section(title: string): void {
  console.log(`\n## ${title}`);
}

function bullets(items: string[]): void {
  if (items.length === 0) {
    console.log("- none");
    return;
  }
  for (const item of items) console.log(`- ${item}`);
}

const dbPath = latestDatabase();
if (!existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);

const db = new Database(dbPath, { readonly: true });
const integrity = scalar<string>(db, "PRAGMA quick_check", "unknown");

console.log("# MineAI Bot Data Audit");
console.log(`Database: ${path.relative(root, dbPath)}`);
console.log(`Quick check: ${integrity}`);

section("Current State");
bullets(rows<{
  dimension: string; xyz: string; health: number; food: number; updated_at: string;
}>(db, `
  SELECT dimension,
         printf('%.1f %.1f %.1f', x, y, z) AS xyz,
         round(health, 1) AS health,
         food,
         updated_at
  FROM bot_status
`).map((row) => `MineAI ${row.dimension} at ${row.xyz}, health ${row.health}/20, food ${row.food}/20, updated ${row.updated_at}.`));

if (hasTable("player_locations")) {
  bullets(rows<{ username: string; dimension: string; xyz: string; seen_at: string }>(db, `
    SELECT username, dimension, printf('%.1f %.1f %.1f', x, y, z) AS xyz, seen_at
    FROM player_locations
    ORDER BY seen_at DESC
    LIMIT 5
  `).map((row) => `Player ${row.username} last seen in ${row.dimension} at ${row.xyz}, ${row.seen_at}.`));
} else {
  console.log("- Player location history is unavailable in this schema.");
}

section("Top Failure Patterns");
bullets(rows<{ code: string; action_name: string; status: string; count: number }>(db, `
  WITH failures AS (
    SELECT q.action_name, r.status,
           json_extract(r.response_json,'$.content[0].text') AS text
    FROM action_responses r JOIN action_requests q USING(request_id)
    WHERE r.status IN ('failed','refused','cancelled','partial','storage_failed')
  ), codes AS (
    SELECT action_name, status,
           CASE
             WHEN text LIKE '%[NAVIGATION_STOPPED]%' THEN 'NAVIGATION_STOPPED'
             WHEN text LIKE '%[NAVIGATION_TARGET_UNSUPPORTED]%' THEN 'NAVIGATION_TARGET_UNSUPPORTED'
             WHEN text LIKE '%ACTION\\_BUSY%' ESCAPE '\\' THEN 'ACTION_BUSY'
             WHEN text LIKE '%RESULT\\_NOT\\_RETRIEVED%' ESCAPE '\\' THEN 'RESULT_NOT_RETRIEVED'
             WHEN text LIKE '%ACTION\\_NOT\\_FOUND%' ESCAPE '\\' THEN 'ACTION_NOT_FOUND'
             WHEN text LIKE '%[HUNT_OBSERVATION_EXHAUSTED]%' THEN 'HUNT_OBSERVATION_EXHAUSTED'
             WHEN text LIKE '%[HOSTILE_CONTACT]%' THEN 'HOSTILE_CONTACT'
             WHEN text LIKE '%[COMBAT_CONSTRAINED]%' THEN 'COMBAT_CONSTRAINED'
             WHEN text LIKE '%[RUNTIME_INTERRUPTED]%' THEN 'RUNTIME_INTERRUPTED'
             ELSE 'OTHER'
           END AS code
    FROM failures
  )
  SELECT code, action_name, status, COUNT(*) AS count
  FROM codes
  GROUP BY code, action_name, status
  ORDER BY count DESC
  LIMIT 12
`).map((row) => `${row.code}: ${row.action_name} ${row.status} x${row.count}.`));
if (hasTable("task_failures")) {
  bullets(rows<{ failure_type: string; count: number }>(db, `
    SELECT failure_type, count(*) AS count FROM task_failures
    GROUP BY failure_type ORDER BY count DESC LIMIT 8
  `).map((row) => `Task journal ${row.failure_type}: ${row.count}.`));
} else {
  console.log("- task_failures table absent in this historical schema; action response failures remain auditable.");
}

section("Deaths And Equipment");
bullets(rows<{ dimension: string; xyz: string; observed_at: string; cause: string }>(db, `
  SELECT dimension, printf('%.1f %.1f %.1f', x, y, z) AS xyz, observed_at, cause
  FROM bot_last_death
`).map((row) => `Last death: ${row.dimension} at ${row.xyz}, ${row.observed_at}, ${row.cause}.`));
bullets(rows<{ event_type: string; count: number; latest: string }>(db, `
  SELECT event_type, COUNT(*) AS count, max(observed_at) AS latest
  FROM events
  WHERE event_type IN ('equipment_broken','equipment_low_durability','player_death','survival_outcome')
  GROUP BY event_type
  ORDER BY count DESC
`).map((row) => `${row.event_type}: ${row.count}, latest ${row.latest}.`));

section("Foreground Action Gate");
const unretrieved = scalar<number>(db, `
  SELECT COUNT(*)
  FROM action_executions
  WHERE json_type(record_json,'$.terminal') IS NOT NULL
    AND coalesce(json_extract(record_json,'$.resultRetrieved'),0) = 0
`, 0);
const nonterminal = scalar<number>(db, `
  SELECT COUNT(*)
  FROM action_executions
  WHERE json_type(record_json,'$.terminal') IS NULL
`, 0);
bullets([
  `Unretrieved terminal results: ${unretrieved}.`,
  `Durable nonterminal executions: ${nonterminal}.`,
]);

section("Recommendations");
const recommendations: string[] = [];
const navStopped = scalar<number>(db, `
  SELECT COUNT(*)
  FROM action_responses r JOIN action_requests q USING(request_id)
  WHERE q.action_name = 'navigate'
    AND r.status = 'failed'
    AND json_extract(r.response_json,'$.content[0].text') LIKE '%[NAVIGATION_STOPPED]%'
`, 0);
const brokenGear = scalar<number>(db, "SELECT COUNT(*) FROM events WHERE event_type = 'equipment_broken'", 0);
const status = rows<{ dimension: string; health: number; updated_at: string }>(db,
  "SELECT dimension, health, updated_at FROM bot_status LIMIT 1")[0];
const statusAgeMinutes = status ? Math.max(0, Math.round((Date.now() - Date.parse(status.updated_at)) / 60_000)) : null;
if (status && statusAgeMinutes !== null && statusAgeMinutes > 60) {
  recommendations.push(`Stored vitals/position are ${Math.floor(statusAgeMinutes / 60)} hours old; treat them as history and call view_status before choosing any action.`);
} else if (status?.dimension === "the_nether" && status.health < 14) {
  recommendations.push("Fresh status is in the Nether below 14 HP; recover before travel or hunting.");
}
if (navStopped > 20) recommendations.push("After two no-path failures, inspect/support/scaffold or choose a closer waypoint instead of repeating navigate.");
if (brokenGear > 10) recommendations.push("Use loadout_manager before combat/travel and refuse risky Nether work with low durability armor or no replacement.");
if (unretrieved > 0 || nonterminal > 0) recommendations.push("Restart MineAI with the durable foreground refresh fix before continuing foreground work.");
if (recommendations.length === 0) recommendations.push("No urgent database-level blocker found; continue with fresh view_status and short action loops.");
bullets(recommendations);
