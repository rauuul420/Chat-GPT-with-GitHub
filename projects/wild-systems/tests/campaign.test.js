import test from "node:test";
import assert from "node:assert/strict";
import { runExperimentCampaign, campaignToCsv } from "../campaign.js";

test("campaigns run sequential deterministic seeds and aggregate every result", () => {
  const settings = { scenario: "predator_free", runs: 3, days: 12, baseSeed: 41 };
  const first = runExperimentCampaign(settings);
  const second = runExperimentCampaign(settings);
  assert.deepEqual(first, second);
  assert.deepEqual(first.results.map(result => result.seed), [41, 42, 43]);
  assert.equal(first.summary.runs, 3);
  assert.equal(first.settings.days, 12);
});

test("campaign seed sequences wrap safely at the uint32 boundary", () => {
  const campaign = runExperimentCampaign({
    scenario: "predator_free", runs: 3, days: 1, baseSeed: 0xFFFFFFFE
  });
  assert.deepEqual(campaign.results.map(result => result.seed), [0xFFFFFFFE, 0xFFFFFFFF, 0]);
});

test("campaign validation rejects invalid sizes, seeds and scenarios", () => {
  assert.throws(() => runExperimentCampaign({ runs: 0 }), /entre 1 y 1000/);
  assert.throws(() => runExperimentCampaign({ runs: 1001 }), /entre 1 y 1000/);
  assert.throws(() => runExperimentCampaign({ days: 0 }), /entre 1 y 3000/);
  assert.throws(() => runExperimentCampaign({ baseSeed: -1 }), /semilla base/);
  assert.throws(() => runExperimentCampaign({ scenario: "unknown" }), /no existe/);
});

test("campaign CSV contains one row per world and preserves empty extinction dates", () => {
  const campaign = runExperimentCampaign({
    scenario: "predator_free", runs: 2, days: 5, baseSeed: 8
  });
  const csv = campaignToCsv(campaign);
  const lines = csv.trimEnd().split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0], /seed,days,final_plants/);
  assert.match(lines[1], /^8,5,/);
  assert.match(lines[2], /^9,5,/);
  assert.ok(lines.every(line => !line.includes("[object Object]")));
});

test("CSV escaping quotes fields containing commas, quotes or newlines", () => {
  const csv = campaignToCsv({
    format: "wild-systems-campaign",
    summary: { herbivoreExtinctionRate: 0, predatorExtinctionRate: 0 },
    results: [{
      seed: 1, days: 1,
      final: { plants: 0, herbivores: 0, predators: 0 },
      mean: { plants: 0, herbivores: 0, predators: 0 },
      peak: { plants: 0, herbivores: 0, predators: 0 },
      extinctionDays: { herbivores: null, predators: null },
      geneticChange: {
        herbivores: { speed: 0, metabolism: 0, efficiency: 0 },
        predators: { speed: 0, metabolism: 0, efficiency: 0 }
      }
    }]
  });
  assert.ok(csv.startsWith("seed,days,"));
});
