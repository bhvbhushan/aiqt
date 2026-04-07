# Contributing to vibecop

Thanks for your interest in contributing. This guide covers everything you need to get started.

## Development Setup

```bash
git clone https://github.com/bhvbhushan/vibecop.git
cd vibecop
bun install
bun run build
bun test
bun run lint
```

**Requirements:** Bun >= 1.0, Node >= 20

## Project Structure

```
src/
  cli.ts              # CLI entry point (commander)
  config.ts           # Config loading + Zod validation
  engine.ts           # File discovery, AST parsing, detector orchestration
  ast-utils.ts        # Shared AST traversal (findImports, findFunctions, findClasses, findExports)
  context.ts          # Context optimization entry point (hook handlers, requires bun)
  context/
    benchmark.ts       # Benchmark command (pure ast-grep, no bun:sqlite — runs under node)
    cache.ts           # SQLite persistence (bun:sqlite, WAL mode)
    session.ts         # File hashing, token estimation, extension checks
    skeleton.ts        # AST skeleton extraction from source code
    stats.ts           # Token savings reporting
  project.ts          # Package manifest parsing (dependencies, devDependencies)
  types.ts            # All shared types (Detector, Finding, DetectionContext, etc.)
  init.ts             # Agent tool detection + config generation (vibecop init)
  detectors/
    index.ts           # builtinDetectors array — register new detectors here
    utils.ts           # Detector-specific helpers (makeFinding, test function detection)
    ...                # 35 detectors across quality, security, correctness, testing
  formatters/
    index.ts           # Formatter registry (text, json, html, sarif, github, agent, gcc)
  mcp/
    index.ts           # MCP server setup + tool registration
    server.ts          # Tool handlers (scan, check, explain, context_benchmark)
  action/
    main.ts            # GitHub Action entry point
    diff.ts            # PR diff parsing
    filter.ts          # Finding filtering for changed lines
    review.ts          # PR review comment posting
    summary.ts         # PR summary generation
test/
  detectors/           # One test file per detector
  formatters/          # Formatter tests
  context/             # Context optimization tests (skeleton, cache, integration)
  mcp/                 # MCP server tests
  fixtures/            # Sample source files for testing
  ast-utils.test.ts    # Shared AST utility tests
```

## How to Contribute

1. **Check existing issues** before starting work.
2. **Open an issue first** for large changes or new features to discuss the approach.
3. **Fork the repo** and create a feature branch from `main`.
4. **Write tests** for any new functionality.
5. **Follow the code standards** described below.
6. **Submit a PR** against `main`.

## Code Standards

- **TypeScript strict mode**, ES modules (`"type": "module"`)
- **Small, focused functions** — under 50 lines each
- **Functional patterns** over classes
- **Zod** for all config/input validation
- **No `any`** — use `unknown` and narrow with type guards
- **Explicit over clever** — readability wins

## Adding a New Detector

### 1. Create the detector file

Create `src/detectors/{id}.ts` implementing the `Detector` interface:

```typescript
import type { Detector, DetectionContext, Finding } from "../types.js";

export const myDetector: Detector = {
  id: "my-detector",
  meta: {
    name: "My Detector",
    description: "Detects some specific code quality issue",
    severity: "warning",           // "error" | "warning" | "info"
    category: "quality",           // "quality" | "security" | "correctness" | "testing"
    languages: ["typescript", "javascript", "tsx"],
  },
  detect(ctx: DetectionContext): Finding[] {
    const findings: Finding[] = [];
    const root = ctx.root.root();

    // Use ast-grep to find patterns
    const nodes = root.findAll({ rule: { kind: "some_node_kind" } });

    for (const node of nodes) {
      const range = node.range();
      findings.push({
        detectorId: "my-detector",
        message: "Description of the issue found",
        severity: "warning",
        file: ctx.file.path,
        line: range.start.line + 1,
        column: range.start.column + 1,
        suggestion: "How to fix it",
      });
    }

    return findings;
  },
};
```

### 2. Add tests

Create `test/detectors/{id}.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
// Test your detector against fixture files or inline code snippets
```

### 3. Register the detector

In `src/detectors/index.ts`:

1. Add the import: `import { myDetector } from "./my-detector.js";`
2. Add the export: `export { myDetector } from "./my-detector.js";`
3. Add to the `builtinDetectors` array: `myDetector,`

### 4. Update documentation

Add the detector to the README detector table with its id, name, category, and severity.

## Before Submitting a PR

Run all checks locally:

```bash
bun run lint           # Biome linter — fix all errors
bun run typecheck      # TypeScript strict — no type errors
bun test               # All tests must pass
bun run build          # CLI build must succeed
bun run build:context  # Context optimization build must succeed
```

## Review Process

- **CI must pass** — lint, typecheck, test, build
- **One approval** required from a maintainer
- **Squash merge** into `main`

## Release Process

1. Bump version in `package.json` following [semver](https://semver.org/)
2. Update `CHANGELOG.md` with the new version and changes
3. Merge to `main`
4. CI auto-publishes to npm
