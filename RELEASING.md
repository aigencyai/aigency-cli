# Releasing `aigency`

Releases are automated by [`.github/workflows/release.yml`](.github/workflows/release.yml).
**Pushing a `v*` tag ships all three channels** — npm, the GitHub Release
(self-contained Homebrew tarball), and the `aigencyai/homebrew-tap` formula bump.

## Cut a release

```bash
# 1. Add a section to CHANGELOG.md for the new version, then commit it.
git add CHANGELOG.md && git commit -m "docs: changelog for vX.Y.Z"

# 2. Bump the version (updates package.json + package-lock.json, commits, tags).
npm version patch     # or: minor | major

# 3. Push the commit and the tag — CI takes over from the tag.
git push --follow-tags
```

That's it. Watch the run under the repo's **Actions** tab. When it's green:

```bash
npx aigency@latest          # npm
brew upgrade aigency        # Homebrew
```

## What CI does (in order)

1. **Verify** the pushed tag matches `package.json` `version` (fails fast on drift).
2. **Test** — `npm run typecheck`, `vitest`, `npm run build`.
3. **Pack** the brew tarball — a clean staging dir with `dist` + **production**
   `node_modules` (`npm ci --omit=dev`), smoke-tested headless (must print the
   no-TTY hint and exit 1), then `tar` + `sha256`.
4. **npm publish** — with provenance; skipped if that version is already on npm.
5. **GitHub Release** — creates `vX.Y.Z` with the tarball asset and the matching
   CHANGELOG section as notes (re-runs `--clobber` the asset).
6. **Homebrew tap** — clones `aigencyai/homebrew-tap`, rewrites the formula's
   `url` + `sha256`, and pushes directly to its `main` (commit-only-if-changed).

Every step is idempotent, so re-running a failed run from the Actions tab is safe.

## One-time setup — required repo secrets

> Settings → Secrets and variables → Actions → New repository secret

| Secret | What | Why |
| --- | --- | --- |
| `NPM_TOKEN` | An npm **Automation** token for the `aigencyai` account ([npmjs.com](https://www.npmjs.com/) → Access Tokens → Generate → *Automation*). | The account uses 2FA; Automation tokens are the only kind that can `npm publish` from CI without an OTP prompt. |
| `HOMEBREW_TAP_TOKEN` | A PAT (fine-grained, `Contents: Read and write` scoped to `aigencyai/homebrew-tap`; or a classic token with `repo`). | The built-in `GITHUB_TOKEN` is scoped to this repo only and can't push to the tap. |

Set them from the CLI (paste the value when prompted):

```bash
gh secret set NPM_TOKEN          --repo aigencyai/aigency-cli
gh secret set HOMEBREW_TAP_TOKEN --repo aigencyai/aigency-cli
```

If a secret is missing the corresponding step fails loudly; the earlier steps
(test/build/pack) still pass, so nothing is half-shipped.

## Manual fallback

The hand recipe still works if CI is unavailable — see the "Release recipe"
notes in the project memory, or reproduce the workflow steps locally:
build the staging tarball, `gh release create`, `npm publish`, then edit
`Formula/aigency.rb` in the tap and push.
