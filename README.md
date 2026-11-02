# upgradepath

Upgrading a dependency is rarely one jump. The releases
between where you are and where you want to be each carry
their own breaking changes, and the order you pass through
them matters. upgradepath plans that walk for a single
dependency. You supply the facts — the name, the version
you have, the version you want, and the known releases
with the breaking changes and deprecation flags you have
recorded for each — and it returns the ordered steps in
between, what each step breaks, and a verdict for the
whole path.

Nothing is fetched. Versions are never looked up and
changes are never guessed; every fact in the plan came
from the caller. Only releases numerically greater than
the current version and at most the target become steps,
sorted ascending. Versions are written `x.y.z` and
compare numerically, so `01.2.3` and `1.2.3` are the same
version — including when that makes two supplied releases
duplicates, which is an error. The target must be greater
than the current version, or the plan is rejected before
any step is chosen.

Alongside the steps, the result counts how many major
boundaries the chain crosses, walking from the current
version through each step in order, and reports whether
the last step actually reaches the target: a release list
that stops short still produces a plan, but
`reaches_target` says plainly that it does not arrive.
The verdict is decided in a fixed precedence. No steps at
all is `no_path`. A path carrying no breaking changes is
`clean`. Three or fewer breaking changes in total is
`manageable`, and anything beyond that is
`major_effort` — so a step-less plan is `no_path` even
though its breaking total is zero.

Each step echoes its version and its breaking changes
exactly as supplied, counts those changes, and reports
whether the release is deprecated (`false` when the
caller did not say). Malformed input — a missing, empty,
or non-string `name`, a version outside the `x.y.z`
grammar, a missing, non-array, or empty `releases` list,
a malformed release entry, a duplicate release version,
or a target that is not greater than the current
version — is a validation error naming the offending
path, with no partial result. Unknown extra fields are
ignored, including inside release entries.

## CLI

```bash
npx @reneturcios/upgradepath plan --input args.json
npx @reneturcios/upgradepath --version
```

`args.json` contains the full arguments object:

```json
{
  "name": "widgetlib",
  "current": "1.2.3",
  "target": "3.0.0",
  "releases": [
    { "version": "1.3.0" },
    {
      "version": "2.0.0",
      "breaking_changes": ["removed the legacy parser entry point"]
    },
    {
      "version": "2.4.1",
      "breaking_changes": ["renamed the configuration keys", "dropped Node 14 support"],
      "deprecated": true
    },
    { "version": "3.0.0" }
  ]
}
```

The result is printed as JSON:

```json
{
  "name": "widgetlib",
  "current": "1.2.3",
  "target": "3.0.0",
  "steps": [
    {
      "version": "1.3.0",
      "breaking_changes": [],
      "breaking_count": 0,
      "deprecated": false
    },
    {
      "version": "2.0.0",
      "breaking_changes": ["removed the legacy parser entry point"],
      "breaking_count": 1,
      "deprecated": false
    },
    {
      "version": "2.4.1",
      "breaking_changes": ["renamed the configuration keys", "dropped Node 14 support"],
      "breaking_count": 2,
      "deprecated": true
    },
    {
      "version": "3.0.0",
      "breaking_changes": [],
      "breaking_count": 0,
      "deprecated": false
    }
  ],
  "step_count": 4,
  "total_breaking": 3,
  "majors_crossed": 2,
  "reaches_target": true,
  "verdict": "manageable"
}
```

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or
invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/upgradepath mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "upgradepath": {
      "command": "npx",
      "args": ["-y", "@reneturcios/upgradepath", "mcp"]
    }
  }
}
```

### Tools

- `plan_upgrade_path` — Plan a safe dependency upgrade
  from caller-supplied release facts.
  - `name` (string, required, non-empty) — dependency
    name
  - `current` (string, required) — currently installed
    version, in `x.y.z` form
  - `target` (string, required) — target version, in
    `x.y.z` form; must be greater than `current`
  - `releases` (array, required, at least 1 item) —
    known releases of the dependency; each item has:
    - `version` (string, required) — release version,
      in `x.y.z` form
    - `breaking_changes` (array of strings, optional) —
      breaking changes introduced by this release;
      absent means none
    - `deprecated` (boolean, optional) — whether this
      release is deprecated; absent means false

  Returns `{name, current, target, steps, step_count,
  total_breaking, majors_crossed, reaches_target,
  verdict}`, where each step is `{version,
  breaking_changes, breaking_count, deprecated}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/upgradepath
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/upgradepath plan --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
