import { describe, expect, it } from "vitest";
import { router } from "../routes/index.js";

describe("router", () => {
  it("registers the /health route", () => {
    const healthLayer = router.stack.find(
      (layer) => layer.route?.path === "/health",
    );
    expect(healthLayer).toBeDefined();
  });
});
