import { describe, expect, it } from "vitest";
import { readTheme } from "@/components/ThemeControl";

describe("Theme preferences", () => {
  it("accepts each appearance and defaults invalid storage safely", () => {
    expect(readTheme("light")).toBe("light");
    expect(readTheme("dark")).toBe("dark");
    expect(readTheme("system")).toBe("system");
    expect(readTheme(null)).toBe("dark");
    expect(readTheme("invalid")).toBe("dark");
  });
});