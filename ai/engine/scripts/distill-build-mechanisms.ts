#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "../../..");
const archive = process.argv[2] ?? path.join(root, "data/external/kaggle/minecraft-builds-dataset/minecraft-builds-dataset.zip");
const outDir = path.join(root, "ai/blueprints");
const candidatesPath = path.join(outDir, "mechanism-candidates.json");
const patternsPath = path.join(outDir, "BUILDING_MECHANISM_PATTERNS.md");

const usefulKeywords = [
  "farm", "automatic", "auto", "redstone", "piston", "hopper", "sorter", "storage",
  "villager", "village", "trading", "breeder", "iron", "raid", "spawner", "mob",
  "xp", "experience", "sugar", "cane", "bamboo", "kelp", "crop", "wheat", "carrot",
  "potato", "melon", "pumpkin", "tree", "portal", "nether", "mechanism", "machine",
  "contraption", "elevator", "minecart", "rail", "generator",
];

const rejectKeywords = [
  "house", "mansion", "castle", "temple", "cathedral", "palace", "villa", "tower",
  "statue", "hub", "spawn", "lobby", "pixel", "organics", "dragon", "modern",
];

interface Row {
  PAGE_URL: string;
  TAGS: string;
  DOWNLOAD_SIZE: string;
  FILENAME: string;
  SUFFIX: string;
  PROCESSED_PATHS: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function score(row: Row): number {
  const text = `${row.PAGE_URL} ${row.TAGS} ${row.FILENAME}`.toLowerCase();
  let value = 0;
  for (const keyword of usefulKeywords) if (text.includes(keyword)) value += keyword.length >= 6 ? 3 : 2;
  for (const keyword of rejectKeywords) if (text.includes(keyword)) value -= 2;
  if (row.PROCESSED_PATHS.includes(".schem") || row.PROCESSED_PATHS.includes(".h5")) value += 2;
  const size = Number(row.DOWNLOAD_SIZE);
  if (Number.isFinite(size)) {
    if (size > 0 && size < 500_000) value += 2;
    else if (size > 20_000_000) value -= 2;
  }
  return value;
}

function category(row: Row): string {
  const text = `${row.PAGE_URL} ${row.TAGS} ${row.FILENAME}`.toLowerCase();
  if (text.includes("villager") || text.includes("trading") || text.includes("breeder")) return "villagers";
  if (text.includes("storage") || text.includes("sorter") || text.includes("hopper")) return "storage";
  if (text.includes("redstone") || text.includes("piston") || text.includes("machine") || text.includes("contraption")) return "redstone";
  if (text.includes("spawner") || text.includes("mob") || text.includes("xp") || text.includes("raid")) return "mob-farm";
  if (text.includes("farm") || text.includes("crop") || text.includes("sugar") || text.includes("bamboo") || text.includes("kelp")) return "farm";
  if (text.includes("portal") || text.includes("nether")) return "travel";
  return "utility";
}

const proc = Bun.spawnSync({
  cmd: ["nix", "--extra-experimental-features", "nix-command flakes", "shell", "nixpkgs#unzip", "--command", "unzip", "-p", archive, "processed_build_dataframe.csv"],
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
});
if (proc.exitCode !== 0) {
  if (existsSync(candidatesPath) && existsSync(patternsPath)) {
    console.log("Raw build dataset is not present; existing distilled mechanism files are already available.");
    console.log(`Kept ${path.relative(root, candidatesPath)}`);
    console.log(`Kept ${path.relative(root, patternsPath)}`);
    process.exit(0);
  }
  throw new Error(proc.stderr.toString() || "Unable to read processed_build_dataframe.csv");
}

const parsed = parseCsv(proc.stdout.toString());
const header = parsed.shift() ?? [];
const rows = parsed.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])) as unknown as Row);
const candidates = rows
  .map((row) => ({ ...row, category: category(row), score: score(row) }))
  .filter((row) => row.score >= 4 && row.PROCESSED_PATHS.trim().length > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 250);

mkdirSync(outDir, { recursive: true });
writeFileSync(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`);

const byCategory = new Map<string, number>();
for (const candidate of candidates) byCategory.set(candidate.category, (byCategory.get(candidate.category) ?? 0) + 1);
const lines = [
  "# Building Mechanism Patterns",
  "",
  "Distilled from the local Kaggle Minecraft builds metadata. The raw dataset is not needed at runtime.",
  "",
  "## Useful Categories",
  "",
  ...[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `- ${name}: ${count} candidate builds`),
  "",
  "## What MineAI Should Learn",
  "",
  "- Prefer utility builds over decorative buildings: farms, storage, villagers, redstone, portals and mob systems.",
  "- Convert selected builds into small blueprints only after checking material cost, footprint and survival safety.",
  "- Reject oversized, decorative, creative-only and house/castle/statue builds unless the user explicitly asks.",
  "- For farms and mechanisms, extract the functional pattern: inputs, outputs, required mobs/villagers, redstone parts, footprint and maintenance access.",
  "- Build in phases: foundation, functional blocks, containers, redstone, safety shell, test access.",
  "",
  "## Candidate Selection Rules",
  "",
  "- Keep small or medium builds first.",
  "- Prefer schematics with clear tags such as farm, villager, redstone, storage, sorter, spawner, auto or hopper.",
  "- Before building in survival, run material estimation and choose a smaller variant if resources are missing.",
  "- Treat every imported build as untrusted until converted into MineAI's own blueprint format.",
  "",
  "## Next Implementation Step",
  "",
  "Create a tiny curated set from `mechanism-candidates.json`, then implement `estimate_blueprint_materials` and `build_blueprint`.",
  "",
];
writeFileSync(patternsPath, `${lines.join("\n")}\n`);

console.log(`Wrote ${candidates.length} mechanism candidates to ${path.relative(root, candidatesPath)}`);
console.log(`Wrote ${path.relative(root, patternsPath)}`);
