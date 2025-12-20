#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

# Check if already published (idempotent)
PUBLISHED_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "")
if [ "$PUBLISHED_VERSION" = "$PACKAGE_VERSION" ]; then
  echo "Package $PACKAGE_NAME@$PACKAGE_VERSION already published, skipping."
  exit 0
fi

# Verify npm authentication
echo "Verifying npm authentication..."
# Ensure npmrc is configured - setup-node creates it, but we need to ensure it's used
if [ -n "${NODE_AUTH_TOKEN:-}" ]; then
  # Create/update .npmrc with the token
  echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" > "${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
  echo "Configured .npmrc at ${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
fi

npm whoami || {
  echo "Error: npm authentication failed. Please check NODE_AUTH_TOKEN secret."
  exit 1
}

# Run prepublish checks
pnpm run prepublishOnly

# Publish to npm with provenance
npm publish --provenance --access public

# Create git tag
TAG="v$PACKAGE_VERSION"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists, skipping."
else
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git tag "$TAG"
  git push origin "$TAG"
fi

# Create GitHub Release (idempotent)
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "GitHub Release $TAG already exists, skipping."
else
  gh release create "$TAG" --title "$TAG" --generate-notes
fi

