import { describe, expect, test } from "bun:test";
import { parse, Lang } from "@ast-grep/napi";
import { overDefensiveCoding } from "../../src/detectors/over-defensive-coding.js";
import type { DetectionContext, FileInfo, ProjectInfo } from "../../src/types.js";

const EMPTY_PROJECT: ProjectInfo = {
  dependencies: new Set(),
  devDependencies: new Set(),
  manifests: [],
};

function makeCtx(source: string): DetectionContext {
  const root = parse(Lang.TypeScript, source);
  const file: FileInfo = {
    path: "src/app.ts",
    absolutePath: "/src/app.ts",
    language: "typescript",
    extension: ".ts",
  };
  return { file, root, source, project: EMPTY_PROJECT, config: {} };
}

describe("over-defensive-coding", () => {
  test("detector has correct metadata", () => {
    expect(overDefensiveCoding.id).toBe("over-defensive-coding");
    expect(overDefensiveCoding.meta.severity).toBe("info");
    expect(overDefensiveCoding.meta.category).toBe("quality");
    expect(overDefensiveCoding.meta.languages).toContain("typescript");
  });

  describe("Pattern 1: Redundant null+undefined checks", () => {
    test("detects x !== null && x !== undefined", () => {
      const ctx = makeCtx(`
        function foo(x: any) {
          if (x !== null && x !== undefined) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("Redundant null+undefined check");
      expect(findings[0].message).toContain("x");
    });

    test("detects x !== undefined && x !== null", () => {
      const ctx = makeCtx(`
        function foo(x: any) {
          if (x !== undefined && x !== null) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("Redundant");
    });

    test("detects typeof x !== 'undefined' && x !== null", () => {
      const ctx = makeCtx(`
        function foo(x: any) {
          if (typeof x !== 'undefined' && x !== null) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("Redundant");
    });

    test("detects x != null && x != undefined (loose)", () => {
      const ctx = makeCtx(`
        function foo(x: any) {
          if (x != null && x != undefined) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("Redundant");
      expect(findings[0].message).toContain("already checks both");
    });

    test("does NOT flag single null check (if x !== null)", () => {
      const ctx = makeCtx(`
        function foo(x: any) {
          if (x !== null) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag single undefined check", () => {
      const ctx = makeCtx(`
        function foo(x: any) {
          if (x !== undefined) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag checks on different variables", () => {
      const ctx = makeCtx(`
        function foo(x: any, y: any) {
          if (x !== null && y !== undefined) { return x; }
        }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe("Pattern 2: try/catch around JSON.parse with literal", () => {
    test("detects try/catch around JSON.parse with string literal", () => {
      const ctx = makeCtx(`
        try { JSON.parse('{"key": "value"}'); } catch (e) { }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("JSON.parse");
      expect(findings[0].message).toContain("string literal");
    });

    test("does NOT flag JSON.parse with variable argument", () => {
      const ctx = makeCtx(`
        try { JSON.parse(userInput); } catch (e) { }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      // Should have 0 JSON.parse findings (may have null check findings)
      const jsonFindings = findings.filter((f) =>
        f.message.includes("JSON.parse"),
      );
      expect(jsonFindings.length).toBe(0);
    });

    test("does NOT flag JSON.parse with template literal argument", () => {
      const ctx = makeCtx(`
        try { JSON.parse(\`\${data}\`); } catch (e) { }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      const jsonFindings = findings.filter((f) =>
        f.message.includes("JSON.parse"),
      );
      expect(jsonFindings.length).toBe(0);
    });

    test("detects JSON.parse with double-quoted string literal", () => {
      const ctx = makeCtx(`
        try { JSON.parse("[]"); } catch (e) { }
      `);
      const findings = overDefensiveCoding.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("JSON.parse");
    });
  });
});
