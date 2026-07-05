import { describe, expect, it } from "vitest";
import { faqUnique } from "./faq-unique.js";
import { archPage, makeContext, makePage } from "../test-support.js";

const permitFaq = {
  q: "Do you handle the permit in Palouse?",
  a: "Yes. We pull the permit and schedule the inspection with the county.",
};

function sibling(url: string, faq: { q: string; a: string }[]) {
  return { url, title: "t", metaDescription: "m", body: "sibling body copy", faq };
}

describe("faqUnique — FAQ overlap across sibling pages", () => {
  it("fails a near-verbatim FAQ duplicated on a sibling, even town-swapped", () => {
    const page = makePage({ url: "/locations/palouse-wa", faq: [permitFaq] });
    const dupe = {
      q: "Do you handle permits in Colfax?",
      a: "Yes. We pull the permits and schedule the inspection with the county.",
    };
    const ctx = makeContext({
      page: archPage(page.url),
      siblings: [sibling("/locations/colfax-wa", [dupe])],
    });
    const failures = faqUnique(page, ctx);
    expect(failures.length).toBe(1);
    expect(failures[0]!.gate).toBe("faq-unique");
    expect(failures[0]!.message).toContain("/locations/colfax-wa");
    expect(failures[0]!.message).toContain(permitFaq.q);
  });

  it("passes genuinely distinct FAQs on siblings", () => {
    const page = makePage({ url: "/locations/palouse-wa", faq: [permitFaq] });
    const different = {
      q: "Can you trench to a detached shop?",
      a: "Usually, if the route is clear. Frozen ground in January changes the plan and the price.",
    };
    const ctx = makeContext({
      page: archPage(page.url),
      siblings: [sibling("/locations/colfax-wa", [different])],
    });
    expect(faqUnique(page, ctx)).toEqual([]);
  });

  it("ignores the page's own entry in the sibling list and passes empty FAQ lists", () => {
    const page = makePage({ url: "/locations/palouse-wa", faq: [permitFaq] });
    const ctx = makeContext({
      page: archPage(page.url),
      siblings: [{ ...page }],
    });
    expect(faqUnique(page, ctx)).toEqual([]);
    const noFaq = makePage({ url: "/locations/palouse-wa", faq: [] });
    expect(faqUnique(noFaq, ctx)).toEqual([]);
  });
});
