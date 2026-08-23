import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { normalizeForSubstantiveChange } from "./data-change-lib.mjs";

const dataPaths = ["data/series", "data/derived", "data/manifest.json", "data/latest-spot.json", "data/latest-cn-etf.json"];

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", ...options }).trim();
}

function fromHead(file) {
  try {
    return git(["show", `HEAD:${file}`]);
  } catch {
    return null;
  }
}

const names = git(["diff", "--name-only", "--", ...dataPaths])
  .split(/\r?\n/)
  .filter((name) => name.endsWith(".json"));

const substantive = [];
const auditOnly = [];

for (const file of names) {
  const currentText = await readFile(file, "utf8");
  const headText = fromHead(file);
  if (headText === null) {
    substantive.push(file);
    continue;
  }

  let current;
  let previous;
  try {
    current = JSON.parse(currentText);
    previous = JSON.parse(headText);
  } catch {
    substantive.push(file);
    continue;
  }

  if (JSON.stringify(normalizeForSubstantiveChange(current)) === JSON.stringify(normalizeForSubstantiveChange(previous))) auditOnly.push(file);
  else substantive.push(file);
}

const changed = substantive.length > 0;
console.log(`Substantive data changed: ${changed ? "Yes" : "No"}`);
if (substantive.length) console.log(`Substantive files:\n- ${substantive.join("\n- ")}`);
if (auditOnly.length) console.log(`Audit-metadata-only files:\n- ${auditOnly.join("\n- ")}`);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `changed=${changed}\nsubstantive_count=${substantive.length}\naudit_only_count=${auditOnly.length}\n`,
    "utf8",
  );
}
