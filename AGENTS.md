# Agent Guidelines

## Commit Style

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to drive the automated release pipeline.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types and their effect on versioning

| Type       | SemVer bump | When to use                                           |
|------------|-------------|-------------------------------------------------------|
| `fix`      | `patch`     | Bug fix or small correction                           |
| `feat`     | `minor`     | New feature or capability                             |
| `BREAKING CHANGE` | `major` | Any backward-incompatible change (in footer or after `!`) |
| `build`    | none        | Build system or external dependencies                 |
| `chore`    | none        | Maintenance tasks that don't affect source code       |
| `ci`       | none        | CI/CD configuration changes                           |
| `docs`     | none        | Documentation-only changes                            |
| `perf`     | `patch`     | Performance improvement                               |
| `refactor` | none        | Code change that neither fixes a bug nor adds a feat  |
| `style`    | none        | Formatting, missing semicolons, etc.                  |
| `test`     | none        | Adding or correcting tests                            |

### Important rules

1. **Only `fix`, `feat`, and `BREAKING CHANGE` trigger a release.**
2. **A push to `main` with only `chore`, `docs`, `ci`, `style`, `refactor`, or `test` commits will NOT create a new release.**
3. **The release workflow automatically bumps `package.json`, creates a git tag, builds the app, and publishes a GitHub Release.**
4. **Do not bump `package.json` version manually.** The CI handles it.

### Examples

```bash
# Patch release (0.0.1 → 0.0.2)
git commit -m "fix: correct logger timestamp"

# Minor release (0.0.2 → 0.1.0)
git commit -m "feat: add dark mode toggle"

# Major release (0.1.0 → 1.0.0)
git commit -m "feat: redesign settings API

BREAKING CHANGE: old settings schema is no longer supported"
```

## Release Pipeline

- Trigger: `push` to `main`
- Action: `TriPSs/conventional-changelog-action@v5` analyzes commits, bumps version, commits `package.json`, and creates a tag
- Build: macOS app is built via `bun run build:stable`
- Publish: GitHub Release is created at `https://github.com/sygeman/exodus/releases/latest/download`
- Updater: Electrobun auto-updater checks `update.json` from the latest release

## Notes for Agents

- Keep commits atomic and use the correct type.
- If a change includes both a fix and a feature, split it into two commits when possible.
- Never force-push to `main` unless explicitly asked.
- After the CI bumps `package.json`, run `git pull` locally to stay in sync.
- **Zero tolerance for lint/type warnings and bugs.** Always run `bun run lint` and `bun run typecheck` after making changes and fix all errors and warnings before finishing. Do not leave any `any` types or type casts in new or modified code — use proper types derived from schemas.

## Agent Tool Usage

- **Do NOT use the `task` subagent tool.** Always use direct tool calls (`read`, `edit`, `bash`, `grep`, etc.) instead.

## Event Naming Convention

- **All event names must use kebab-case strictly.**
- The event namespace must match the module name exactly.
- Examples: `logger:entry`, `app-state:route-changed`, `updater:check-update`, `schema:request-response`
- Payload property names in schemas must also use kebab-case.
