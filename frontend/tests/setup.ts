import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-unmounts when vitest globals are enabled, so do
// it explicitly; otherwise each test sees the previous tests' pages too.
afterEach(() => cleanup());
