import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planUpgradePath } from "../src/upgradepath.js";

/**
 * All tests are pure local computation over inline release
 * lists: no filesystem and no network. The step range, the
 * ascending numeric sort, leading-zero numeric equality,
 * duplicate detection, the target-greater rule, the
 * version grammar, majors_crossed, reaches_target, the
 * verdict precedence, the absent-field defaults, the
 * verbatim echoes, and every validation path are each
 * pinned.
 */

const plan = (over: Record<string, unknown> = {}) =>
  planUpgradePath({
    name: "widgetlib",
    current: "1.2.3",
    target: "2.0.0",
    releases: [{ version: "1.3.0" }, { version: "2.0.0" }],
    ...over,
  });

describe("planUpgradePath — basic plan and output shape", () => {
  it("returns the exact output shape for a simple two-step plan", () => {
    assert.deepEqual(plan(), {
      name: "widgetlib",
      current: "1.2.3",
      target: "2.0.0",
      steps: [
        {
          version: "1.3.0",
          breaking_changes: [],
          breaking_count: 0,
          deprecated: false,
        },
        {
          version: "2.0.0",
          breaking_changes: [],
          breaking_count: 0,
          deprecated: false,
        },
      ],
      step_count: 2,
      total_breaking: 0,
      majors_crossed: 1,
      reaches_target: true,
      verdict: "clean",
    });
  });

  it("echoes name, current, and target verbatim, including leading zeros", () => {
    const out = planUpgradePath({
      name: "@scope/pkg-2",
      current: "01.02.3",
      target: "02.0.0",
      releases: [{ version: "2.0.0" }],
    });
    assert.equal(out.name, "@scope/pkg-2");
    assert.equal(out.current, "01.02.3");
    assert.equal(out.target, "02.0.0");
  });

  it("step_count and total_breaking aggregate the steps", () => {
    const out = plan({
      releases: [
        { version: "1.3.0", breaking_changes: ["a"] },
        { version: "1.4.0", breaking_changes: ["b", "c"] },
        { version: "2.0.0" },
      ],
    });
    assert.equal(out.step_count, 3);
    assert.equal(out.total_breaking, 3);
  });
});

describe("planUpgradePath — step range", () => {
  it("a release equal to current is excluded", () => {
    const out = plan({
      releases: [{ version: "1.2.3" }, { version: "2.0.0" }],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["2.0.0"],
    );
  });

  it("a release equal to target is included", () => {
    const out = plan({ releases: [{ version: "2.0.0" }] });
    assert.equal(out.step_count, 1);
    assert.equal(out.steps[0]!.version, "2.0.0");
  });

  it("a release greater than target is excluded", () => {
    const out = plan({
      releases: [{ version: "2.0.1" }, { version: "2.0.0" }],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["2.0.0"],
    );
  });

  it("a release less than current is excluded", () => {
    const out = plan({
      releases: [{ version: "0.9.9" }, { version: "1.0.0" }, { version: "2.0.0" }],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["2.0.0"],
    );
  });

  it("a release numerically equal to current via leading zeros is excluded", () => {
    const out = plan({
      releases: [{ version: "01.2.3" }, { version: "2.0.0" }],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["2.0.0"],
    );
  });
});

describe("planUpgradePath — ordering", () => {
  it("steps are sorted ascending from shuffled input", () => {
    const out = plan({
      target: "3.0.0",
      releases: [
        { version: "3.0.0" },
        { version: "1.5.0" },
        { version: "2.0.0" },
        { version: "1.3.0" },
      ],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["1.3.0", "1.5.0", "2.0.0", "3.0.0"],
    );
  });

  it("the sort is numeric, not lexical (1.10.0 after 1.9.0)", () => {
    const out = plan({
      target: "1.10.0",
      releases: [{ version: "1.10.0" }, { version: "1.9.0" }],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["1.9.0", "1.10.0"],
    );
  });

  it("the comparison is numeric on every component, not just the major", () => {
    const out = plan({
      current: "1.2.3",
      target: "1.3.0",
      releases: [{ version: "1.2.10" }, { version: "1.2.9" }, { version: "1.3.0" }],
    });
    assert.deepEqual(
      out.steps.map((s) => s.version),
      ["1.2.9", "1.2.10", "1.3.0"],
    );
  });
});

describe("planUpgradePath — leading zeros and duplicates", () => {
  it("a release spelled 01.2.3 reaches target 1.2.3 by numeric equality", () => {
    const out = planUpgradePath({
      name: "d",
      current: "1.0.0",
      target: "1.2.3",
      releases: [{ version: "01.2.3" }],
    });
    assert.equal(out.reaches_target, true);
    assert.equal(out.steps[0]!.version, "01.2.3");
  });

  it("two identical release versions are a duplicate error naming the version", () => {
    assert.throws(
      () =>
        plan({
          releases: [{ version: "1.5.0" }, { version: "1.5.0" }],
        }),
      { message: "duplicate release version: 1.5.0" },
    );
  });

  it("duplicate detection is numeric: 1.2.3 after 01.2.3 errors naming the later entry", () => {
    assert.throws(
      () =>
        planUpgradePath({
          name: "d",
          current: "1.0.0",
          target: "2.0.0",
          releases: [{ version: "01.2.3" }, { version: "1.2.3" }],
        }),
      { message: "duplicate release version: 1.2.3" },
    );
  });

  it("duplicate detection is numeric in the other order too, naming the later spelling", () => {
    assert.throws(
      () =>
        planUpgradePath({
          name: "d",
          current: "1.0.0",
          target: "2.0.0",
          releases: [{ version: "1.2.3" }, { version: "01.2.3" }],
        }),
      { message: "duplicate release version: 01.2.3" },
    );
  });

  it("duplicates are detected even when both releases fall outside the step range", () => {
    assert.throws(
      () =>
        plan({
          releases: [{ version: "0.5.0" }, { version: "0.5.0" }, { version: "2.0.0" }],
        }),
      { message: "duplicate release version: 0.5.0" },
    );
  });
});

describe("planUpgradePath — target must be greater than current", () => {
  it("a target less than current is an error naming target", () => {
    assert.throws(() => plan({ target: "1.0.0" }), {
      message: "target must be greater than current",
    });
  });

  it("a target equal to current is an error naming target", () => {
    assert.throws(() => plan({ target: "1.2.3" }), {
      message: "target must be greater than current",
    });
  });

  it("a target numerically equal to current via leading zeros is an error", () => {
    assert.throws(() => plan({ target: "01.2.3" }), {
      message: "target must be greater than current",
    });
  });

  it("a target greater by a patch component only is accepted", () => {
    const out = plan({
      target: "1.2.4",
      releases: [{ version: "1.2.4" }],
    });
    assert.equal(out.step_count, 1);
    assert.equal(out.reaches_target, true);
  });
});

describe("planUpgradePath — version grammar", () => {
  const badVersions = ["1.2", "1.2.3.4", "v1.2.3", "1.2.x", "", "1..3", "1.2.3-beta", " 1.2.3"];

  it("current rejects every non-x.y.z spelling", () => {
    for (const v of badVersions) {
      assert.throws(() => plan({ current: v }), {
        message: "current must be a version string (x.y.z)",
      });
    }
  });

  it("target rejects every non-x.y.z spelling", () => {
    for (const v of badVersions) {
      assert.throws(() => plan({ target: v }), {
        message: "target must be a version string (x.y.z)",
      });
    }
  });

  it("a release version rejects non-x.y.z spellings, naming its path", () => {
    for (const v of badVersions) {
      assert.throws(() => plan({ releases: [{ version: v }] }), {
        message: "releases[0].version must be a version string (x.y.z)",
      });
    }
  });

  it("a non-string current or target is rejected with the same message", () => {
    assert.throws(() => plan({ current: 123 }), {
      message: "current must be a version string (x.y.z)",
    });
    assert.throws(() => plan({ target: null }), {
      message: "target must be a version string (x.y.z)",
    });
  });

  it("leading zeros and multi-digit components are admitted by the grammar", () => {
    const out = planUpgradePath({
      name: "d",
      current: "00.0.1",
      target: "10.20.30",
      releases: [{ version: "10.20.30" }],
    });
    assert.equal(out.reaches_target, true);
  });
});

describe("planUpgradePath — majors_crossed", () => {
  it("no major change across the chain counts 0", () => {
    const out = plan({
      target: "1.9.9",
      releases: [{ version: "1.5.0" }, { version: "1.9.9" }],
    });
    assert.equal(out.majors_crossed, 0);
  });

  it("one major crossing counts 1", () => {
    assert.equal(plan().majors_crossed, 1);
  });

  it("two major crossings count 2", () => {
    const out = plan({
      target: "3.0.0",
      releases: [{ version: "2.0.0" }, { version: "3.0.0" }],
    });
    assert.equal(out.majors_crossed, 2);
  });

  it("a chain whose first step itself crosses counts that crossing", () => {
    const out = planUpgradePath({
      name: "d",
      current: "1.9.9",
      target: "2.1.0",
      releases: [{ version: "2.0.0" }, { version: "2.1.0" }],
    });
    assert.equal(out.majors_crossed, 1);
  });

  it("consecutive steps in the same new major do not recount it", () => {
    const out = plan({
      target: "2.5.0",
      releases: [{ version: "2.0.0" }, { version: "2.1.0" }, { version: "2.5.0" }],
    });
    assert.equal(out.majors_crossed, 1);
  });

  it("a single step jumping two majors counts 1 (one step, one differing major)", () => {
    const out = plan({
      target: "3.0.0",
      releases: [{ version: "3.0.0" }],
    });
    assert.equal(out.majors_crossed, 1);
  });

  it("no steps crosses no majors", () => {
    const out = plan({ releases: [{ version: "0.1.0" }] });
    assert.equal(out.majors_crossed, 0);
  });
});

describe("planUpgradePath — reaches_target", () => {
  it("is true when the last step equals target", () => {
    assert.equal(plan().reaches_target, true);
  });

  it("is false when the steps stop short of target", () => {
    const out = plan({ releases: [{ version: "1.5.0" }] });
    assert.equal(out.reaches_target, false);
    assert.equal(out.step_count, 1);
  });

  it("is false when there are no steps", () => {
    const out = plan({ releases: [{ version: "9.9.9" }] });
    assert.equal(out.reaches_target, false);
    assert.equal(out.step_count, 0);
  });
});

describe("planUpgradePath — verdict precedence", () => {
  it("no steps is no_path even though total_breaking is 0", () => {
    const out = plan({ releases: [{ version: "0.1.0" }] });
    assert.equal(out.total_breaking, 0);
    assert.equal(out.verdict, "no_path");
  });

  it("steps with 0 breaking changes are clean", () => {
    const out = plan({
      releases: [{ version: "1.5.0", breaking_changes: [] }, { version: "2.0.0" }],
    });
    assert.equal(out.verdict, "clean");
  });

  it("exactly 3 breaking changes are manageable", () => {
    const out = plan({
      releases: [
        { version: "1.5.0", breaking_changes: ["a", "b"] },
        { version: "2.0.0", breaking_changes: ["c"] },
      ],
    });
    assert.equal(out.total_breaking, 3);
    assert.equal(out.verdict, "manageable");
  });

  it("1 breaking change is manageable", () => {
    const out = plan({
      releases: [{ version: "2.0.0", breaking_changes: ["a"] }],
    });
    assert.equal(out.verdict, "manageable");
  });

  it("exactly 4 breaking changes are major_effort", () => {
    const out = plan({
      releases: [
        { version: "1.5.0", breaking_changes: ["a", "b"] },
        { version: "2.0.0", breaking_changes: ["c", "d"] },
      ],
    });
    assert.equal(out.total_breaking, 4);
    assert.equal(out.verdict, "major_effort");
  });

  it("breaking changes on excluded releases do not count toward the verdict", () => {
    const out = plan({
      releases: [
        { version: "0.1.0", breaking_changes: ["a", "b", "c", "d", "e"] },
        { version: "9.9.9", breaking_changes: ["f", "g", "h", "i", "j"] },
        { version: "2.0.0" },
      ],
    });
    assert.equal(out.total_breaking, 0);
    assert.equal(out.verdict, "clean");
  });
});

describe("planUpgradePath — step field defaults and verbatim echoes", () => {
  it("absent breaking_changes counts 0 and echoes as an empty array", () => {
    const out = plan({ releases: [{ version: "2.0.0" }] });
    assert.deepEqual(out.steps[0]!.breaking_changes, []);
    assert.equal(out.steps[0]!.breaking_count, 0);
  });

  it("absent deprecated echoes as false, supplied values echo exactly", () => {
    const out = plan({
      releases: [
        { version: "1.5.0" },
        { version: "1.6.0", deprecated: true },
        { version: "2.0.0", deprecated: false },
      ],
    });
    assert.deepEqual(
      out.steps.map((s) => s.deprecated),
      [false, true, false],
    );
  });

  it("version strings and breaking change strings echo verbatim", () => {
    const out = plan({
      releases: [
        {
          version: "01.05.0",
          breaking_changes: ["Removed `foo()` — use bar() instead!", ""],
        },
        { version: "2.0.0" },
      ],
    });
    assert.equal(out.steps[0]!.version, "01.05.0");
    assert.deepEqual(out.steps[0]!.breaking_changes, [
      "Removed `foo()` — use bar() instead!",
      "",
    ]);
    assert.equal(out.steps[0]!.breaking_count, 2);
  });
});

describe("planUpgradePath — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => planUpgradePath(args), { message });

  const base = {
    name: "d",
    current: "1.0.0",
    target: "2.0.0",
    releases: [{ version: "2.0.0" }],
  };

  it("name missing is an error naming name", () => {
    const { name: _drop, ...rest } = base;
    throws(rest, "name is required");
    throws({}, "name is required");
  });

  it("a non-object top-level argument is treated as {} and fails on name", () => {
    throws(null, "name is required");
    throws([], "name is required");
    throws("dep", "name is required");
    throws(42, "name is required");
    throws(undefined, "name is required");
  });

  it("name empty or non-string names name", () => {
    for (const bad of ["", 42, null, ["x"], true]) {
      throws({ ...base, name: bad }, "name must be a non-empty string");
    }
  });

  it("current missing and target missing each name their field", () => {
    const { current: _c, ...noCurrent } = base;
    throws(noCurrent, "current is required");
    const { target: _t, ...noTarget } = base;
    throws(noTarget, "target is required");
  });

  it("releases missing names releases", () => {
    const { releases: _r, ...rest } = base;
    throws(rest, "releases is required");
  });

  it("releases not an array or empty names releases", () => {
    for (const bad of ["x", 42, null, {}, []]) {
      throws({ ...base, releases: bad }, "releases must be a non-empty array");
    }
  });

  it("a release item that is not an object names its path", () => {
    for (const bad of ["1.5.0", 42, null, [], true]) {
      throws({ ...base, releases: [bad] }, "releases[0] must be an object");
    }
    throws(
      { ...base, releases: [{ version: "1.5.0" }, "oops"] },
      "releases[1] must be an object",
    );
  });

  it("a release item with a missing version names its path", () => {
    throws({ ...base, releases: [{}] }, "releases[0].version is required");
    throws(
      { ...base, releases: [{ version: "1.5.0" }, { deprecated: true }] },
      "releases[1].version is required",
    );
  });

  it("a release item with a non-string version names its path", () => {
    throws(
      { ...base, releases: [{ version: 150 }] },
      "releases[0].version must be a version string (x.y.z)",
    );
  });

  it("breaking_changes present but not an array names its path", () => {
    for (const bad of ["oops", 42, null, true, {}]) {
      throws(
        { ...base, releases: [{ version: "1.5.0", breaking_changes: bad }] },
        "releases[0].breaking_changes must be an array of strings",
      );
    }
  });

  it("a breaking_changes entry that is not a string names its indexed path", () => {
    throws(
      { ...base, releases: [{ version: "1.5.0", breaking_changes: ["ok", 7] }] },
      "releases[0].breaking_changes[1] must be a string",
    );
    throws(
      {
        ...base,
        releases: [
          { version: "1.5.0" },
          { version: "1.6.0" },
          { version: "1.7.0", breaking_changes: [null] },
        ],
      },
      "releases[2].breaking_changes[0] must be a string",
    );
  });

  it("deprecated present but not a boolean names its path", () => {
    for (const bad of ["true", 1, 0, null, []]) {
      throws(
        { ...base, releases: [{ version: "1.5.0", deprecated: bad }] },
        "releases[0].deprecated must be a boolean",
      );
    }
  });

  it("unknown extra fields are ignored, including inside release items", () => {
    const out = planUpgradePath({
      ...base,
      channel: "stable",
      releases: [{ version: "2.0.0", yanked: false, notes: "big one" }],
    });
    assert.equal(out.step_count, 1);
    assert.equal(out.verdict, "clean");
  });

  it("no partial result is produced on invalid input", () => {
    assert.throws(() =>
      planUpgradePath({
        ...base,
        releases: [{ version: "2.0.0" }, { version: "not-a-version" }],
      }),
    );
  });
});
