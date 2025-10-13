# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.7.x   | :white_check_mark: |
| 1.6.x   | :white_check_mark: |
| < 1.6   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in prisma-effect-kysely, please report it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by:

1. **Email**: Send details to the maintainer at the email listed in package.json
2. **GitHub Security Advisories**: Use the [Security Advisories](https://github.com/samuelho-dev/prisma-effect-kysely/security/advisories/new) feature

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., code injection, XSS, etc.)
- Full paths of affected source file(s)
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Confirmation**: Within 7 days (whether we can reproduce the issue)
- **Fix Timeline**: Depends on severity
  - **Critical**: Within 7 days
  - **High**: Within 14 days
  - **Medium**: Within 30 days
  - **Low**: Next planned release

### Disclosure Policy

- We will work with you to understand and resolve the issue
- We ask that you do not disclose the vulnerability publicly until we've had a chance to address it
- Once fixed, we will credit you in the release notes (unless you prefer to remain anonymous)
- We will publish a security advisory on GitHub

## Security Best Practices for Users

When using prisma-effect-kysely:

1. **Keep Updated**: Always use the latest version to get security patches
2. **Review Generated Code**: Inspect generated schemas for your use case
3. **Validate Inputs**: Use Effect Schema's validation features on user inputs
4. **Dependencies**: Keep Prisma, Effect, and other dependencies up to date
5. **Custom Types**: Be cautious when using `@customType` annotations with untrusted input patterns

## Security Features

- **Type Safety**: Zero type coercion prevents type confusion vulnerabilities
- **Input Validation**: Generated Effect Schemas provide runtime validation
- **No Code Execution**: Generator only produces type definitions, no executable code
- **Dependency Security**: Minimal dependency tree (4 production dependencies)
- **NPM Provenance**: All releases include provenance for supply chain security

## Automated Security

- **Renovate**: Automated dependency updates configured
- **CI Security Checks**: `pnpm audit` runs on every commit
- **GitHub Security**: Dependabot alerts enabled

## Contact

For security-related questions that are not vulnerabilities, please open a regular GitHub issue or discussion.
