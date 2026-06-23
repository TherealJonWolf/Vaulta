import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ApiReference from "@/pages/ApiReference";

// jsdom lacks IntersectionObserver; framer-motion's viewport feature needs it.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}
(globalThis as any).IntersectionObserver = (globalThis as any).IntersectionObserver ?? IO;

// Mock auth-related hooks used inside Navbar to keep test isolated
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => ({ isAdmin: false, loading: false }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ subscribed: false, subscription_tier: null, loading: false, refresh: vi.fn() }),
}));

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 800 });
  window.dispatchEvent(new Event("resize"));
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/api-reference"]}>
      <ApiReference />
    </MemoryRouter>,
  );
}

function enableDarkMode() {
  document.documentElement.classList.add("dark");
}

function disableDarkMode() {
  document.documentElement.classList.remove("dark");
}

describe("ApiReference mobile UI regression", () => {
  beforeEach(() => {
    setViewport(375); // iPhone SE / smallest supported phone width
  });

  it("renders every documented endpoint", () => {
    renderPage();
    const paths = [
      "/api/documents/upload",
      "/api/documents/{id}",
      "/api/audit/logs",
      "/api/auth/mfa/enroll",
      "/api/auth/mfa/verify",
    ];
    for (const p of paths) {
      expect(screen.getAllByText(p).length).toBeGreaterThan(0);
    }
  });

  it("applies wrap-friendly classes to endpoint path cells so long paths cannot clip", () => {
    renderPage();
    const path = screen.getByText("/api/auth/mfa/enroll");
    // Must allow wrapping/breaking and not be forced onto one line.
    expect(path.className).toMatch(/break-all/);
    expect(path.className).toMatch(/min-w-0/);
    expect(path.className).not.toMatch(/\bwhitespace-nowrap\b/);
    expect(path.className).not.toMatch(/\btruncate\b/);
  });

  it("wraps the endpoint row container with overflow-safe + flex-wrap utilities", () => {
    renderPage();
    const path = screen.getByText("/api/documents/upload");
    const row = path.closest("div")!; // method/path row
    expect(row.className).toMatch(/flex-wrap/);
    expect(row.className).toMatch(/min-w-0/);

    const card = path.closest("div.bg-card\\/50, div[class*='bg-card/50']") as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card!.className).toMatch(/overflow-hidden/);
    expect(card!.className).toMatch(/min-w-0/);
  });

  it("keeps descriptions breakable (no forced single-line, no truncation)", () => {
    renderPage();
    const desc = screen.getByText("Retrieve and decrypt a document");
    expect(desc.className).toMatch(/break-words/);
    expect(desc.className).not.toMatch(/truncate/);
    expect(desc.className).not.toMatch(/whitespace-nowrap/);
  });

  it("does not horizontally overflow the viewport on a 375px mobile screen", () => {
    setViewport(375);
    const { container } = renderPage();
    // jsdom does not lay out, but we assert that no descendant declares a fixed
    // width or min-width greater than the mobile viewport that would force
    // horizontal scrolling on the documented endpoint cards.
    const offenders = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const cls = el.className?.toString?.() ?? "";
      // catch tailwind arbitrary widths like w-[600px] or min-w-[500px]
      return /\b(min-)?w-\[(\d{3,})px\]/.test(cls) && Number(RegExp.$2) > 360;
    });
    expect(offenders).toEqual([]);
  });
});

describe("ApiReference tablet UI regression (mobile -> 768px)", () => {
  // Cover the breakpoints between the smallest phone and the md: breakpoint
  // to ensure clipping/squashing doesn't reappear as the viewport grows.
  const widths = [414, 600, 768];

  for (const width of widths) {
    describe(`at ${width}px viewport`, () => {
      beforeEach(() => setViewport(width));

      it("renders every documented endpoint without dropping rows", () => {
        renderPage();
        const paths = [
          "/api/documents/upload",
          "/api/documents/{id}",
          "/api/audit/logs",
          "/api/auth/mfa/enroll",
          "/api/auth/mfa/verify",
        ];
        for (const p of paths) {
          expect(screen.getAllByText(p).length).toBeGreaterThan(0);
        }
      });

      it("keeps endpoint paths wrap-friendly (no nowrap / truncate)", () => {
        renderPage();
        const path = screen.getByText("/api/auth/mfa/verify");
        expect(path.className).toMatch(/break-all/);
        expect(path.className).toMatch(/min-w-0/);
        expect(path.className).not.toMatch(/\bwhitespace-nowrap\b/);
        expect(path.className).not.toMatch(/\btruncate\b/);
      });

      it("keeps the endpoint row container overflow-safe", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const row = path.closest("div")!;
        expect(row.className).toMatch(/flex-wrap/);
        expect(row.className).toMatch(/min-w-0/);

        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card!.className).toMatch(/overflow-hidden/);
        expect(card!.className).toMatch(/min-w-0/);
      });

      it("keeps descriptions breakable and untruncated", () => {
        renderPage();
        const desc = screen.getByText("Retrieve security audit logs");
        expect(desc.className).toMatch(/break-words/);
        expect(desc.className).not.toMatch(/truncate/);
        expect(desc.className).not.toMatch(/whitespace-nowrap/);
      });

      it("contains no fixed widths that would exceed the viewport", () => {
        const { container } = renderPage();
        const offenders = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const cls = el.className?.toString?.() ?? "";
          return /\b(min-)?w-\[(\d{3,})px\]/.test(cls) && Number(RegExp.$2) > width;
        });
        expect(offenders).toEqual([]);
      });
    });
  }
});

describe("ApiReference dark mode UI regression (>=1024px)", () => {
  const widths = [1024, 1280, 1440];

  for (const width of widths) {
    describe(`at ${width}px viewport (dark)`, () => {
      beforeEach(() => {
        setViewport(width);
        enableDarkMode();
      });
      afterEach(() => disableDarkMode());

      it("activates the dark class on <html>", () => {
        renderPage();
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });

      it("uses semantic, theme-aware color tokens (no hardcoded light text)", () => {
        renderPage();
        const path = screen.getByText("/api/auth/mfa/verify");
        // Must use semantic foreground tokens, never hardcoded white/black or arbitrary hex.
        expect(path.className).toMatch(/text-foreground/);
        expect(path.className).not.toMatch(/\btext-white\b/);
        expect(path.className).not.toMatch(/\btext-black\b/);
        expect(path.className).not.toMatch(/text-\[#/);

        const desc = screen.getByText("Verify MFA token");
        expect(desc.className).toMatch(/text-muted-foreground/);
        expect(desc.className).not.toMatch(/\btext-white\b/);
        expect(desc.className).not.toMatch(/\btext-black\b/);
      });

      it("uses semantic background tokens on endpoint cards (theme-aware)", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card).not.toBeNull();
        // No hardcoded bg-white/bg-black; must rely on bg-card token.
        expect(card!.className).not.toMatch(/\bbg-white\b/);
        expect(card!.className).not.toMatch(/\bbg-black\b/);
        expect(card!.className).not.toMatch(/bg-\[#/);
        expect(card!.className).toMatch(/border-border/);
      });

      it("preserves overflow-safe layout in dark mode at desktop widths", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const row = path.closest("div")!;
        expect(row.className).toMatch(/flex-wrap/);
        expect(row.className).toMatch(/min-w-0/);

        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card!.className).toMatch(/overflow-hidden/);
        expect(card!.className).toMatch(/min-w-0/);
      });

      it("renders the HTTP method badge with a semantic, non-hardcoded color", () => {
        renderPage();
        // GET badge for /api/documents/{id}
        const badges = screen.getAllByText("GET");
        expect(badges.length).toBeGreaterThan(0);
        for (const b of badges) {
          expect(b.className).not.toMatch(/\btext-white\b/);
          expect(b.className).not.toMatch(/\bbg-white\b/);
          expect(b.className).not.toMatch(/bg-\[#/);
        }
      });

      it("contains no fixed widths that would exceed the desktop viewport", () => {
        const { container } = renderPage();
        const offenders = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const cls = el.className?.toString?.() ?? "";
          return /\b(min-)?w-\[(\d{3,})px\]/.test(cls) && Number(RegExp.$2) > width;
        });
        expect(offenders).toEqual([]);
      });
    });
  }
});

describe("ApiReference desktop UI regression (mobile -> 1024px)", () => {
  // Cover the lg: breakpoint range to ensure clipping/squashing doesn't
  // reappear as the viewport grows from tablet into desktop.
  const widths = [820, 1024];

  for (const width of widths) {
    describe(`at ${width}px viewport`, () => {
      beforeEach(() => setViewport(width));

      it("renders every documented endpoint without dropping rows", () => {
        renderPage();
        const paths = [
          "/api/documents/upload",
          "/api/documents/{id}",
          "/api/audit/logs",
          "/api/auth/mfa/enroll",
          "/api/auth/mfa/verify",
        ];
        for (const p of paths) {
          expect(screen.getAllByText(p).length).toBeGreaterThan(0);
        }
      });

      it("keeps endpoint paths wrap-friendly (no nowrap / truncate)", () => {
        renderPage();
        const path = screen.getByText("/api/auth/mfa/verify");
        expect(path.className).toMatch(/break-all/);
        expect(path.className).toMatch(/min-w-0/);
        expect(path.className).not.toMatch(/\bwhitespace-nowrap\b/);
        expect(path.className).not.toMatch(/\btruncate\b/);
      });

      it("keeps the endpoint row container overflow-safe", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const row = path.closest("div")!;
        expect(row.className).toMatch(/flex-wrap/);
        expect(row.className).toMatch(/min-w-0/);

        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card!.className).toMatch(/overflow-hidden/);
        expect(card!.className).toMatch(/min-w-0/);
      });

      it("keeps descriptions breakable and untruncated", () => {
        renderPage();
        const desc = screen.getByText("Retrieve security audit logs");
        expect(desc.className).toMatch(/break-words/);
        expect(desc.className).not.toMatch(/truncate/);
        expect(desc.className).not.toMatch(/whitespace-nowrap/);
      });

      it("contains no fixed widths that would exceed the viewport", () => {
        const { container } = renderPage();
        const offenders = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const cls = el.className?.toString?.() ?? "";
          return /\b(min-)?w-\[(\d{3,})px\]/.test(cls) && Number(RegExp.$2) > width;
        });
        expect(offenders).toEqual([]);
      });
    });
  }
});

describe("ApiReference light mode UI regression (>=1024px)", () => {
  const widths = [1024, 1280, 1440, 1920];

  for (const width of widths) {
    describe(`at ${width}px viewport (light)`, () => {
      beforeEach(() => {
        setViewport(width);
        // Explicitly ensure light mode (no `dark` class on <html>).
        disableDarkMode();
      });
      afterEach(() => disableDarkMode());

      it("does not activate the dark class on <html>", () => {
        renderPage();
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });

      it("uses semantic, theme-aware text tokens (no hardcoded light-mode colors)", () => {
        renderPage();
        const path = screen.getByText("/api/auth/mfa/verify");
        // Typography must rely on semantic tokens so it adapts between themes.
        expect(path.className).toMatch(/text-foreground/);
        expect(path.className).not.toMatch(/\btext-white\b/);
        expect(path.className).not.toMatch(/\btext-black\b/);
        expect(path.className).not.toMatch(/text-\[#/);
        // Must not hardcode a slate/gray/zinc shade that would fail in light mode.
        expect(path.className).not.toMatch(/\btext-(slate|gray|zinc|neutral|stone)-\d{3}\b/);

        const desc = screen.getByText("Verify MFA token");
        expect(desc.className).toMatch(/text-muted-foreground/);
        expect(desc.className).not.toMatch(/\btext-white\b/);
        expect(desc.className).not.toMatch(/\btext-black\b/);
        expect(desc.className).not.toMatch(/text-\[#/);
      });

      it("uses semantic background + border tokens on endpoint cards", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card).not.toBeNull();
        expect(card!.className).not.toMatch(/\bbg-white\b/);
        expect(card!.className).not.toMatch(/\bbg-black\b/);
        expect(card!.className).not.toMatch(/bg-\[#/);
        expect(card!.className).toMatch(/border-border/);
      });

      it("preserves overflow-safe layout at desktop widths in light mode", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const row = path.closest("div")!;
        expect(row.className).toMatch(/flex-wrap/);
        expect(row.className).toMatch(/min-w-0/);

        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card!.className).toMatch(/overflow-hidden/);
        expect(card!.className).toMatch(/min-w-0/);
      });

      it("preserves consistent spacing utilities on endpoint cards", () => {
        renderPage();
        const path = screen.getByText("/api/documents/upload");
        const card = path.closest("div[class*='bg-card/50']") as HTMLElement | null;
        expect(card).not.toBeNull();
        // Padding + gap utilities must remain so rows don't visually collapse.
        expect(card!.className).toMatch(/\bp-\d/);
        const row = path.closest("div")!;
        expect(row.className).toMatch(/\bgap-\d/);
      });

      it("keeps descriptions breakable and untruncated in light mode", () => {
        renderPage();
        const desc = screen.getByText("Verify MFA token");
        expect(desc.className).toMatch(/break-words/);
        expect(desc.className).not.toMatch(/truncate/);
        expect(desc.className).not.toMatch(/whitespace-nowrap/);
      });

      it("renders HTTP method badges with semantic, theme-aware colors", () => {
        renderPage();
        const badges = screen.getAllByText("GET");
        expect(badges.length).toBeGreaterThan(0);
        for (const b of badges) {
          expect(b.className).not.toMatch(/\btext-black\b/);
          expect(b.className).not.toMatch(/\bbg-black\b/);
          expect(b.className).not.toMatch(/bg-\[#/);
        }
      });

      it("contains no fixed widths that would exceed the desktop viewport", () => {
        const { container } = renderPage();
        const offenders = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const cls = el.className?.toString?.() ?? "";
          return /\b(min-)?w-\[(\d{3,})px\]/.test(cls) && Number(RegExp.$2) > width;
        });
        expect(offenders).toEqual([]);
      });
    });
  }
});
