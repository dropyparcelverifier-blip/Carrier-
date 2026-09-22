import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * DOT has no footer. The marketing site (carrier) carries the company
 * footer; the tracking page is header + the tracking card, nothing under it.
 * Contact stays where a customer needs it: the "Need help?" card on a
 * result and the delayed-parcel message, both via COMPANY.email.
 */
describe("no footer on DOT", () => {
  const layout = readFileSync(resolve("src/routes/+layout.svelte"), "utf8");

  it("the layout renders no footer", () => {
    expect(layout).not.toContain("SiteFooter");
    expect(layout).not.toMatch(/<footer\b/);
  });

  it("the footer component is gone", () => {
    expect(existsSync(resolve("src/lib/components/SiteFooter.svelte"))).toBe(false);
  });

  it("the result page still offers the contact address", () => {
    const page = readFileSync(resolve("src/routes/+page.svelte"), "utf8");
    expect(page).toContain('href="mailto:{COMPANY.email}');
  });
});
