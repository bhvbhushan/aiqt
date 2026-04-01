import type { ScanResult } from "../types.js";
import { formatJson } from "./json.js";
import { formatText } from "./text.js";

export { formatJson } from "./json.js";
export { formatText } from "./text.js";

/** Supported format names */
export type FormatName = "text" | "json" | "github" | "sarif" | "html";

/**
 * Get a formatter function by name.
 * Throws for unrecognized or not-yet-implemented formats.
 */
export function getFormatter(
  format: string,
): (result: ScanResult) => string {
  switch (format) {
    case "text":
      return formatText;
    case "json":
      return formatJson;
    case "github":
    case "sarif":
    case "html":
      throw new Error(
        `Format '${format}' is not yet implemented. Available formats: text, json`,
      );
    default:
      throw new Error(
        `Unknown format '${format}'. Available formats: text, json, github, sarif, html`,
      );
  }
}
