import { describe, it, expect } from "vitest";
import { render } from "svelte/server";
import SiteFooter from "$lib/components/SiteFooter.svelte";
import { SITE_URL } from "$lib/company";

/**
 * The footer carries DOT's own content in the marketing site's layout:
 * contact block on the left, a headed link column, and the rounded bar
 * with © and the legal links. Only the layout changed; the content is
 * pinned here so a restyle can't quietly drop or add something.
 */
const html = render(SiteFooter).body.replace(/<!--.*?-->/g, "");
const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("SiteFooter", () => {
  it("keeps the contact block: heading and the one address", () => {
    expect(text).toContain("Questions about a consignment?");
    expect(html).toContain('href="mailto:contact-us@dotconnectslogistics.com"');
  });

  it("keeps the four links under the Explore heading, in order", () => {
    expect(html).toMatch(/class="colh[^"]*">Explore</);
    const links = [...html.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2].trim()]);
    expect(links).toEqual(expect.arrayContaining([
      [`${SITE_URL}/#services`, "Services"],
      [`${SITE_URL}/quote`, "Get a quote"],
      [`${SITE_URL}/about`, "About"],
      [`${SITE_URL}/#faq`, "FAQ"],
      [`${SITE_URL}/privacy`, "Privacy"],
      [`${SITE_URL}/terms`, "Terms"],
      [`${SITE_URL}/cargo-claims`, "Cargo claims"],
    ]));
    expect(links).toHaveLength(7);
  });

  it("puts © and the legal links in the rounded bar", () => {
    expect(html).toMatch(/class="bar[^"]*"[^>]*>[\s\S]*© \d{4} DotConnects Logistics[\s\S]*Cargo claims/);
  });

  it("shows no phone, WhatsApp or office line", () => {
    for (const gone of ["tel:", "wa.me", "Newark", "Vashi", "+91"]) expect(html).not.toContain(gone);
  });
});
