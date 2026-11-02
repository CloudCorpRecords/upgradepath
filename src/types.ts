/**
 * upgradepath types.
 *
 * upgradepath plans the ordered steps of one dependency
 * upgrade, from caller-supplied release facts only. The
 * caller supplies the dependency name, the currently
 * installed version, the target version, and the known
 * releases with any breaking changes and deprecation flags
 * they carry. From that data alone, as pure local
 * computation, upgradepath reports:
 *
 *   - the ordered intermediate steps between current and
 *     target
 *   - the breaking changes carried by each step
 *   - how many major boundaries the chain crosses
 *   - whether the steps actually reach the target
 *   - a verdict for the whole path
 *
 * Versions are in x.y.z form and compare numerically, so
 * leading zeros do not make a different version. The
 * verdict is "no_path", "clean", "manageable", or
 * "major_effort", decided in that precedence order.
 */

/** Verdict for a planned upgrade path. */
export type Verdict = "no_path" | "clean" | "manageable" | "major_effort";

/** One ordered step on the upgrade path. */
export interface UpgradeStep {
  /** Release version, echoed verbatim from the input. */
  version: string;
  /** Breaking changes this release carries (empty when none supplied). */
  breaking_changes: string[];
  /** Number of breaking changes this step carries. */
  breaking_count: number;
  /** Whether this release is deprecated (false when not supplied). */
  deprecated: boolean;
}

/** The planned upgrade path for one dependency. */
export interface UpgradePathResult {
  /** Dependency name, echoed from the input. */
  name: string;
  /** Currently installed version, echoed verbatim. */
  current: string;
  /** Target version, echoed verbatim. */
  target: string;
  /** Ordered steps, ascending by numeric version. */
  steps: UpgradeStep[];
  /** Number of steps. */
  step_count: number;
  /** Sum of the steps' breaking counts. */
  total_breaking: number;
  /** Major boundaries crossed walking current then the steps. */
  majors_crossed: number;
  /** True iff the last step is numerically equal to target. */
  reaches_target: boolean;
  /** Verdict for the path. */
  verdict: Verdict;
}
