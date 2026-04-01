import { describe, expect, test } from "bun:test";
import { parse, Lang, registerDynamicLanguage } from "@ast-grep/napi";
import { createRequire } from "node:module";
import { overMocking } from "../../src/detectors/over-mocking.js";
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
  filePath: string,
  language: "typescript" | "javascript" | "python" = "typescript",
): DetectionContext {
  const langMap: Record<string, Lang | string> = {
    typescript: Lang.TypeScript,
    javascript: Lang.JavaScript,
    python: "python",
  };
  const extMap: Record<string, string> = {
    typescript: ".ts",
    javascript: ".js",
    python: ".py",
  };
  const root = parse(langMap[language] as Lang, source);
  const file: FileInfo = {
    path: filePath,
    absolutePath: `/${filePath}`,
    language,
    extension: extMap[language],
  };
  return { file, root, source, project: EMPTY_PROJECT, config: {} };
}

describe("over-mocking", () => {
  test("detector has correct metadata", () => {
    expect(overMocking.id).toBe("over-mocking");
    expect(overMocking.meta.severity).toBe("warning");
    expect(overMocking.meta.category).toBe("testing");
    expect(overMocking.meta.languages).toContain("typescript");
    expect(overMocking.meta.languages).toContain("python");
  });

  describe("JavaScript/TypeScript", () => {
    test("detects test file with more mocks than assertions", () => {
      const source = `
jest.mock('./db');
jest.mock('./api');
jest.mock('./auth');
jest.spyOn(console, 'log');

test('my test', () => {
  expect(result).toBe(true);
});
`;
      const ctx = makeCtx(source, "src/__test__/app.test.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("more mocks (4)");
      expect(findings[0].message).toContain("assertions (1)");
    });

    test("does NOT flag test file with more assertions than mocks", () => {
      const source = `
jest.mock('./db');

test('my test', () => {
  expect(result).toBe(true);
  expect(result).toEqual({ a: 1 });
  expect(result).not.toBeNull();
});
`;
      const ctx = makeCtx(source, "src/app.test.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("only runs on test files", () => {
      const source = `
jest.mock('./db');
jest.mock('./api');
jest.mock('./auth');
`;
      const ctx = makeCtx(source, "src/app.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("handles vi.mock and vi.spyOn patterns", () => {
      const source = `
vi.mock('./db');
vi.mock('./api');
vi.spyOn(console, 'log');

test('my test', () => {
  expect(result).toBe(true);
});
`;
      const ctx = makeCtx(source, "src/app.spec.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("more mocks (3)");
      expect(findings[0].message).toContain("assertions (1)");
    });

    test("handles sinon patterns", () => {
      const source = `
sinon.stub(db, 'query');
sinon.spy(api, 'fetch');
sinon.mock(auth);

test('my test', () => {
  expect(result).toBe(true);
});
`;
      const ctx = makeCtx(source, "src/app.test.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("more mocks (3)");
    });

    test("handles assert.X() pattern", () => {
      const source = `
jest.mock('./db');

test('my test', () => {
  assert.ok(result);
  assert.equal(a, b);
});
`;
      const ctx = makeCtx(source, "src/app.test.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("reports counts in message", () => {
      const source = `
jest.mock('./a');
jest.mock('./b');

test('my test', () => {
  expect(x).toBe(1);
});
`;
      const ctx = makeCtx(source, "src/app.test.ts");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toMatch(/mocks \(2\)/);
      expect(findings[0].message).toMatch(/assertions \(1\)/);
    });
  });

  describe("Python", () => {
    test("detects test file with more mocks than assertions", () => {
      const source = `from unittest.mock import patch, MagicMock

@patch('module.ClassA')
@patch('module.ClassB')
@patch('module.ClassC')
def test_something():
    assert result == True
`;
      const ctx = makeCtx(source, "test_app.py", "python");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("more mocks");
    });

    test("does NOT flag test file with more assertions than mocks", () => {
      const source = `from unittest.mock import patch

@patch('module.ClassA')
def test_something():
    assert result == True
    assert other == False
    assert count > 0
`;
      const ctx = makeCtx(source, "test_app.py", "python");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("only runs on test files", () => {
      const source = `from unittest.mock import patch

@patch('module.ClassA')
@patch('module.ClassB')
@patch('module.ClassC')
`;
      const ctx = makeCtx(source, "src/app.py", "python");
      const findings = overMocking.detect(ctx);
      expect(findings.length).toBe(0);
    });
  });
});
