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
  # Use the npmrc location that setup-node uses, or create our own
  NPMRC_FILE="${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
  echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" > "$NPMRC_FILE"
  echo "Configured .npmrc at $NPMRC_FILE"
  # Also set the environment variable for npm
  export NPM_CONFIG_USERCONFIG="$NPMRC_FILE"
else
  echo "Warning: NODE_AUTH_TOKEN not set, checking for existing .npmrc..."
fi

# Verify authentication
echo "Testing npm authentication..."
npm whoami --registry=https://registry.npmjs.org || {
  echo "Error: npm authentication failed. Please check NODE_AUTH_TOKEN secret."
  echo "NPMRC file location: ${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
  echo "Token present: $([ -n "${NODE_AUTH_TOKEN:-}" ] && echo "yes" || echo "no")"
  exit 1
}
echo "npm authentication successful"

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

