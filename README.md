# Shower Thoughts 💡

Raw shower ideas in, read-aloud scripts out, saved to Apple Notes. A personal tool that feeds Speak to Prompt.

**Live:** https://kmagno94.github.io/shower-thoughts/

## Status

Being built one small step at a time. Right now the page is an empty shell that proves the deploy works.

## Stack

Same as Speak to Prompt: Svelte 5 + Vite, app source in `app/`, built for iPhone Safari (`safari16`), deployed to GitHub Pages by GitHub Actions. Smoke tests run first, and a failing test stops the deploy.

## Develop

```
npm install
npm run dev     # local server
npm test        # build, then run the smoke tests at phone size
```

One-time setup (done): repo Settings > Pages > Source: GitHub Actions.

`STAGING=1 npm test` runs the same tests on the staging build (STAGING badge on).

## How releases work

**Staging:** https://kmagno94.github.io/shower-thoughts/staging/

| Step | What happens |
|---|---|
| 1. Work on `staging` | Every change goes to the `staging` branch. A push runs "Test staging", and when it passes, staging updates at `/staging/`. Live doesn't change. |
| 2. Test on staging | Staging shows a yellow STAGING badge and its version, so it never gets mixed up with live. |
| 3. Promote | Open a pull request from `staging` into `main` and merge it (merge commit). Then tag `main` with the version, for example `v0.1.2`. That push deploys live. |
| 4. Roll back | Actions > Test and deploy > Run workflow, type an older tag like `v0.1.0`. Live goes back to that version. Nothing on `main` changes, and there are no force pushes. |

Rules that keep it safe:
- `main` is locked by a GitHub ruleset: changes only arrive by pull request, and force pushes and deleting `main` are blocked.
- Both copies run the smoke tests before deploying. A failing live test stops the deploy. A failing staging test shows a "tests failed" page at `/staging/` and leaves live alone.
- The `live` git tag marks what's live right now, so a staging deploy never undoes a roll back. Only the deploy workflow moves it.
- Live and staging share one web address, so they share browser storage. Anything saved in the browser goes through `storageKey()` in `app/lib/env.js`, which adds `stg:` on staging.
- Versions are semver (`v0.1.1`), set in `package.json` and shown at the bottom of the page.
