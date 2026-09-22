import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { render } from "svelte/server";
import { COMPANY } from "$lib/company";
import EmailText from "$lib/components/EmailText.svelte";

/**
 * DotConnects shows ONE contact: contact-us@dotconnectslogistics.com.
 *
 * Dropy's support number (98679 96311) sat in company.ts as a WhatsApp
 * link. This app is DotConnects-branded, so a Dropy line on it tells a
 * customer the two are one company. No phone line of any kind either:
 * nobody is staffed to answer one within the four hours the page promises.
 */

const SRC = resolve("src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|js|svelte|html|css|json)$/.test(name) ? [path] : [];
  });
}

/** Retired contacts. Each must stay gone from every file the app ships. */
const RETIRED = [
  "9867996311", "98679 96311",          // Dropy's support line
  "2240001188", "22 4000 1188",         // placeholder landline
  "support@dotconnectslogistics.com",   // addresses before contact-us@
  "queries@dotconnectslogistics.com",
  "Newark, NJ · Vashi, Navi Mumbai",    // footer office line
  "our Vashi warehouse",                // customer headline names no suburb
];

describe("support contact", () => {
  it("is contact-us@dotconnectslogistics.com", () => {
    expect(COMPANY.email).toBe("contact-us@dotconnectslogistics.com");
  });

  it("carries no phone, WhatsApp, second address or office line", () => {
    for (const key of ["phone", "phoneHref", "whatsapp", "whatsappHref", "queriesEmail", "locations"]) {
      expect(COMPANY, key).not.toHaveProperty(key);
    }
  });

  it("no source file still holds a retired contact", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const needle of RETIRED) if (text.includes(needle)) hits.push(`${relative(SRC, file)}: ${needle}`);
    }
    expect(hits).toEqual([]);
  });

  it("every mailto: goes through COMPANY.email, never a typed address", () => {
    // A typed address is how support@ outlived company.ts on the
    // delayed-parcel message.
    const typed: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/mailto:([^"'`\s?{}]+@[^"'`\s?]+)/g)) {
        typed.push(`${relative(SRC, file)}: ${m[1]}`);
      }
    }
    expect(typed).toEqual([]);
  });
});

describe("EmailText", () => {
  // "contact-us@" has a hyphen, and a hyphen is a line-break point: the
  // help card showed "contact-" / "us@dotconnects…" on 320–340px phones,
  // and the delayed message split that way on every phone.
  const html = render(EmailText).body.replace(/<!--.*?-->/g, "");

  it("holds everything up to the @ together and breaks only after it", () => {
    expect(html).toMatch(/<span class="local[^"]*">contact-us@<\/span><wbr\s*\/?>dotconnectslogistics\.com/);
  });

  it("adds no characters, so a copied address is exact", () => {
    expect(html.replace(/<[^>]*>/g, "")).toBe(COMPANY.email);
  });
});
