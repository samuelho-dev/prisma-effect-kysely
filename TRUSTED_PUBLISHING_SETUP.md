# npm Trusted Publishing Setup

## Current Workflow Configuration
- **Workflow File**: `.github/workflows/release.yml`
- **Repository**: `samuelho-dev/prisma-effect-kysely`
- **Branch**: `main`

## npm Trusted Publisher Configuration Required

Go to: https://www.npmjs.com/package/prisma-effect-kysely/access

Under "Trusted Publishers", add/verify:

1. **Provider**: GitHub Actions
2. **Organization/User**: `samuelho-dev`
3. **Repository**: `prisma-effect-kysely`
4. **Workflow filename**: `release.yml` (exact match, case-sensitive)
5. **Environment** (optional): leave blank

## Common Issues

### 404 Error with "Access token expired or revoked"
This means the trusted publishing configuration doesn't match. Check:

- [ ] Workflow filename is **exactly** `release.yml` (not `.github/workflows/release.yml`)
- [ ] Repository owner is `samuelho-dev` (not `samuelho`)
- [ ] Repository name is `prisma-effect-kysely`
- [ ] No typos or extra spaces

### Alternative: Use NPM_TOKEN temporarily

If trusted publishing setup is complex, you can temporarily use an npm token:

1. Generate an Automation token at: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add it as a GitHub secret: `NPM_TOKEN`
3. Update workflow to use it:

```yaml
- name: Create Release PR or Publish
  uses: changesets/action@v1
  with:
    version: pnpm run changeset:version
    publish: pnpm run changeset:publish
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}  # Add this line
    NPM_CONFIG_PROVENANCE: true
```

## Verification Steps

1. Check npm package settings match workflow exactly
2. Ensure workflow has `id-token: write` permission ✅
3. Ensure `setup-node` has `registry-url` set ✅
4. Ensure `NPM_CONFIG_PROVENANCE: true` is set ✅

## Current Status

✅ Fixed: Using `npm publish` directly instead of through `changeset publish`
- Issue was: `changesets/action` creates its own `.npmrc` that overrides trusted publishing auth
- Solution: Run `npm publish --provenance` directly in the publish step
- This ensures `setup-node`'s OIDC authentication is used properly

## What was fixed:
1. Changed publish command from `pnpm run changeset:publish` to `pnpm run prepublishOnly && npm publish --provenance --access public`
2. Removed `.npmrc` file that was interfering with `setup-node` authentication
3. Removed `NPM_CONFIG_PROVENANCE` env var (using `--provenance` flag instead)

