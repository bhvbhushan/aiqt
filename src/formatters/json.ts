import type { ScanResult } from "../types.js";

/**
 * Format scan results as structured JSON.
 *
 * Output shape:
 * {
 *   "findings": [...],
 *   "summary": { "total": N, "errors": N, "warnings": N, "info": N },
 *   "filesScanned": N,
 *   "errors": [...]
 * }
 */
export function formatJson(result: ScanResult): string {
  const errors = result.findings.filter((f) => f.severity === "error").length;
  const warnings = result.findings.filter(
    (f) => f.severity === "warning",
  ).length;
  const info = result.findings.filter((f) => f.severity === "info").length;

  const output = {
    findings: result.findings,
    summary: {
      total: result.findings.length,
      errors,
      warnings,
      info,
    },
    filesScanned: result.filesScanned,
    errors: result.errors,
  };

  return JSON.stringify(output, null, 2);
}
