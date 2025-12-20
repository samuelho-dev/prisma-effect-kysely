# Changesets

This directory contains changesets for managing versioning and releases.

## What are changesets?

Changesets are a way to declare changes that should be reflected in the package version and changelog. Each changeset describes what changed and how it should affect the version number (patch, minor, or major).

## Creating a changeset

When you make changes to the codebase, run:

```bash
pnpm changeset
```

This will prompt you to:

1. Select the type of change (patch/minor/major)
2. Write a description of the change

The CLI will create a new file in `.changeset/` with your changes.

## The release workflow

1. **You add changesets** for your PRs
2. **CI creates a "Version Packages" PR** automatically when changesets are detected
3. **You merge the "Version Packages" PR** when ready to release
4. **CI automatically**:
   - Publishes to npm using Bun
   - Creates a git tag (e.g., `v1.15.0`)
   - Creates a GitHub release with notes

## Configuration

See `.changeset/config.json` for the Changesets configuration. Key settings:

- **changelog**: Uses GitHub changelog format with PR/commit links
- **access**: Public (package is published publicly)
- **baseBranch**: `main`

## Learn more

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Adding a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md)
