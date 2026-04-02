# Security Policy

## Reporting a Vulnerability

**DO NOT open public issues for security vulnerabilities.**

Report vulnerabilities through one of these channels:

- **GitHub Private Vulnerability Reporting:** [Submit advisory](https://github.com/bhvbhushan/aiqt/security/advisories/new)
- **Email:** bhvbhushan@gmail.com

## Response SLAs

| Stage | Timeline |
|-------|----------|
| Acknowledgment | 48 hours |
| Assessment | 7 days |
| Fix for critical issues | 14 days |

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest 0.x | Yes |

## Scope

The following are in scope for security reports:

- `aiqt` npm package
- GitHub Action (`action.yml`)
- GitHub repository (CI/CD, workflows)
- AST analysis engine
- Detector pattern matching

## Out of Scope

- Bugs found in projects scanned by aiqt
- Upstream bugs in ast-grep or tree-sitter
- Feature requests

## Security Model

aiqt is a **local static analysis tool**. By design it:

- Makes no network calls
- Stores no data beyond the scan output
- Requires no credentials or authentication
- Runs entirely in your local environment or CI runner
