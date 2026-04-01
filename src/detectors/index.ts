export { emptyErrorHandler } from "./empty-error-handler.js";
export { trivialAssertion } from "./trivial-assertion.js";
export { insecureDefaults } from "./insecure-defaults.js";
export { undeclaredImport } from "./undeclared-import.js";
export { overDefensiveCoding } from "./over-defensive-coding.js";
export { excessiveCommentRatio } from "./excessive-comment-ratio.js";
export { overMocking } from "./over-mocking.js";

import type { Detector } from "../types.js";
import { emptyErrorHandler } from "./empty-error-handler.js";
import { trivialAssertion } from "./trivial-assertion.js";
import { insecureDefaults } from "./insecure-defaults.js";
import { undeclaredImport } from "./undeclared-import.js";
import { overDefensiveCoding } from "./over-defensive-coding.js";
import { excessiveCommentRatio } from "./excessive-comment-ratio.js";
import { overMocking } from "./over-mocking.js";

/** All built-in detectors */
export const builtinDetectors: Detector[] = [
  emptyErrorHandler,
  trivialAssertion,
  insecureDefaults,
  undeclaredImport,
  overDefensiveCoding,
  excessiveCommentRatio,
  overMocking,
];
