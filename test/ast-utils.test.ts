import { describe, expect, test } from "bun:test";
import { parse, Lang, registerDynamicLanguage } from "@ast-grep/napi";
import { createRequire } from "node:module";
import {
  extractJsPackageName,
  findImports,
  findFunctions,
  findClasses,
  findExports,
} from "../src/ast-utils.js";

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
  // Python support may not be available
}

function parseJs(source: string) {
  return parse(Lang.JavaScript, source).root();
}

function parseTs(source: string) {
  return parse(Lang.TypeScript, source).root();
}

function parseTsx(source: string) {
  return parse(Lang.Tsx, source).root();
}

function parsePy(source: string) {
  return parse("python" as Lang, source).root();
}

// ── extractJsPackageName ────────────────────────────────────────────────────

describe("extractJsPackageName", () => {
  test("unscoped package", () => {
    expect(extractJsPackageName("lodash")).toBe("lodash");
  });

  test("unscoped package with subpath", () => {
    expect(extractJsPackageName("lodash/merge")).toBe("lodash");
  });

  test("scoped package", () => {
    expect(extractJsPackageName("@scope/pkg")).toBe("@scope/pkg");
  });

  test("scoped package with subpath", () => {
    expect(extractJsPackageName("@scope/pkg/sub")).toBe("@scope/pkg");
  });

  test("empty string returns null", () => {
    expect(extractJsPackageName("")).toBeNull();
  });

  test("bare scope returns null", () => {
    expect(extractJsPackageName("@scope")).toBeNull();
  });
});

// ── findImports ─────────────────────────────────────────────────────────────

describe("findImports", () => {
  describe("JavaScript/TypeScript", () => {
    test("finds ES module imports", () => {
      const root = parseTs(`
        import React from "react";
        import { useState } from "react";
        import * as path from "node:path";
      `);
      const imports = findImports(root, "typescript");
      expect(imports).toHaveLength(3);
      expect(imports[0].source).toBe("react");
      expect(imports[1].source).toBe("react");
      expect(imports[2].source).toBe("node:path");
    });

    test("returns full import text", () => {
      const root = parseTs(`import { foo } from "bar";`);
      const imports = findImports(root, "typescript");
      expect(imports[0].text).toContain("bar");
    });

    test("returns empty array for no imports", () => {
      const root = parseTs("const x = 1;");
      expect(findImports(root, "typescript")).toHaveLength(0);
    });
  });

  describe("Python", () => {
    test("finds import statements", () => {
      const root = parsePy("import os\nimport sys");
      const imports = findImports(root, "python");
      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe("os");
      expect(imports[1].source).toBe("sys");
    });

    test("finds from-import statements", () => {
      const root = parsePy("from os.path import join\nfrom collections import defaultdict");
      const imports = findImports(root, "python");
      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe("os.path");
      expect(imports[1].source).toBe("collections");
    });

    test("handles aliased imports", () => {
      const root = parsePy("import numpy as np");
      const imports = findImports(root, "python");
      expect(imports).toHaveLength(1);
      // Source should be the original module name
      expect(imports[0].source).toBe("numpy");
    });
  });
});

// ── findFunctions ───────────────────────────────────────────────────────────

describe("findFunctions", () => {
  describe("JavaScript/TypeScript", () => {
    test("finds function declarations", () => {
      const root = parseTs("function foo(a: string, b: number) { return a; }");
      const fns = findFunctions(root, "typescript");
      expect(fns).toHaveLength(1);
      expect(fns[0].name).toBe("foo");
      expect(fns[0].params).toBe(2);
      expect(fns[0].kind).toBe("function_declaration");
      expect(fns[0].body).not.toBeNull();
    });

    test("finds arrow functions assigned to variables", () => {
      const root = parseTs("const add = (a: number, b: number) => { return a + b; };");
      const fns = findFunctions(root, "typescript");
      const arrow = fns.find((f) => f.kind === "arrow_function");
      expect(arrow).toBeDefined();
      expect(arrow!.name).toBe("add");
      expect(arrow!.params).toBe(2);
    });

    test("finds method definitions", () => {
      const root = parseTs(`
        class Foo {
          bar(x: number) { return x; }
          static baz() {}
        }
      `);
      const fns = findFunctions(root, "typescript");
      const methods = fns.filter((f) => f.kind === "method_definition");
      expect(methods.length).toBeGreaterThanOrEqual(2);
      const names = methods.map((m) => m.name);
      expect(names).toContain("bar");
      expect(names).toContain("baz");
    });

    test("unnamed arrow function gets <anonymous>", () => {
      const root = parseJs("[1, 2].map((x) => { return x * 2; });");
      const fns = findFunctions(root, "javascript");
      const arrow = fns.find((f) => f.kind === "arrow_function");
      expect(arrow?.name).toBe("<anonymous>");
    });
  });

  describe("Python", () => {
    test("finds function definitions", () => {
      const root = parsePy("def greet(name, greeting='hello'):\n    return f'{greeting} {name}'");
      const fns = findFunctions(root, "python");
      expect(fns).toHaveLength(1);
      expect(fns[0].name).toBe("greet");
      expect(fns[0].params).toBe(2);
      expect(fns[0].kind).toBe("function_definition");
    });

    test("excludes self/cls from param count", () => {
      const root = parsePy("class Foo:\n    def bar(self, x):\n        pass");
      const fns = findFunctions(root, "python");
      const bar = fns.find((f) => f.name === "bar");
      expect(bar).toBeDefined();
      expect(bar!.params).toBe(1); // self excluded
    });

    test("finds nested functions", () => {
      const root = parsePy("def outer():\n    def inner():\n        pass\n    inner()");
      const fns = findFunctions(root, "python");
      expect(fns.length).toBeGreaterThanOrEqual(2);
      const names = fns.map((f) => f.name);
      expect(names).toContain("outer");
      expect(names).toContain("inner");
    });
  });
});

// ── findClasses ─────────────────────────────────────────────────────────────

describe("findClasses", () => {
  describe("JavaScript/TypeScript", () => {
    test("finds class with methods", () => {
      const root = parseTs(`
        class UserService {
          constructor() {}
          getUser(id: string) { return id; }
          deleteUser(id: string) {}
        }
      `);
      const classes = findClasses(root, "typescript");
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe("UserService");
      expect(classes[0].methods).toContain("constructor");
      expect(classes[0].methods).toContain("getUser");
      expect(classes[0].methods).toContain("deleteUser");
    });

    test("returns empty array for no classes", () => {
      const root = parseTs("const x = 1;");
      expect(findClasses(root, "typescript")).toHaveLength(0);
    });
  });

  describe("Python", () => {
    test("finds class with methods", () => {
      const root = parsePy(`class Dog:
    def __init__(self, name):
        self.name = name
    def bark(self):
        print("woof")`);
      const classes = findClasses(root, "python");
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe("Dog");
      expect(classes[0].methods).toContain("__init__");
      expect(classes[0].methods).toContain("bark");
    });
  });
});

// ── findExports ─────────────────────────────────────────────────────────────

describe("findExports", () => {
  test("finds exported function", () => {
    const root = parseTs("export function hello() {}");
    const exports = findExports(root, "typescript");
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe("hello");
    expect(exports[0].kind).toBe("function");
  });

  test("finds exported class", () => {
    const root = parseTs("export class Foo {}");
    const exports = findExports(root, "typescript");
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe("Foo");
    expect(exports[0].kind).toBe("class");
  });

  test("finds exported const", () => {
    const root = parseTs("export const bar = 42;");
    const exports = findExports(root, "typescript");
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe("bar");
    expect(exports[0].kind).toBe("variable");
  });

  test("finds default export", () => {
    const root = parseTs("export default function() {}");
    const exports = findExports(root, "typescript");
    expect(exports.some((e) => e.kind === "default")).toBe(true);
  });

  test("finds exported type", () => {
    const root = parseTs("export type Foo = string;");
    const exports = findExports(root, "typescript");
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe("Foo");
    expect(exports[0].kind).toBe("type");
  });

  test("returns empty for Python", () => {
    expect(findExports(parsePy("x = 1"), "python")).toHaveLength(0);
  });
});
