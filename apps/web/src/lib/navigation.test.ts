import { describe, expect, it } from "vitest";

import { navigationItems } from "./navigation";

describe("navigationItems", () => {
  it("exposes the shell home and health destinations", () => {
    expect(navigationItems).toEqual([
      { href: "/", label: "Home" },
      { href: "/health", label: "Health" },
    ]);
  });
});
