import { readFileSync } from "node:fs";
import { parse } from "yaml";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { measurementAccountForBrand, providerAccountForBrandPlatform, providersForBrandPlatform } from "./brand-accounts.js";

const CONFIG_PATH = "config/brand-accounts.yaml";

describe("brand account registry", () => {
  test("declares non-secret provider account identities per brand", () => {
    const config = parse(readFileSync(CONFIG_PATH, "utf8")) as {
      brands?: Record<string, { provider_accounts?: Record<string, unknown> }>;
    };
    assert.deepEqual(config.brands?.["human-inference"]?.provider_accounts, {
      postiz: "human-inference/postiz",
      typefully: "human-inference/typefully",
      postpeer: "human-inference/postpeer",
      youtube: "human-inference/youtube",
      substack: "human-inference/substack",
    });
    assert.deepEqual(config.brands?.charles?.provider_accounts, {});
    assert.deepEqual(config.brands?.fiction?.provider_accounts, {});
  });

  test("declares only Human Inference's explicit measurement account", () => {
    assert.equal(measurementAccountForBrand("human-inference"), "human-inference/browser-analytics");
    assert.equal(measurementAccountForBrand("charles"), null);
    assert.equal(measurementAccountForBrand("fiction"), null);
  });

  test("does not put credentials or credential-shaped values in the registry", () => {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    assert.doesNotMatch(raw, /(?:api[_-]?key|secret|token|password|bearer)/i);
    const config = parse(raw) as { brands?: Record<string, { provider_accounts?: Record<string, unknown> }> };
    for (const brand of Object.values(config.brands ?? {})) {
      for (const account of Object.values(brand.provider_accounts ?? {})) {
        assert.equal(typeof account, "string");
        assert.match(account as string, /^[a-z0-9-]+\/[a-z0-9-]+$/);
      }
    }
  });

  test("declares platform-specific provider candidates without enabling Charles or Fiction", () => {
    const config = parse(readFileSync(CONFIG_PATH, "utf8")) as {
      brands?: Record<string, { platforms?: Record<string, { providers?: string[] }> }>;
    };
    assert.deepEqual(config.brands?.["human-inference"]?.platforms?.x?.providers, ["postiz", "typefully"]);
    assert.deepEqual(config.brands?.["human-inference"]?.platforms?.tiktok?.providers, ["postiz", "postpeer"]);
    assert.deepEqual(config.brands?.["human-inference"]?.platforms?.substack?.providers, ["substack"]);
    assert.deepEqual(config.brands?.charles?.platforms, {});
    assert.deepEqual(config.brands?.fiction?.platforms, {});
    assert.deepEqual(providersForBrandPlatform("human-inference", "x"), ["postiz", "typefully"]);
    assert.equal(providerAccountForBrandPlatform("human-inference", "x", "postiz"), "human-inference/postiz");
    assert.equal(providerAccountForBrandPlatform("human-inference", "x", "postpeer"), null);
    assert.deepEqual(providersForBrandPlatform("charles", "x"), []);
    assert.deepEqual(providersForBrandPlatform("fiction", "x"), []);
  });
});
