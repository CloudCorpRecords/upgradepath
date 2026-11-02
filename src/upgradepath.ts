/**
 * upgradepath core: plan a safe dependency upgrade from
 * caller-supplied release facts.
 *
 *   planUpgradePath(args) -> { name, current, target, steps,
 *     step_count, total_breaking, majors_crossed,
 *     reaches_target, verdict }
 *
 * Version grammar (pinned): /^\d+\.\d+\.\d+$/ exactly.
 * Leading zeros are admitted and components compare
 * NUMERICALLY, so "01.2.3" and "1.2.3" are the same
 * version. Duplicate detection also compares numerically:
 * two releases whose versions are numerically equal are
 * duplicates and an error names the version as supplied in
 * the later entry. No partial results.
 *
 * Target (pinned): `target` must compare numerically
 * greater than `current`, otherwise an error naming
 * target.
 *
 * Steps (pinned): every release whose version is
 * numerically greater than `current` and less than or
 * equal to `target`, sorted ascending by numeric version.
 * Each step is {version, breaking_changes, breaking_count,
 * deprecated}: version and breaking_changes echo the
 * supplied values verbatim, breaking_count is the length
 * of breaking_changes (0 when absent), and deprecated
 * echoes the supplied value (false when absent).
 *
 * Summary (pinned): majors_crossed walks the chain
 * current, then the steps in ascending order, counting
 * each step whose major component differs from the major
 * of the preceding version in the chain. total_breaking
 * is the sum of the steps' breaking_count. reaches_target
 * is true iff at least one step exists and the last step's
 * version is numerically equal to `target`.
 *
 * Verdict (pinned), in this precedence order: no steps ->
 * "no_path"; total_breaking is 0 -> "clean";
 * total_breaking <= 3 -> "manageable"; otherwise ->
 * "major_effort".
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path and no
 * partial result is produced. Unknown extra fields are
 * ignored, including inside release items; a non-object
 * top-level argument is treated as {}.
 */
import type { UpgradePathResult, UpgradeStep, Verdict } from "./types.js";

export const VERSION = "0.1.0";

const VERSION_RE = /^\d+\.\d+\.\d+$/;

type VersionParts = [number, number, number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVersion(value: string): VersionParts {
  const parts = value.split(".").map((p) => Number(p));
  return [parts[0]!, parts[1]!, parts[2]!];
}

function compareVersions(a: VersionParts, b: VersionParts): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
}

function versionField(
  raw: Record<string, unknown>,
  key: "current" | "target",
): { text: string; parts: VersionParts } {
  const value = raw[key];
  if (value === undefined) throw new Error(`${key} is required`);
  if (typeof value !== "string" || !VERSION_RE.test(value)) {
    throw new Error(`${key} must be a version string (x.y.z)`);
  }
  return { text: value, parts: parseVersion(value) };
}

interface ParsedRelease {
  version: string;
  parts: VersionParts;
  breakingChanges: string[];
  deprecated: boolean;
}

/** Plan a safe upgrade path for one dependency. */
export function planUpgradePath(args: unknown): UpgradePathResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.name === undefined) throw new Error("name is required");
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new Error("name must be a non-empty string");
  }
  const name = raw.name;

  const current = versionField(raw, "current");
  const target = versionField(raw, "target");

  if (compareVersions(target.parts, current.parts) <= 0) {
    throw new Error("target must be greater than current");
  }

  if (raw.releases === undefined) throw new Error("releases is required");
  if (!Array.isArray(raw.releases) || raw.releases.length === 0) {
    throw new Error("releases must be a non-empty array");
  }

  const releases: ParsedRelease[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.releases.length; i++) {
    const item: unknown = raw.releases[i];
    const path = `releases[${i}]`;
    if (!isRecord(item)) throw new Error(`${path} must be an object`);

    if (item.version === undefined) {
      throw new Error(`${path}.version is required`);
    }
    if (typeof item.version !== "string" || !VERSION_RE.test(item.version)) {
      throw new Error(`${path}.version must be a version string (x.y.z)`);
    }
    const version = item.version;
    const parts = parseVersion(version);

    let breakingChanges: string[] = [];
    if (item.breaking_changes !== undefined) {
      if (!Array.isArray(item.breaking_changes)) {
        throw new Error(`${path}.breaking_changes must be an array of strings`);
      }
      for (let j = 0; j < item.breaking_changes.length; j++) {
        const entry: unknown = item.breaking_changes[j];
        if (typeof entry !== "string") {
          throw new Error(`${path}.breaking_changes[${j}] must be a string`);
        }
      }
      breakingChanges = [...(item.breaking_changes as string[])];
    }

    let deprecated = false;
    if (item.deprecated !== undefined) {
      if (typeof item.deprecated !== "boolean") {
        throw new Error(`${path}.deprecated must be a boolean`);
      }
      deprecated = item.deprecated;
    }

    const key = parts.join(".");
    if (seen.has(key)) {
      throw new Error(`duplicate release version: ${version}`);
    }
    seen.add(key);

    releases.push({ version, parts, breakingChanges, deprecated });
  }

  const steps: UpgradeStep[] = releases
    .filter(
      (r) =>
        compareVersions(r.parts, current.parts) > 0 &&
        compareVersions(r.parts, target.parts) <= 0,
    )
    .sort((a, b) => compareVersions(a.parts, b.parts))
    .map((r) => ({
      version: r.version,
      breaking_changes: r.breakingChanges,
      breaking_count: r.breakingChanges.length,
      deprecated: r.deprecated,
    }));

  let majorsCrossed = 0;
  let precedingMajor = current.parts[0];
  for (const step of steps) {
    const major = parseVersion(step.version)[0];
    if (major !== precedingMajor) majorsCrossed += 1;
    precedingMajor = major;
  }

  const totalBreaking = steps.reduce((sum, s) => sum + s.breaking_count, 0);

  const last = steps[steps.length - 1];
  const reachesTarget =
    last !== undefined &&
    compareVersions(parseVersion(last.version), target.parts) === 0;

  let verdict: Verdict;
  if (steps.length === 0) verdict = "no_path";
  else if (totalBreaking === 0) verdict = "clean";
  else if (totalBreaking <= 3) verdict = "manageable";
  else verdict = "major_effort";

  return {
    name,
    current: current.text,
    target: target.text,
    steps,
    step_count: steps.length,
    total_breaking: totalBreaking,
    majors_crossed: majorsCrossed,
    reaches_target: reachesTarget,
    verdict,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
