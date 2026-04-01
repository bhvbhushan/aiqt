import { describe, expect, test } from "bun:test";
import { formatJson } from "../../src/formatters/json.js";
import type { Finding, ScanResult } from "../../src/types.js";

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

describe("formatJson", () => {
  test("outputs valid JSON", () => {
    const result = makeResult({
      findings: [
        makeFinding({ severity: "error" }),
        makeFinding({ severity: "warning" }),
        makeFinding({ severity: "info" }),
      ],
      filesScanned: 15,
    });

    const output = formatJson(result);
    const parsed = JSON.parse(output);

    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe("object");
  });

  test("includes summary counts", () => {
    const result = makeResult({
      findings: [
        makeFinding({ severity: "error" }),
        makeFinding({ severity: "error" }),
        makeFinding({ severity: "warning" }),
        makeFinding({ severity: "info" }),
      ],
      filesScanned: 10,
    });

    const output = formatJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.summary.total).toBe(4);
    expect(parsed.summary.errors).toBe(2);
    expect(parsed.summary.warnings).toBe(1);
    expect(parsed.summary.info).toBe(1);
    expect(parsed.filesScanned).toBe(10);
  });

  test("includes findings array", () => {
    const finding = makeFinding({
      file: "src/test.ts",
      line: 10,
      column: 3,
      severity: "error",
      message: "Something bad",
      detectorId: "bad-detector",
    });
    const result = makeResult({ findings: [finding] });

    const output = formatJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].file).toBe("src/test.ts");
    expect(parsed.findings[0].line).toBe(10);
    expect(parsed.findings[0].column).toBe(3);
    expect(parsed.findings[0].severity).toBe("error");
    expect(parsed.findings[0].message).toBe("Something bad");
    expect(parsed.findings[0].detectorId).toBe("bad-detector");
  });

  test("includes errors array", () => {
    const result = makeResult({
      errors: [
        { file: "src/broken.ts", message: "Parse error" },
        {
          file: "src/other.ts",
          detectorId: "some-det",
          message: "Detector failed",
        },
      ],
    });

    const output = formatJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0].file).toBe("src/broken.ts");
    expect(parsed.errors[1].detectorId).toBe("some-det");
  });

  test("handles empty results", () => {
    const result = makeResult({
      findings: [],
      errors: [],
      filesScanned: 0,
    });

    const output = formatJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.findings).toHaveLength(0);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.summary.total).toBe(0);
    expect(parsed.summary.errors).toBe(0);
    expect(parsed.summary.warnings).toBe(0);
    expect(parsed.summary.info).toBe(0);
    expect(parsed.filesScanned).toBe(0);
  });
});
