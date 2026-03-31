# AIQT Market Research — AI Code Quality Gap Analysis

**Date:** 2026-03-31
**Source:** Deep research across 4 parallel agents + 15+ web searches

---

## The Problem (Quantified)

| Metric | Value | Source |
|--------|-------|--------|
| AI code issues per PR vs human | 1.7x more (10.83 vs 6.45) | CodeRabbit, 470 PRs |
| AI PR acceptance rate vs human | 32.7% vs 84.4% | LinearB, 8.1M PRs |
| XSS vulnerabilities in AI code | 2.74x more likely | CodeRabbit |
| Insecure object references | 1.91x more likely | CodeRabbit |
| Excessive I/O operations | ~8x more common | CodeRabbit |
| Maintenance costs by year 2 | 4x traditional levels | BuildMVPFast |
| First-year cost overhead | 12% higher (9% review + 1.7x testing + 2x churn) | Industry analysis |
| Code smells in AI code | 90%+ of issues | Multiple studies |
| Hallucinated packages | 19.7% of AI suggestions | USENIX Security 2025 |
| Developers trusting AI output | Only 29% (down from 40%) | Stack Overflow 2025 |
| PR review time increase with AI | +91% | LinearB benchmarks |
| AI making experienced devs slower | 19% slower (METR study) | Peer-reviewed, 246 tasks |
| Projected AI tech debt | $1.5 trillion by 2027 | Industry forecast |

## The Maintainer Crisis

- **Curl** killed its bug bounty program (Jan 2026) — only 5% of submissions genuine
- **Jazzband** shut down entirely — "flood of AI-generated spam PRs"
- **Godot** calls it "draining and demoralizing"
- **tldraw** auto-closes ALL external PRs
- **GitHub** building a PR kill switch for AI slop
- A reviewer spends **12x longer** reviewing an AI PR than it took to generate
- **60%** of OSS maintainers are unpaid volunteers

Sources:
- [96% rely on OSS, AI slop puts them at risk](https://thenewstack.io/ai-slop-open-source/)
- [GitHub kill switch](https://www.theregister.com/2026/02/03/github_kill_switch_pull_requests_ai/)
- [Curl ends bug bounty](https://www.bleepingcomputer.com/news/security/curl-ending-bug-bounty-program-after-flood-of-ai-slop-reports/)
- [Godot maintainer burnout](https://www.devclass.com/ai-ml/2026/02/19/github-itself-to-blame-for-ai-slop-prs-say-devs/4091420)

## The Vibe Coding Debt Crisis

- Code churn: 5.5% → 7.9% (2020-2024, GitClear)
- Code cloning: 8.3% → 12.3%
- Refactoring: 25% → under 10%
- 72% of orgs report production incidents from AI code (Harness)
- 67% spend MORE time debugging AI code than before
- "Rescue engineering" predicted as hottest discipline in 2026

Sources:
- [Salesforce Ben: 2026 year of tech debt](https://www.salesforceben.com/2026-predictions-its-the-year-of-technical-debt-thanks-to-vibe-coding/)
- [arxiv: Vibe Coding in Practice](https://arxiv.org/abs/2512.11922)
- [IBM: Reducing technical debt 2026](https://www.ibm.com/think/insights/reduce-technical-debt)
- [AI debt crisis 2026-2027](https://www.pixelmojo.io/blogs/vibe-coding-technical-debt-crisis-2026-2027)
- [GitClear research](https://www.gitclear.com/ai_assistant_code_quality_2025_research)

## Competitive Landscape (Detailed)

### Anti-Slop (peakoss/anti-slop)
- GitHub Action, <15 seconds execution
- 31 checks across 8 categories: ALL metadata-level
- PR Branch (4), PR Quality (2), PR Title (1), PR Description (6), PR Template (3), Commit Messages (4), File Checks (3), User Signals (8)
- 54 configuration options
- Claims 98% slop PR detection in early testing
- From Coolify maintainers (50K+ stars, 120+ slop PRs/month)
- **Gap:** ZERO code content analysis

### AI-SLOP-Detector (flamehaven01)
- Python CLI, pip-installable
- Logic Density Ratio, Buzzword Inflation, Unused Dependencies metrics
- Combined Deficit Score (0-100)
- Optional JS/TS tree-sitter analysis
- Self-calibrating weights
- **Gap:** Python-primary, no PR gate, no hallucinated API detection

### SonarQube Community Edition
- 10,300+ stars, 21 languages
- AI Code Assurance in 2025.1/2026.1 — BUT paid only (Server/Cloud)
- Community Edition has ZERO AI-specific features
- Auto-detects Copilot code only (misses Claude, Cursor, etc.)
- **Gap:** No community AI features, no hallucination detection

### PR-Agent (Qodo)
- 10,500 stars, 1,300 forks
- LLM-powered multi-agent review system
- Highest F1 (60.1%) on code review benchmark
- VS Code 842K+ installs
- **Gap:** LLM-dependent (cost, latency, non-deterministic), generates noise

### Semgrep
- Rule-based static analysis, rules look like source code
- Multimodal (March 2026) = AI + rules, 8x more true positives
- **Gap:** No AI-specific rule catalog. Multimodal is commercial.

### CodeScene
- Commercial behavioral code analysis
- CodeHealth metric (1-10 scale, 25+ factors)
- Claims 6x more accurate than SonarQube
- **Gap:** Proprietary, expensive, not AI-pattern-specific

## Academic Foundation

1. **SpecDetect4AI** (arxiv 2509.20491, Sep 2025)
   - 22 AI-specific code smells defined
   - 826 systems analyzed (20M LOC)
   - 88.66% precision, 88.89% recall
   - Declarative DSL (EBNF grammar + first-order AST predicates)
   - **Key reference for rule architecture**

2. **SpecDetect4LLM** (arxiv 2512.18020, Dec 2025)
   - 5 LLM-specific code smells (tied to LLM inference)
   - 60.50% of analyzed systems affected
   - 86.06% detection precision

3. **Slopsquatting** (USENIX Security 2025, Spracklen et al.)
   - 576,000 code samples, 16 LLMs
   - 19.7% of suggested packages were hallucinations (205,474 unique fake names)
   - 43% of hallucinated packages appeared consistently across prompts
   - "huggingface-cli" hallucinated package got 30,000+ real downloads on PyPI

4. **AI Detection Unreliable** (arxiv 2411.04299, Nov 2024)
   - All existing AI detection tools perform poorly
   - Lack generalizability across models
   - **Conclusion:** Focus on quality patterns, NOT authorship detection

## Funding Landscape

| Category | Funding | Notes |
|----------|---------|-------|
| Code Generation/IDEs | $10B+ | Cursor $3.4B, Replit $650M, Cognition $900M |
| Code Review | $208M | CodeRabbit $88M, Qodo $120M |
| AI Testing (pure-play) | ~$5M | Nearly nothing |
| AI Code Quality (OSS) | ~$0 | Wide open |

**The imbalance:** $10B+ in code generation vs $208M in code review vs ~$0 in AI-specific code quality tools. The gap is enormous.
