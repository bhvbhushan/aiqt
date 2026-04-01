import { describe, expect, test } from "bun:test";
import { parse, Lang, registerDynamicLanguage } from "@ast-grep/napi";
import { createRequire } from "node:module";
import { excessiveCommentRatio } from "../../src/detectors/excessive-comment-ratio.js";
import type { DetectionContext, FileInfo, ProjectInfo } from "../../src/types.js";

// Register Python for tests
try {
  const req = createRequire(import.meta.url);
  const pythonLang = req("@ast-grep/lang-python") as {
    libraryPath: string;
    extensions: string[];
    languageSymbol?: string;
    expandoChar?: string;
  };
  registerDynamicLanguage({ python: pythonLang });
} catch {
  // Python support may not be available in test env
}

const EMPTY_PROJECT: ProjectInfo = {
  dependencies: new Set(),
  devDependencies: new Set(),
  manifests: [],
};

function makeCtx(
  source: string,
  language: "typescript" | "python" = "typescript",
  config: Record<string, unknown> = {},
): DetectionContext {
  const langMap: Record<string, Lang | string> = {
    typescript: Lang.TypeScript,
    python: "python",
  };
  const extMap: Record<string, string> = {
    typescript: ".ts",
    python: ".py",
  };
  const root = parse(langMap[language] as Lang, source);
  const file: FileInfo = {
    path: `src/app.${extMap[language].slice(1)}`,
    absolutePath: `/src/app.${extMap[language].slice(1)}`,
    language,
    extension: extMap[language],
  };
  return { file, root, source, project: EMPTY_PROJECT, config };
}

describe("excessive-comment-ratio", () => {
  test("detector has correct metadata", () => {
    expect(excessiveCommentRatio.id).toBe("excessive-comment-ratio");
    expect(excessiveCommentRatio.meta.severity).toBe("info");
    expect(excessiveCommentRatio.meta.category).toBe("quality");
    expect(excessiveCommentRatio.meta.languages).toContain("typescript");
    expect(excessiveCommentRatio.meta.languages).toContain("python");
  });

  test("detects file with >50% comments", () => {
    // 8 comment lines, 4 code lines = 67% comments
    const source = `
// comment 1
// comment 2
// comment 3
// comment 4
// comment 5
// comment 6
// comment 7
// comment 8
const a = 1;
const b = 2;
const c = 3;
const d = 4;
`;
    const ctx = makeCtx(source);
    const findings = excessiveCommentRatio.detect(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain("67%");
    expect(findings[0].line).toBe(1);
  });

  test("does NOT flag file with normal comment ratio", () => {
    // 2 comment lines, 10 code lines = 17% comments
    const source = `
// A useful comment
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
// Another comment
const f = 6;
const g = 7;
const h = 8;
const i = 9;
const j = 10;
`;
    const ctx = makeCtx(source);
    const findings = excessiveCommentRatio.detect(ctx);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag files under 10 non-blank lines", () => {
    // 5 comment lines, 3 code lines = 62% but only 8 non-blank lines
    const source = `
// comment 1
// comment 2
// comment 3
// comment 4
// comment 5
const a = 1;
const b = 2;
const c = 3;
`;
    const ctx = makeCtx(source);
    const findings = excessiveCommentRatio.detect(ctx);
    expect(findings.length).toBe(0);
  });

  test("respects config threshold", () => {
    // 4 comment lines, 8 code lines = 33% comments
    // With threshold 0.3, should flag. With default 0.5, should not.
    const source = `
// comment 1
// comment 2
// comment 3
// comment 4
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
const f = 6;
const g = 7;
const h = 8;
`;
    const ctxDefault = makeCtx(source);
    expect(excessiveCommentRatio.detect(ctxDefault).length).toBe(0);

    const ctxLow = makeCtx(source, "typescript", { threshold: 0.3 });
    expect(excessiveCommentRatio.detect(ctxLow).length).toBe(1);
  });

  test("handles block comments in JS/TS", () => {
    // 4 block comment lines, 6 code lines = 40% — below threshold
    // Change to make it >50%
    const source = `
/*
 * Block comment line 1
 * Block comment line 2
 * Block comment line 3
 * Block comment line 4
 * Block comment line 5
 * Block comment line 6
 */
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
`;
    const ctx = makeCtx(source);
    const findings = excessiveCommentRatio.detect(ctx);
    // 8 comment lines (/* through */), 5 code lines = 62%
    expect(findings.length).toBe(1);
  });

  test("handles Python hash comments", () => {
    // 7 comment lines, 4 code lines = 64% comments
    const source = `# comment 1
# comment 2
# comment 3
# comment 4
# comment 5
# comment 6
# comment 7
a = 1
b = 2
c = 3
d = 4
`;
    const ctx = makeCtx(source, "python");
    const findings = excessiveCommentRatio.detect(ctx);
    expect(findings.length).toBe(1);
  });
});
