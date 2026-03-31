# Project A: AI Code Quality Toolkit — Design & Implementation Plan

**Date:** 2026-03-31
**Status:** Research Complete / Ready for Implementation Planning

---

## Overview

The open-source linter purpose-built for the AI coding era. Detects AI-specific code antipatterns that traditional tools miss: hallucinated APIs, over-abstraction, buzzword-laden code, tests that test nothing. Runs in CI in under 60 seconds, requires no API keys, fully deterministic.

## Problem Statement

- AI-generated code has 1.7x more issues per PR than human code (CodeRabbit, 470 PRs)
- 4x maintenance costs by year 2 for unmanaged AI code
- 19.7% of AI-suggested packages are hallucinations (USENIX Security 2025)
- 90%+ of AI code issues are code smells
- OSS maintainers drowning in AI slop PRs (Curl, Jazzband, Godot, tldraw affected)

## Gaps Addressed

- **Gap 1 (AI Slop Defense):** PR quality gate for OSS maintainers
- **Gap 2 (AI Code Debt Scanner):** Codebase scanner for AI-generated tech debt
- **Gap 6 (AI Test Quality Evaluator):** Meaningful coverage scoring for AI-generated tests

---

## Competitive Analysis

| Tool | Code Analysis | AI-Specific | PR Gate | CLI Scan | Test Quality | OSS |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| anti-slop | No | Metadata only | Yes | No | No | Yes |
| AI-SLOP-Detector | Yes | Yes (Python) | No | Yes | No | Yes |
| SonarQube CE | Yes | No (paid only) | Partial | Yes | No | Yes |
| Qodo/PR-Agent | LLM-based | No | Yes | No | Partial | Yes |
| Semgrep | Yes | No catalog | No | Yes | No | Yes |
| **Our Tool** | **Yes** | **Yes (core)** | **Yes** | **Yes** | **Yes** | **Yes** |

### Key Competitor Details

**Anti-Slop (peakoss/anti-slop):** 31 checks across 8 categories — ALL metadata-level (PR title, description, account age, commit format). Zero code content analysis. Built by Coolify maintainers handling 120+ slop PRs/month.

**AI-SLOP-Detector (flamehaven01):** Python CLI using Logic Density Ratio, Buzzword Inflation, Unused Dependencies metrics. Self-calibrating weights. Python-primary only, no PR gate.

**SonarQube:** AI Code Assurance exists but is paid-only (Server/Cloud editions). Community Edition has zero AI-specific features.

**PR-Agent (Qodo):** LLM-powered = non-deterministic, costly, latency. Highest F1 (60.1%) on code review benchmark but generates noise.

---

## Academic Research Foundation

1. **SpecDetect4AI** (arxiv 2509.20491) — 22 AI-specific code smells, 88.66% precision. Declarative DSL with first-order AST predicates. **Architecture reference.**
2. **SpecDetect4LLM** (arxiv 2512.18020) — 5 LLM-specific code smells, 60.50% of systems affected, 86.06% precision.
3. **Slopsquatting** (USENIX Security 2025) — 576K code samples, 16 LLMs: 19.7% hallucinated packages. 43% consistently hallucinated across prompts.
4. **AI Detection Unreliable** (arxiv 2411.04299) — Stylometric authorship detection fails. Focus on quality patterns, not authorship.

---

## Architecture

```
                    +-------------------+
                    |   CLI Interface   |
                    |  (scan / check)   |
                    +--------+----------+
                             |
                    +--------v----------+
                    |   Core Engine     |
                    |  - File Discovery |
                    |  - Parser Manager |
                    |  - Rule Runner    |
                    |  - Report Builder |
                    +--------+----------+
                             |
              +--------------+---------------+
              |              |               |
     +--------v----+  +-----v------+  +-----v------+
     | tree-sitter  |  |   Rule     |  |  Package   |
     | Parser Pool  |  | Registry   |  | Validator  |
     | (per-lang)   |  | (plugins)  |  | (npm/pypi) |
     +--------------+  +-----+------+  +------------+
                             |
              +--------------+---------------+
              |              |               |
     +--------v----+  +-----v------+  +-----v------+
     | AI Pattern  |  |   Test     |  |  Security  |
     | Detectors   |  | Quality    |  | Detectors  |
     |             |  | Analyzers  |  |            |
     +-------------+  +------------+  +------------+
                             |
                    +--------v----------+
                    |  Output Adapters  |
                    | SARIF | JSON | CLI|
                    | PR Comment | XML |
                    +-------------------+
```

### Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 20+ | Best tree-sitter bindings, npm ecosystem |
| Language | TypeScript | Type safety for AST operations |
| Parser | tree-sitter | 40+ languages, 36x faster, used by GitHub/Neovim/Zed |
| Rule format | YAML (simple) + TS plugins (complex) | Similar to ast-grep |
| CLI | Commander.js | Standard |
| Output | SARIF (primary) | Native GitHub Security tab integration |
| Testing | Vitest | Fast, modern |
| Build | tsup (esbuild) | Fast builds |
| Distribution | npm (`npx aiqt scan`) | Largest reach |
| Monorepo | pnpm workspaces | `@aiqt/cli`, `@aiqt/core`, `@aiqt/rules-default`, `@aiqt/github-action` |

### Plugin/Rule System

```typescript
interface Detector {
  id: string;
  meta: DetectorMeta;
  detect(context: DetectionContext): Finding[];
}

interface DetectionContext {
  file: FileInfo;
  cst: Tree;              // tree-sitter CST
  query: QueryAPI;         // tree-sitter query helpers
  project: ProjectInfo;    // package.json, imports map
  config: RuleConfig;
}
```

### Dual Mode

- **PR Gate:** git diff input, <60s target, PR comment + check status, merge blocking
- **Codebase Scan:** entire directory, minutes acceptable, CLI report + SARIF, trend tracking

### Language Support

- **Tier 1 (Phase 1):** JavaScript, TypeScript, Python
- **Tier 2 (Phase 2-3):** Go, Java, Rust
- **Tier 3 (Community):** C#, Ruby, PHP, Swift, Kotlin via plugin API

---

## AI-Specific Antipattern Catalog

Based on CodeRabbit (470 PRs), Ox Security, and academic literature:

**Logic & Correctness:** Hallucinated API calls, hallucinated package imports, business logic errors, unsafe control flow

**Code Structure:** Over-abstraction, unnecessary defensive coding, code duplication (8x more in AI code per GitClear), logic sprawl, inconsistent error handling

**Security:** Hardcoded credentials, SQL injection, missing auth, disabled TLS, insecure defaults (2.74x more XSS per CodeRabbit)

**Performance:** Excessive I/O (8x more frequent), unnecessary network calls in loops, missing caching

**AI Telltales:** High comment-to-code ratio, buzzword comments, emoji-heavy docs, overly verbose variable names

**Test-Specific:** Tautological tests, trivial assertions, over-mocking, missing edge cases, redundant test cases

---

## Implementation Plan

### Phase 1: Core Scanner CLI (Weeks 1-4)

**P0 Detectors (Weeks 1-2):**
1. `hallucinated-import` — Cross-reference imports against npm/PyPI registry
2. `empty-error-handler` — catch blocks with only console.log/pass
3. `trivial-assertion` — expect(true).toBe(true), assert True
4. `excessive-comment-ratio` — comment LOC / code LOC > threshold
5. `over-defensive-coding` — redundant null checks, unnecessary try/catch

**P1 Detectors (Weeks 2-3):**
6. `hallucinated-api-call` — method calls against known API surfaces
7. `copy-paste-duplication` — AST subtree fingerprinting + similarity
8. `over-abstraction` — patterns with single implementation
9. `buzzword-comments` — "robust", "scalable", "elegant" keyword matching
10. `insecure-defaults` — hardcoded credentials, disabled TLS

**P2 Detectors (Weeks 3-4):**
11. `tautological-test` — assertions mirroring implementation
12. `over-mocking` — mock count > assertion count
13. `logic-sprawl` — cyclomatic complexity + length + params
14. `inconsistent-error-handling` — mixed patterns per module
15. `unnecessary-abstraction-layer` — wrappers that just delegate

**CLI Interface:**
```
aiqt scan [path]          # Full codebase scan
aiqt check <file>         # Single file
aiqt init                 # Generate .aiqt.yml
aiqt rules                # List available rules
aiqt explain <rule-id>    # Explain a rule with examples
```

**Configuration:** `.aiqt.yml` with rule overrides, severity thresholds, file patterns, scoring weights.

### Phase 2: PR Gate GitHub Action (Weeks 5-7)

- Wraps core scanner + anti-slop metadata checks
- Diff-only analysis for speed
- Inline PR comments + summary comment
- Actions on failure: comment-only (default), request-changes, label, auto-close (opt-in)
- Configuration extends `.aiqt.yml` with `pr-gate` section

### Phase 3: Test Quality Evaluator (Weeks 8-10)

**8 test-specific detectors:** trivial-assertion, tautological-test, over-mocking, missing-error-path-test, redundant-test, no-boundary-test, snapshot-only-test, implementation-coupled-test

**Mutation testing integration:** Optional StrykerJS/Cosmic Ray wrapper

**Meaningful Coverage Score (0-100):**
```
Score = weighted_average(
  assertion_quality   * 0.30,
  mutation_score      * 0.25,
  error_path_coverage * 0.20,
  boundary_coverage   * 0.15,
  independence_score  * 0.10,
)

80-100: "Strong"    60-79: "Moderate"    40-59: "Weak"    0-39: "Cosmetic"
```

---

## Positioning

> **aiqt** — the open-source linter for the AI coding era. Deterministic, free, offline. Not an AI detector. Not an LLM-based reviewer. The quality tool SonarQube and ESLint weren't designed to be.

## What This Is NOT

- Not an AI authorship detector
- Not an LLM-based reviewer (deterministic, reproducible, free)
- Not a replacement for SonarQube/ESLint (complements them)
- Not a code generation tool

---

## Open Questions

1. Naming: `aiqt`, `sloplint`, `ai-lint`, `codewatch`? Check npm availability.
2. ast-grep as dependency vs custom engine?
3. Hallucinated API depth: package-level vs method-level validation?
4. Optional LLM mode for deeper detection alongside deterministic rules?
5. Scoring calibration against real codebases needed.

---

## Sources

- [Anti-Slop GitHub](https://github.com/peakoss/anti-slop)
- [AI-SLOP-Detector GitHub](https://github.com/flamehaven01/AI-SLOP-Detector)
- [SpecDetect4AI (arxiv 2509.20491)](https://arxiv.org/abs/2509.20491)
- [Slopsquatting (USENIX Security 2025)](https://www.aikido.dev/blog/slopsquatting-ai-package-hallucination-attacks)
- [CodeRabbit AI vs Human Code](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)
- [tree-sitter](https://github.com/tree-sitter/tree-sitter)
- [ast-grep](https://ast-grep.github.io/)
- [GitHub SARIF Integration](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)
- [StrykerJS](https://stryker-mutator.io/)
- [SonarQube AI Code Detection](https://docs.sonarsource.com/sonarqube-server/2025.2/ai-capabilities/autodetect-ai-code)
- [Qodo 2.0](https://www.qodo.ai/blog/introducing-qodo-2-0-agentic-code-review/)
- [Semgrep Multimodal](https://www.helpnetsecurity.com/2026/03/20/semgrep-multimodal-code-security/)
