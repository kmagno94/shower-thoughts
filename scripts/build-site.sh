#!/usr/bin/env bash
# Builds the whole GitHub Pages site in .site/:
#   /shower-thoughts/          live, from the git ref passed in (main, or a version tag on a roll back)
#   /shower-thoughts/staging/  staging, from the staging branch (STAGING=1 build)
# Each copy runs its own smoke tests first. A failing live test stops the deploy.
# A failing staging test only replaces /staging/ with a "tests failed" page, so a
# broken staging push can never block live (or a roll back).
# Usage: scripts/build-site.sh <live ref> <repo name>
set -euo pipefail
LIVE_REF="$1"
NAME="$2"
rm -rf .site .wt
git worktree prune
mkdir -p .site .wt
BROWSER_READY="${BROWSER_READY:-0}"  # set to 1 when Chromium is already installed (local runs)

build() { # <ref> <folder> <base path> <staging 0|1>
  git worktree add --detach ".wt/$2" "$1" && (
    cd ".wt/$2" &&
    npm ci &&
    { [ "$BROWSER_READY" = 1 ] || npx playwright install --with-deps chromium; } &&
    STAGING="$4" npm test &&
    STAGING="$4" BASE_PATH="$3" npm run build
  )
}

echo "::group::Live from $LIVE_REF"
build "$LIVE_REF" live "/$NAME/" 0
BROWSER_READY=1
cp -R .wt/live/dist/. .site/
echo "::endgroup::"

if git rev-parse -q --verify origin/staging >/dev/null; then
  echo "::group::Staging from origin/staging"
  mkdir -p .site/staging
  if build origin/staging staging "/$NAME/staging/" 1; then
    cp -R .wt/staging/dist/. .site/staging/
  else
    echo "::warning::Staging tests failed, so /staging/ shows a notice instead of the app. Live is not affected."
    cat > .site/staging/index.html <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Staging: tests failed</title></head>
<body style="font:17px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px">
<h1 style="font-size:24px">Staging didn't pass its tests</h1>
<p>The newest push to the staging branch failed its smoke tests, so it isn't shown here. Your live app is unchanged.</p>
<p>Open the repo's Actions tab to see which test failed.</p>
</body></html>
HTML
  fi
  echo "::endgroup::"
fi
