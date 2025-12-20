#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

# Check if already published (idempotent)
# Handle case where package doesn't exist yet (first publish)
PUBLISHED_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "")
if [ "$PUBLISHED_VERSION" = "$PACKAGE_VERSION" ]; then
  echo "Package $PACKAGE_NAME@$PACKAGE_VERSION already published, skipping."
  exit 0
fi

# Run prepublish checks
pnpm run prepublishOnly

# Publish to npm with provenance
# If package doesn't exist, npm publish will create it (no special handling needed)
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

