const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../scripts/production-alias-safety.mjs")).href;

async function loadSafety() {
  return import(moduleUrl);
}

const before = {
  "gold-market-observatory.vercel.app": "dpl_old",
  "gold-market-observatory-team.vercel.app": "dpl_old",
};

test("unchanged Production alias map allows staged validation to continue", async () => {
  const { evaluateAliasInvariant } = await loadSafety();
  assert.deepEqual(evaluateAliasInvariant(before, { ...before }), {
    ok: true,
    drift: [],
    restorePlan: [],
  });
});

test("public Production domain movement fails and produces an exact restore plan", async () => {
  const { evaluateAliasInvariant } = await loadSafety();
  const result = evaluateAliasInvariant(before, {
    ...before,
    "gold-market-observatory.vercel.app": "dpl_staged",
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.restorePlan, [{
    hostname: "gold-market-observatory.vercel.app",
    deploymentId: "dpl_old",
  }]);
});

test("project default Production alias movement fails and produces an exact restore plan", async () => {
  const { evaluateAliasInvariant } = await loadSafety();
  const result = evaluateAliasInvariant(before, {
    ...before,
    "gold-market-observatory-team.vercel.app": "dpl_staged",
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.restorePlan, [{
    hostname: "gold-market-observatory-team.vercel.app",
    deploymentId: "dpl_old",
  }]);
});

test("a new staged immutable URL is outside the captured invariant", async () => {
  const { evaluateAliasInvariant } = await loadSafety();
  const after = {
    ...before,
    "gold-market-observatory-unique-team.vercel.app": "dpl_staged",
  };
  assert.deepEqual(evaluateAliasInvariant(before, after), {
    ok: true,
    drift: [],
    restorePlan: [],
  });
});

test("discovers current target aliases and unscoped Production project domains only", async () => {
  const { selectProductionHostnames } = await loadSafety();
  const project = {
    targets: {
      production: {
        alias: ["gold-market-observatory.vercel.app"],
        automaticAliases: ["https://gold-market-observatory-team.vercel.app"],
      },
    },
  };
  const domains = [
    { name: "gold-market-observatory.vercel.app", gitBranch: null, customEnvironmentId: null },
    { name: "main-git.example.com", gitBranch: "main", customEnvironmentId: null },
    { name: "custom-env.example.com", gitBranch: null, customEnvironmentId: "env_123" },
  ];
  assert.deepEqual(selectProductionHostnames(project, domains), [
    "gold-market-observatory-team.vercel.app",
    "gold-market-observatory.vercel.app",
  ]);
});
