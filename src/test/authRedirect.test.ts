import { describe, expect, it, beforeEach, vi } from "vitest";
import { navigateOnceForAuthTransition, resetAuthRedirectLocksForTests, shouldNavigateTo } from "@/lib/authRedirect";

describe("auth redirect lifecycle guard", () => {
  beforeEach(() => resetAuthRedirectLocksForTests());

  it("does not navigate to the current route", () => {
    expect(shouldNavigateTo("/institutional/dashboard", "/institutional/dashboard")).toBe(false);
  });

  it("allows only one identical redirect during a session transition", () => {
    const navigate = vi.fn();
    const location = { pathname: "/vault" } as any;

    const first = navigateOnceForAuthTransition({
      navigate,
      location,
      targetPath: "/institutional/dashboard",
      sessionKey: "user:token",
    });
    const second = navigateOnceForAuthTransition({
      navigate,
      location,
      targetPath: "/institutional/dashboard",
      sessionKey: "user:token",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
