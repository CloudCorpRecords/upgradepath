# upgradepath — Build Report

MCP Rebuild 1000, Batch 18. Original program build from the
packages-100 plan (cluster F #63), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch18/upgradepath.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `upgradepath`, npm `@reneturcios/upgradepath`,
MCP name `io.github.CloudCorpRecords/upgradepath`, version
`0.1.0`, bin `upgradepath` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Plan a safe
  dependency upgrade path: ordered intermediate versions,
  breaking changes, verdict." — 94 chars, verified by count;
  npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/upgradepath:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/upgradepath"`),
  `tsconfig.json` (copied unchanged from the reference),
  `.gitignore`, `LICENSE` (MIT, Copyright (c) 2026 Rene
  Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`plan --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/upgradepath.ts` (core,
  `VERSION = "0.1.0"`, `formatPayload`)
- `test/upgradepath.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/upgradepath`,
  smoke-test server-name assertion `upgradepath`)

Plus the parity fixture at
`harness/fixtures/upgradepath-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster F #63.

## Tools implemented (1)

- `plan_upgrade_path` — arguments: `name` (string,
  required, non-empty), `current` (string, required),
  `target` (string, required), and `releases` (array,
  required, at least 1 item). Each release item has
  `version` (string, required), `breaking_changes`
  (array of strings, optional, absent means none), and
  `deprecated` (boolean, optional, absent means false).
  Required is exactly `["name", "current", "target",
  "releases"]`.

  Version handling is pinned: the grammar is
  `/^\d+\.\d+\.\d+$/` exactly, leading zeros are admitted,
  and components compare NUMERICALLY, so "01.2.3" and
  "1.2.3" are the same version. Duplicate detection also
  compares numerically and an error names the version as
  supplied in the later entry (`duplicate release version:
  <later spelling>`). `target` must compare numerically
  greater than `current`, otherwise `target must be
  greater than current`.

  Steps are pinned: every release numerically greater than
  `current` and less than or equal to `target`, sorted
  ascending by numeric version. Each step is `{version,
  breaking_changes, breaking_count, deprecated}` with
  version and breaking_changes echoed verbatim,
  breaking_count the length of breaking_changes (0 when
  absent, which echoes as `[]`), and deprecated echoing
  the supplied value (false when absent).

  The summary is pinned: `majors_crossed` walks the chain
  current, then the steps in ascending order, counting
  each step whose major differs from the major of the
  preceding version in the chain; `total_breaking` is the
  sum of the steps' breaking_count; `reaches_target` is
  true iff at least one step exists and the last step's
  version is numerically equal to `target`. The verdict,
  in precedence order, is: no steps → "no_path";
  total_breaking 0 → "clean"; total_breaking <= 3 →
  "manageable"; otherwise → "major_effort".

  Returns `{name, current, target, steps, step_count,
  total_breaking, majors_crossed, reaches_target,
  verdict}`, with current and target echoing the supplied
  strings verbatim and step_count the number of steps.

  The fixture literal
  (`harness/fixtures/upgradepath-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing, empty,
  or non-string `name`; a missing, non-string, or
  off-grammar `current` or `target`; `releases` missing,
  not an array, or empty; an item that is not an object;
  an item's `version` missing, non-string, or off-grammar
  (`releases[i].version must be a version string (x.y.z)`);
  `breaking_changes` present but not an array, or any
  entry not a string (`releases[i].breaking_changes[j]
  must be a string`); `deprecated` present but not a
  boolean; a numerically duplicate release; or a target
  not greater than current throws an Error naming the
  offending path and produces no partial result (MCP:
  `isError`; CLI: exit 1). Unknown extra fields are
  ignored, including inside release items; a non-object
  top-level argument is treated as {}.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **58 tests,
  58 pass, 0 fail** — the exact output shape; verbatim
  echoes of name/current/target including leading zeros;
  the step range (release equal to current excluded,
  including a leading-zero spelling of current; equal to
  target included; greater than target and less than
  current excluded); ascending sort from shuffled input,
  proven numeric rather than lexical on the minor
  (1.9.0 before 1.10.0) and patch (1.2.9 before 1.2.10)
  components; leading-zero numeric equality (release
  "01.2.3" reaches target "1.2.3" and echoes verbatim);
  duplicate detection (exact duplicates, numeric
  duplicates in both spelling orders naming the later
  entry, and duplicates outside the step range); the
  target rule (target less than, equal to, and
  leading-zero-equal to current all error; a patch-only
  increase is accepted); grammar rejections for current,
  target, and release versions ("1.2", "1.2.3.4",
  "v1.2.3", "1.2.x", empty, and further malformed
  spellings, plus non-string values); majors_crossed (0
  with no major change, 1 for one crossing, 2 for two, a
  chain whose first step itself crosses, consecutive
  same-major steps not recounting, a single step jumping
  two majors counting 1, and 0 with no steps);
  reaches_target true, false when steps stop short, and
  false with no steps; verdict precedence (no steps →
  "no_path" even though total_breaking is 0; 0 breaking →
  "clean"; exactly 3 and 1 → "manageable"; exactly 4 →
  "major_effort"; breaking changes on excluded releases
  not counted); absent breaking_changes counting 0 and
  echoing as `[]`; deprecated defaulting to false and
  echoing supplied values; verbatim echo of version
  strings and breaking-change strings in steps; and every
  validation path (missing/empty/non-string `name`,
  missing `current`/`target`, missing/non-array/empty
  `releases`, non-object items, missing/non-string item
  versions, non-array `breaking_changes`, non-string
  breaking entries at their indexed paths, non-boolean
  `deprecated`, non-object top-level treated as {},
  unknown extras ignored top-level and inside items, and
  no partial result).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `plan` with no `--input` exits 2;
  `plan --input <missing file>` exits 1 naming the file;
  `plan --input <valid file>` exits 0 and prints the
  hand-checked result (steps 1.3.0, 2.0.0 with 1 breaking
  change and deprecated true, 3.0.0; step_count 3,
  total_breaking 1, majors_crossed 2, reaches_target
  true, verdict "manageable") for the input
  `{"name": "widgetlib", "current": "1.2.3", "target":
  "3.0.0", "releases": [{"version": "3.0.0"},
  {"version": "1.3.0"}, {"version": "2.0.0",
  "breaking_changes": ["removed the legacy parser entry
  point"], "deprecated": true}]}`; `plan --input
  <invalid file>` (releases "1.5.0" then "01.5.0") exits
  1 with `duplicate release version: 01.5.0`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/upgradepath-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/upgradepath`, **128 package entries**.
Resolved versions match the sibling reference tree
(`@modelcontextprotocol/sdk` 1.32.2, `zod` 3.25.76,
`tsx` 4.23.15, `typescript` 5.9.3, `@types/node`
20.19.43, `qs` 6.17.0). The subsequent offline
`npm install --ignore-scripts --offline`, build, tests,
and parity all ran against this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated test
  where applicable): (1) a step whose major jumps by more
  than one (e.g. current 1.x to a single step at 3.0.0)
  counts as 1 crossed major, because the spec counts
  steps whose major differs from the preceding version,
  not the size of the jump; (2) duplicate detection is
  global over the whole `releases` list, not scoped to
  the step range, because the spec states it of releases
  without a range qualification; (3) an absent
  `breaking_changes` echoes in a step as an empty array,
  because the step shape always carries the field and
  breaking_count is defined as its length; (4) unknown
  extra fields are ignored rather than rejected, as the
  spec states; (5) a non-object top-level arguments value
  is treated as an empty object, so it fails as `name is
  required`; (6) error-message wording follows the spec's
  examples and the fleet's path-naming pattern (e.g.
  `releases[2].version must be a version string (x.y.z)`,
  `duplicate release version: 1.2.3`, `target must be
  greater than current`). No other spec ambiguity was
  found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
