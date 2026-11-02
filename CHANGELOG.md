# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `plan_upgrade_path` MCP tool and `plan`
  CLI command planning a safe upgrade for one dependency
  from caller-supplied release facts only.
- Pinned version grammar: `x.y.z` with numeric comparison
  of every component; leading zeros are admitted and two
  spellings of the same numeric version are the same
  version, including for duplicate detection.
- Pinned steps: every release numerically greater than
  `current` and at most `target`, sorted ascending, each
  echoing its version and breaking changes verbatim with a
  breaking count and a deprecated flag.
- Pinned summary: `majors_crossed` counts the steps whose
  major differs from the preceding version in the chain
  starting at `current`; `reaches_target` requires a step
  numerically equal to `target`; the verdict is
  `no_path`, then `clean`, then `manageable` (at most 3
  breaking changes), then `major_effort`, in that
  precedence order.
- Path-naming validation errors for malformed input,
  including the required `name`, `current`, `target`, and
  `releases` fields and the rule that `target` must be
  greater than `current`.
