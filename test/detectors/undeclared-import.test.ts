import { describe, expect, test } from "bun:test";
import { parse, Lang, registerDynamicLanguage } from "@ast-grep/napi";
import { createRequire } from "node:module";
import { undeclaredImport } from "../../src/detectors/undeclared-import.js";
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

const PROJECT_WITH_DEPS: ProjectInfo = {
  dependencies: new Set(["express", "lodash", "@scope/pkg"]),
  devDependencies: new Set(["jest", "typescript"]),
  manifests: ["package.json"],
};

const EMPTY_PROJECT_WITH_MANIFEST: ProjectInfo = {
  dependencies: new Set(),
  devDependencies: new Set(),
  manifests: ["package.json"],
};

const NO_MANIFEST_PROJECT: ProjectInfo = {
  dependencies: new Set(),
  devDependencies: new Set(),
  manifests: [],
};

const PYTHON_PROJECT: ProjectInfo = {
  dependencies: new Set(["flask", "requests"]),
  devDependencies: new Set(),
  manifests: ["requirements.txt"],
};

function makeCtx(
  source: string,
  project: ProjectInfo,
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
    path: `src/app.${extMap[language].slice(1)}`,
    absolutePath: `/src/app.${extMap[language].slice(1)}`,
    language,
    extension: extMap[language],
  };
  return { file, root, source, project, config: {} };
}

describe("undeclared-import", () => {
  test("detector has correct metadata", () => {
    expect(undeclaredImport.id).toBe("undeclared-import");
    expect(undeclaredImport.meta.severity).toBe("error");
    expect(undeclaredImport.meta.category).toBe("correctness");
    expect(undeclaredImport.meta.languages).toContain("typescript");
    expect(undeclaredImport.meta.languages).toContain("python");
  });

  describe("JavaScript/TypeScript", () => {
    test("detects import of package not in dependencies", () => {
      const ctx = makeCtx(
        `import axios from 'axios';`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("axios");
      expect(findings[0].message).toContain("not declared");
    });

    test("does NOT flag packages that ARE in dependencies", () => {
      const ctx = makeCtx(
        `import express from 'express';`,
        PROJECT_WITH_DEPS,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag packages in devDependencies", () => {
      const ctx = makeCtx(
        `import jest from 'jest';`,
        PROJECT_WITH_DEPS,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag relative imports", () => {
      const ctx = makeCtx(
        `import { foo } from './foo';\nimport { bar } from '../bar';`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag Node builtins (fs, path, etc.)", () => {
      const ctx = makeCtx(
        `import fs from 'fs';\nimport path from 'path';\nimport crypto from 'crypto';`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag node: protocol imports", () => {
      const ctx = makeCtx(
        `import fs from 'node:fs';\nimport path from 'node:path';`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("handles scoped packages (@scope/pkg)", () => {
      const ctx = makeCtx(
        `import pkg from '@scope/pkg';`,
        PROJECT_WITH_DEPS,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("detects undeclared scoped packages", () => {
      const ctx = makeCtx(
        `import pkg from '@other/lib';`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("@other/lib");
    });

    test("handles subpath imports (lodash/merge -> lodash)", () => {
      const ctx = makeCtx(
        `import merge from 'lodash/merge';`,
        PROJECT_WITH_DEPS,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("handles scoped subpath imports (@scope/pkg/sub -> @scope/pkg)", () => {
      const ctx = makeCtx(
        `import sub from '@scope/pkg/sub/path';`,
        PROJECT_WITH_DEPS,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("does NOT flag path aliases (@/ and ~/)", () => {
      const ctx = makeCtx(
        `import { utils } from '@/utils';\nimport { config } from '~/config';`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("detects require() calls with undeclared packages", () => {
      const ctx = makeCtx(
        `const axios = require('axios');`,
        EMPTY_PROJECT_WITH_MANIFEST,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("axios");
    });

    test("does NOT flag require() with declared packages", () => {
      const ctx = makeCtx(
        `const express = require('express');`,
        PROJECT_WITH_DEPS,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("skips when no manifests found", () => {
      const ctx = makeCtx(
        `import axios from 'axios';`,
        NO_MANIFEST_PROJECT,
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });
  });

  describe("Python", () => {
    test("detects undeclared import", () => {
      const ctx = makeCtx(
        `import numpy\n`,
        PYTHON_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("numpy");
    });

    test("does NOT flag declared packages", () => {
      const ctx = makeCtx(
        `import flask\n`,
        PYTHON_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("skips Python builtins", () => {
      const ctx = makeCtx(
        `import os\nimport sys\nimport json\n`,
        PYTHON_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("handles from X.Y import Z (extracts top-level)", () => {
      const ctx = makeCtx(
        `from flask.views import View\n`,
        PYTHON_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("detects undeclared from-import", () => {
      const ctx = makeCtx(
        `from pandas import DataFrame\n`,
        PYTHON_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toContain("pandas");
    });

    test("skips relative imports", () => {
      const ctx = makeCtx(
        `from . import utils\nfrom ..module import helper\n`,
        PYTHON_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });

    test("skips when no manifests found", () => {
      const ctx = makeCtx(
        `import numpy\n`,
        NO_MANIFEST_PROJECT,
        "python",
      );
      const findings = undeclaredImport.detect(ctx);
      expect(findings.length).toBe(0);
    });
  });
});
