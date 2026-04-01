import { describe, expect, test } from "bun:test";
import { formatText } from "../../src/formatters/text.js";
import type { Finding, ScanError, ScanResult } from "../../src/types.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    detectorId: "test-detector",
    message: "Test issue found",
    severity: "warning",
    file: "src/utils.ts",
    line: 3,
    column: 5,
    ...overrides,
  };
}

function makeResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    findings: [],
    filesScanned: 1,
    errors: [],
    ...overrides,
  };
}

describe("formatText", () => {
  test("formats findings grouped by file", () => {
    const result = makeResult({
      findings: [
        makeFinding({
          file: "src/utils.ts",
          line: 3,
          column: 5,
          severity: "warning",
          message: "Empty catch block with only console.log",
          detectorId: "empty-error-handler",
        }),
        makeFinding({
          file: "src/utils.ts",
          line: 15,
          column: 1,
          severity: "error",
          message: "Undeclared import",
          detectorId: "undeclared-import",
        }),
        makeFinding({
          file: "src/auth.ts",
          line: 7,
          column: 10,
          severity: "error",
          message: "Hardcoded password string",
          detectorId: "insecure-defaults",
        }),
      ],
      filesScanned: 2,
    });

    // Force NO_COLOR so output is plain text for testing
    const origNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      const output = formatText(result);

      // Both files should appear as group headers
      expect(output).toContain("src/utils.ts");
      expect(output).toContain("src/auth.ts");

      // Findings should include line:column, severity, message, detector ID
      expect(output).toContain("3:5");
      expect(output).toContain("warning");
      expect(output).toContain("Empty catch block with only console.log");
      expect(output).toContain("empty-error-handler");

      expect(output).toContain("15:1");
      expect(output).toContain("error");
      expect(output).toContain("Undeclared import");
      expect(output).toContain("undeclared-import");

      expect(output).toContain("7:10");
      expect(output).toContain("Hardcoded password string");
      expect(output).toContain("insecure-defaults");

      // Summary
      expect(output).toContain("3 problems");
      expect(output).toContain("2 errors");
      expect(output).toContain("1 warning");
    } finally {
      if (origNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = origNoColor;
      }
    }
  });

  test("shows summary line with counts", () => {
    const result = makeResult({
      findings: [
        makeFinding({ severity: "error" }),
        makeFinding({ severity: "warning" }),
        makeFinding({ severity: "info" }),
      ],
    });

    const origNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      const output = formatText(result);
      expect(output).toContain("3 problems");
      expect(output).toContain("1 error");
      expect(output).toContain("1 warning");
      expect(output).toContain("1 info");
    } finally {
      if (origNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = origNoColor;
      }
    }
  });

  test("handles empty results (no findings)", () => {
    const result = makeResult({ findings: [], errors: [] });

    const origNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      const output = formatText(result);
      expect(output).toContain("No problems found");
      expect(output).not.toContain("problems (");
    } finally {
      if (origNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = origNoColor;
      }
    }
  });

  test("handles scan errors", () => {
    const scanError: ScanError = {
      file: "src/broken.ts",
      detectorId: "some-detector",
      message: "Failed to parse file",
    };
    const result = makeResult({
      findings: [],
      errors: [scanError],
    });

    const origNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      const output = formatText(result);
      expect(output).toContain("Error:");
      expect(output).toContain("src/broken.ts");
      expect(output).toContain("some-detector");
      expect(output).toContain("Failed to parse file");
    } finally {
      if (origNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = origNoColor;
      }
    }
  });

  test("shows timing info when present", () => {
    const result = makeResult({
      findings: [],
      errors: [],
      timing: {
        totalMs: 123.456,
        perDetector: {
          "detector-a": 50.1,
          "detector-b": 73.3,
        },
      },
    });

    const origNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      const output = formatText(result);
      expect(output).toContain("123ms");
      expect(output).toContain("detector-a");
      expect(output).toContain("detector-b");
    } finally {
      if (origNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = origNoColor;
      }
    }
  });
});
