/**
 * Unit tests for target selection logic.
 * Uses node:test — no additional dependencies.
 *
 * C3 additions: selectTargetByUrl now throws instead of returning null,
 * and multiple matches at any stage are errors.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  selectTargetByUrl,
  selectSolePageTarget,
  type CdpTarget,
} from "./target.ts";

// ── Fixtures ──────────────────────────────────────────────────

function makeTarget(overrides: Partial<CdpTarget>): CdpTarget {
  return {
    id: "t1",
    type: "page",
    title: "Test",
    url: "https://example.com/",
    webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/t1",
    ...overrides,
  };
}

const CHROME_TARGET = makeTarget({
  id: "chrome1",
  url: "chrome://newtab/",
  title: "New Tab",
});

const DEVTOOLS_TARGET = makeTarget({
  id: "devtools1",
  url: "devtools://devtools/bundled/devtools_app.html",
  title: "DevTools",
});

const ABOUT_TARGET = makeTarget({
  id: "about1",
  url: "about:blank",
  title: "about:blank",
});

// ── selectTargetByUrl ─────────────────────────────────────────

describe("selectTargetByUrl", () => {
  // ── success cases ──

  it("exact match: single match returns the target", () => {
    const t = makeTarget({ url: "https://example.com/foo" });
    const result = selectTargetByUrl([t], "https://example.com/foo");
    assert.equal(result.id, t.id);
  });

  it("path partial match: single match returns the target", () => {
    const t = makeTarget({ url: "https://example.com/reports/pl" });
    const result = selectTargetByUrl([t], "https://example.com/reports");
    assert.equal(result.id, t.id);
  });

  it("host match fallback: single match returns the target", () => {
    const t = makeTarget({ url: "https://example.com/some-path" });
    const result = selectTargetByUrl([t], "https://example.com/other");
    assert.equal(result.id, t.id);
  });

  it("exact match wins over path/host match", () => {
    const exact = makeTarget({ id: "exact", url: "https://example.com/foo" });
    const partial = makeTarget({ id: "partial", url: "https://example.com/foobar" });
    const result = selectTargetByUrl([partial, exact], "https://example.com/foo");
    assert.equal(result.id, "exact");
  });

  // ── no-match cases (C3: now throw instead of returning null) ──

  it("throws when no targets at all", () => {
    assert.throws(
      () => selectTargetByUrl([], "https://example.com/"),
      /No tab matches/
    );
  });

  it("throws when only chrome:// targets exist", () => {
    assert.throws(
      () => selectTargetByUrl([CHROME_TARGET], "chrome://newtab/"),
      /No tab matches/
    );
  });

  it("throws when only devtools:// targets exist", () => {
    assert.throws(
      () => selectTargetByUrl([DEVTOOLS_TARGET], "devtools://devtools/bundled/devtools_app.html"),
      /No tab matches/
    );
  });

  it("throws for invalid URL hint", () => {
    const t = makeTarget({ url: "https://example.com/" });
    assert.throws(
      () => selectTargetByUrl([t], "not-a-url"),
      /No tab matches.*invalid URL/
    );
  });

  // ── C3: multiple-match cases must throw ──

  it("C3: multiple exact matches → throws", () => {
    const t1 = makeTarget({ id: "a", url: "https://example.com/foo" });
    const t2 = makeTarget({ id: "b", url: "https://example.com/foo" });
    assert.throws(
      () => selectTargetByUrl([t1, t2], "https://example.com/foo"),
      /Multiple tabs match exact URL/
    );
  });

  it("C3: multiple path matches → throws", () => {
    // Both start with /reports but the hint is /reports (no exact match)
    const t1 = makeTarget({ id: "a", url: "https://example.com/reports/pl" });
    const t2 = makeTarget({ id: "b", url: "https://example.com/reports/bs" });
    assert.throws(
      () => selectTargetByUrl([t1, t2], "https://example.com/reports"),
      /Multiple tabs match path/
    );
  });

  it("C3: multiple host matches → throws (ambiguous host-only input)", () => {
    // Simulates: user has example.com/a and example.com/b open, passes example.com/other
    const t1 = makeTarget({ id: "a", url: "https://example.com/a" });
    const t2 = makeTarget({ id: "b", url: "https://example.com/b" });
    // hint doesn't path-match either, so falls to host stage where both match
    assert.throws(
      () => selectTargetByUrl([t1, t2], "https://example.com/other"),
      /Multiple tabs match host/
    );
  });

  it("C3: host-only hint with two tabs at same host → throws", () => {
    const t1 = makeTarget({ id: "a", url: "https://stripe.com/pricing" });
    const t2 = makeTarget({ id: "b", url: "https://stripe.com/docs" });
    assert.throws(
      () => selectTargetByUrl([t1, t2], "https://stripe.com/"),
      // "/" is a prefix of all paths, so path stage picks them both up
      /Multiple tabs match/
    );
  });
});

// ── selectSolePageTarget ─────────────────────────────────────

describe("selectSolePageTarget", () => {
  it("returns sole user page target", () => {
    const t = makeTarget({ id: "p1", url: "https://stripe.com/" });
    const result = selectSolePageTarget([t, CHROME_TARGET]);
    assert.equal(result.id, "p1");
  });

  it("throws when 0 user page targets", () => {
    assert.throws(
      () => selectSolePageTarget([CHROME_TARGET, DEVTOOLS_TARGET, ABOUT_TARGET]),
      /No page targets found/
    );
  });

  it("throws when 2+ user page targets", () => {
    const t1 = makeTarget({ id: "p1", url: "https://stripe.com/" });
    const t2 = makeTarget({ id: "p2", url: "https://example.com/" });
    assert.throws(
      () => selectSolePageTarget([t1, t2]),
      /Multiple page targets/
    );
  });

  it("throws when list is empty", () => {
    assert.throws(
      () => selectSolePageTarget([]),
      /No page targets found/
    );
  });

  it("excludes about:blank from user targets", () => {
    assert.throws(
      () => selectSolePageTarget([ABOUT_TARGET]),
      /No page targets found/
    );
  });

  it("excludes non-page type targets", () => {
    const serviceWorker = makeTarget({
      id: "sw1",
      type: "service_worker",
      url: "https://example.com/sw.js",
    });
    assert.throws(
      () => selectSolePageTarget([serviceWorker]),
      /No page targets found/
    );
  });
});
