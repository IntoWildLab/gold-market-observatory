import { appendFile, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const API_ORIGIN = "https://api.vercel.com";
const SNAPSHOT_VERSION = 1;

function normalizeHostname(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const candidate = value.trim().toLowerCase();
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname;
  } catch {
    return null;
  }
}

function addHostnames(target, values) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const hostname = normalizeHostname(value);
    if (hostname) target.add(hostname);
  }
}

export function selectProductionHostnames(project, projectDomains = []) {
  const hostnames = new Set();
  const production = project?.targets?.production;

  addHostnames(hostnames, production?.alias);
  addHostnames(hostnames, production?.automaticAliases);

  for (const domain of projectDomains) {
    if (!domain || domain.gitBranch != null || domain.customEnvironmentId != null) continue;
    const hostname = normalizeHostname(domain.name);
    if (hostname) hostnames.add(hostname);
  }

  return [...hostnames].sort();
}

export function compareAliasMaps(before, after) {
  const drift = [];
  for (const [hostname, deploymentId] of Object.entries(before)) {
    if (after[hostname] !== deploymentId) {
      drift.push({ hostname, before: deploymentId, after: after[hostname] ?? null });
    }
  }
  return drift.sort((left, right) => left.hostname.localeCompare(right.hostname));
}

export function buildRestorePlan(drift) {
  return drift.map(({ hostname, before }) => ({ hostname, deploymentId: before }));
}

export function evaluateAliasInvariant(before, after) {
  const drift = compareAliasMaps(before, after);
  return { ok: drift.length === 0, drift, restorePlan: buildRestorePlan(drift) };
}

function requireEnvironment() {
  const token = process.env.VERCEL_TOKEN;
  const orgId = process.env.VERCEL_ORG_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !orgId || !projectId) {
    throw new Error("VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID are required");
  }
  return { token, orgId, projectId };
}

function withScope(url, orgId) {
  const endpoint = new URL(url, API_ORIGIN);
  if (orgId.startsWith("team_")) endpoint.searchParams.set("teamId", orgId);
  return endpoint;
}

async function requestJson(path, { method = "GET", body } = {}) {
  const { token, orgId } = requireEnvironment();
  const response = await fetch(withScope(path, orgId), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vercel API ${method} ${path} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json();
}

async function getProjectState() {
  const { projectId } = requireEnvironment();
  const [project, domainsPayload] = await Promise.all([
    requestJson(`/v9/projects/${encodeURIComponent(projectId)}`),
    requestJson(`/v9/projects/${encodeURIComponent(projectId)}/domains?limit=100`),
  ]);
  return { project, domains: Array.isArray(domainsPayload.domains) ? domainsPayload.domains : [] };
}

async function getDeployment(hostnameOrId) {
  return requestJson(`/v13/deployments/${encodeURIComponent(hostnameOrId)}`);
}

async function resolveAliasMap(hostnames) {
  const entries = await Promise.all(hostnames.map(async (hostname) => {
    const deployment = await getDeployment(hostname);
    return [hostname, deployment.id ?? null];
  }));
  return Object.fromEntries(entries);
}

async function writeOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const body = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join("");
  await appendFile(process.env.GITHUB_OUTPUT, body, "utf8");
}

async function capture(snapshotPath) {
  const { projectId } = requireEnvironment();
  const { project, domains } = await getProjectState();
  const current = project?.targets?.production;
  if (!current?.id) throw new Error("Vercel project metadata has no current Production deployment");

  const hostnames = selectProductionHostnames(project, domains);
  if (hostnames.length === 0) throw new Error("No Production aliases or domains were discovered");
  const aliases = await resolveAliasMap(hostnames);
  const mismatches = Object.entries(aliases).filter(([, deploymentId]) => deploymentId !== current.id);
  if (mismatches.length > 0) {
    throw new Error(`Production alias snapshot is not coherent with Current ${current.id}: ${mismatches.map(([host, id]) => `${host} -> ${id}`).join(", ")}`);
  }

  const snapshot = {
    version: SNAPSHOT_VERSION,
    projectId,
    capturedAt: new Date().toISOString(),
    currentProduction: { id: current.id, url: current.url ?? null },
    aliases,
  };
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeOutputs({ current_id: current.id, current_url: current.url ?? "", alias_count: hostnames.length });
  console.log(`Captured ${hostnames.length} Production alias(es) for Current ${current.id}.`);
}

async function restoreAliases(plan) {
  for (const { hostname, deploymentId } of plan) {
    await requestJson(`/now/deployments/${encodeURIComponent(deploymentId)}/aliases`, {
      method: "POST",
      body: { alias: hostname },
    });
    console.log(`Restored ${hostname} to ${deploymentId}.`);
  }
}

async function enforce(snapshotPath, stagedUrl) {
  const { projectId } = requireEnvironment();
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (snapshot.version !== SNAPSHOT_VERSION || snapshot.projectId !== projectId) {
    throw new Error("Production alias snapshot does not match the configured Vercel project");
  }

  const stagedHost = normalizeHostname(stagedUrl);
  if (!stagedHost) throw new Error("Staged deployment URL is invalid");
  if (Object.hasOwn(snapshot.aliases, stagedHost)) {
    throw new Error("Staged deployment URL was already a captured Production traffic entry point");
  }

  const staged = await getDeployment(stagedHost);
  if (staged.target !== "production" || staged.projectId !== projectId || !staged.id) {
    throw new Error("The staged deployment is not classified as Production for the configured project");
  }
  if (staged.id === snapshot.currentProduction.id) {
    throw new Error("The staged deployment is not distinct from the captured current Production deployment");
  }

  const hostnames = Object.keys(snapshot.aliases);
  const after = await resolveAliasMap(hostnames);
  const invariant = evaluateAliasInvariant(snapshot.aliases, after);
  const { drift } = invariant;
  const { project } = await getProjectState();
  const currentIdAfterDeploy = project?.targets?.production?.id ?? null;

  if (drift.length === 0 && currentIdAfterDeploy === snapshot.currentProduction.id) {
    await writeOutputs({
      status: "production-staged",
      alias_status: "unchanged",
      restoration: "not-required",
      staged_id: staged.id,
    });
    console.log(`Staged deployment ${staged.id} is distinct; all ${hostnames.length} Production aliases are unchanged.`);
    return;
  }

  let restoration = "not-attempted";
  if (drift.length > 0) {
    console.error(`::error::Production alias drift detected: ${drift.map(({ hostname, before, after: id }) => `${hostname}: ${before} -> ${id ?? "unresolved"}`).join(", ")}`);
    await restoreAliases(invariant.restorePlan);
    const restored = await resolveAliasMap(hostnames);
    const remaining = compareAliasMaps(snapshot.aliases, restored);
    if (remaining.length > 0) {
      restoration = "failed";
      await writeOutputs({ status: "failed", alias_status: "changed", restoration, staged_id: staged.id });
      throw new Error(`Production alias restoration failed for: ${remaining.map(({ hostname }) => hostname).join(", ")}`);
    }
    restoration = "verified";
  }

  await writeOutputs({ status: "failed", alias_status: drift.length > 0 ? "changed" : "unchanged", restoration, staged_id: staged.id });
  if (currentIdAfterDeploy !== snapshot.currentProduction.id) {
    throw new Error(`Vercel Current changed from ${snapshot.currentProduction.id} to ${currentIdAfterDeploy ?? "unavailable"}; aliases were ${restoration}`);
  }
  throw new Error(`Production aliases changed during staged deployment; restoration is ${restoration}`);
}

async function main(argv) {
  const [command, snapshotPath, stagedUrl] = argv;
  if (command === "capture" && snapshotPath) return capture(snapshotPath);
  if (command === "enforce" && snapshotPath && stagedUrl) return enforce(snapshotPath, stagedUrl);
  throw new Error("Usage: production-alias-safety.mjs capture <snapshot.json> | enforce <snapshot.json> <staged-url>");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
