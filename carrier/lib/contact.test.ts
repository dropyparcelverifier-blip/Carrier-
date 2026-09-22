import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COMPANY } from "@/lib/company";
import EmailText from "@/components/EmailText";

/**
 * The site shows ONE contact: contact-us@dotconnectslogistics.com.
 *
 * It used to show a phone line (+91 22 4000 1188) on every page, a "Call
 * us" button, a phone number in the Google structured data, and copy that
 * sent people to "the phone number on this page". Nobody is staffed to
 * answer a phone, so all of it went.
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|mjs|css|json)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

/** Retired contacts and the copy that pointed at them. */
const RETIRED = [
  "9867996311", "98679 96311", "wa.me/",   // Dropy's WhatsApp line
  "2240001188", "22 4000 1188", "tel:",    // the office phone
  "COMPANY.phone", "telephone",            // its uses, incl. JSON-LD
  "queries@", "support@",                  // addresses before contact-us@
  "Call us", "Can I call", "phone number on this page",
  "email or phone", "email or call", "urgent, the phone",
  "our Vashi bonded facility",             // no suburb in the copy
];

describe("support contact", () => {
  it("is contact-us@dotconnectslogistics.com", () => {
    expect(COMPANY.email).toBe("contact-us@dotconnectslogistics.com");
  });

  it("carries no phone and no second address", () => {
    for (const key of ["phone", "phoneHref", "supportEmail"]) {
      expect(COMPANY, key).not.toHaveProperty(key);
    }
  });

  it("no page, component or lib file still holds a retired contact", () => {
    const hits: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        const text = readFileSync(file, "utf8");
        for (const needle of RETIRED) if (text.includes(needle)) hits.push(`${path.relative(ROOT, file)}: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("EmailText", () => {
  // "contact-us@" has a hyphen, and a hyphen is a line-break point: the
  // desktop footer showed "contact-" / "us@dotconnects…" at 1280px and up.
  const html = renderToStaticMarkup(createElement(EmailText));

  it("holds everything up to the @ together and breaks only after it", () => {
    expect(html).toMatch(/<span class="whitespace-nowrap">contact-us@<\/span><wbr\/?>dotconnectslogistics\.com/);
  });

  it("is one element, so a flex parent's gap can't open inside it", () => {
    expect(html.startsWith("<span>") && html.endsWith("</span>")).toBe(true);
  });

  it("adds no characters, so a copied address is exact", () => {
    expect(html.replace(/<[^>]*>/g, "")).toBe(COMPANY.email);
  });
});
