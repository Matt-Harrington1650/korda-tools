# Repository Governance (v1)

## Branching Strategy
Selected model: **Trunk-based development**.

Binding rules:
- `main` is the only long-lived branch.
- All changes land through short-lived feature/fix branches and Pull Requests.
- Branch lifetime target: less than 3 days.
- Rebase or merge `main` into branch before requesting final review.
- Direct pushes to `main` are prohibited.

Rationale for solo -> small team:
- Minimizes branch drift and merge complexity.
- Keeps integration continuous and review surface small.
- Fits current CI footprint and release cadence.

## Required PR Checks
Required status checks before merge to `main`:
- `ci / web-checks`

Required PR conditions:
- At least 1 approving review.
- All review conversations resolved.
- PR title follows Conventional Commits.
- PR includes completed Definition of Done checklist.

## CODEOWNERS Policy
Binding policy:
- Every path must have an owner rule.
- Changes to governance, security, and release workflows require owner review.
- If team ownership is not yet assigned, use placeholder owner and replace before first external contributor merge.

Minimum ownership coverage:
- `*` default owner.
- `.github/` owner.
- `docs/` owner.
- `src-tauri/` owner.
- `src/` owner.

## Commit Conventions
Conventional Commits required:
- `feat: ...` new user-facing capability.
- `fix: ...` bug fix.
- `docs: ...` documentation-only change.
- `refactor: ...` internal change with no behavior change.
- `test: ...` tests only.
- `build: ...` build/dependency/tooling change.
- `ci: ...` workflow or automation change.
- `chore: ...` maintenance task.

Breaking changes:
- Use `!` after type/scope (example: `feat(api)!: ...`) or include `BREAKING CHANGE:` footer.

## SemVer Rules
Version scheme: `MAJOR.MINOR.PATCH`.

Rules:
- `MAJOR`: incompatible API/behavior changes or data model changes requiring migration behavior changes.
- `MINOR`: backward-compatible features.
- `PATCH`: backward-compatible bug fixes, docs-only release notes corrections, or non-breaking maintenance.

Additional constraints:
- Pre-1.0 still follows SemVer semantics for release discipline.
- Version source of truth is `package.json` and release tag.

## Release Tagging + Release Notes Process
Tag format:
- Stable release tag: `vX.Y.Z`.
- Optional pre-release tag: `vX.Y.Z-rc.N`.

Process:
1. Ensure `main` passes all required checks.
2. Update `CHANGELOG.md` by moving items from `Unreleased` into new version/date section.
3. Bump version in `package.json` (and lockfile update if required).
4. Create annotated tag `vX.Y.Z` on release commit.
5. Push tag to origin to trigger `release-windows` workflow.
6. Publish GitHub release notes from the matching `CHANGELOG.md` section.
7. Store release artifact hash/provenance in project audit records.

## GitHub Settings Instructions (Plain Text)
Repository settings to enforce:
1. Protect `main`:
- Settings -> Branches -> Add branch protection rule.
- Branch name pattern: `main`.

2. Require 1 PR review:
- Enable "Require a pull request before merging".
- Set "Required approving reviews" to `1`.

3. Require status checks:
- Enable "Require status checks to pass before merging".
- Select required check: `ci / web-checks`.

4. Disallow force pushes:
- Ensure "Allow force pushes" is disabled for `main`.

5. Require linear history (recommended):
- Enable "Require linear history".
- Use squash merge or rebase merge only.

## PR Definition of Done Checklist
- [ ] PR title uses Conventional Commit format.
- [ ] Scope is project-boundary safe and does not introduce cross-client leakage.
- [ ] Tests added/updated for behavior changes.
- [ ] CI required checks pass.
- [ ] Docs updated (`CHANGELOG.md`, architecture/governance docs if impacted).
- [ ] Security/policy impacts documented in PR description.
- [ ] Reviewer comments resolved.

## Definition of Done
- Governance document is committed at `/docs/repo_governance_v1.md`.
- Branching, checks, CODEOWNERS, commit, SemVer, and release policy are explicitly defined.
- GitHub settings instructions are present and actionable.
- PR Definition of Done checklist is included.
- Supporting files (`CHANGELOG.md`, PR template, issue templates, CODEOWNERS, labels doc) are present.

## Tests
Manual verification steps:
1. Confirm branch protection on `main` enforces 1 review, required checks, and no force pushes.
2. Open a test PR and verify `.github/pull_request_template.md` checklist appears.
3. Create sample issues and verify bug/feature templates auto-load.
4. Run `git log --oneline -n 20` and verify commit message convention adherence.
5. Confirm `CHANGELOG.md` has `Unreleased` section and versioned sections.
6. Confirm `CODEOWNERS` loads in GitHub and requests expected reviewers.
7. Confirm labels in `/docs/labels_v1.md` exist in repository label settings.