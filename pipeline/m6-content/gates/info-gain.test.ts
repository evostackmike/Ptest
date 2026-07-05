import { describe, expect, it } from "vitest";
import { extractInfoUnits, infoGain, MIN_INFO_GAIN } from "./info-gain.js";
import {
  archPage,
  crescentIncumbents,
  crescentPages,
  makeContext,
  samplePage,
} from "../test-support.js";

describe("infoGain — regression proof on the reference client's REAL location copy", () => {
  it.each(crescentPages().map((p) => [p.url, p] as const))(
    "fails %s: re-mentioning what the incumbents already cover is not information gain",
    (url, page) => {
      const ctx = makeContext({
        page: archPage(url, "DEGRADED"),
        siblings: crescentPages().filter((p) => p.url !== url),
        incumbentTexts: crescentIncumbents(),
      });
      const failures = infoGain(page, ctx);
      expect(failures.length).toBe(1);
      expect(failures[0].gate).toBe("info-gain");
      expect(failures[0].message).toContain(`need ≥${MIN_INFO_GAIN}`);
    }
  );

  it("passes the hand-written page that adds real local facts the incumbents lack", () => {
    const sample = samplePage();
    const ctx = makeContext({
      page: archPage(sample.url, "DEGRADED"),
      siblings: crescentPages(),
      incumbentTexts: crescentIncumbents(),
    });
    expect(infoGain(sample, ctx)).toEqual([]);
  });
});

describe("infoGain — unit extraction and discounting", () => {
  it("extracts multi-word entities, money, unit-numbers, and years", () => {
    const units = extractInfoUnits(
      "Avista Utilities asks $95–$140 for the permit on a 200-amp panel in homes built before 1980."
    );
    const displays = [...units.values()];
    expect(displays).toContain("Avista Utilities");
    expect(displays).toContain("$95–$140");
    expect(displays).toContain("200-amp");
    expect(displays).toContain("1980");
  });

  it("does not treat coordinations as entities and never spans line breaks", () => {
    const units = extractInfoUnits("We serve Ridgeview and Lakemont\nGreat Basin work too.");
    const keys = [...units.keys()];
    expect(keys).not.toContain("ridgeview and lakemont");
    expect(keys).not.toContain("lakemont great basin");
    expect(keys).toContain("great basin");
  });

  it("discounts the client's own brand name — self-reference is not local info", () => {
    const page = samplePage();
    // Body mentioning only the brand + one novel entity: still below MIN_INFO_GAIN.
    const branded = {
      ...page,
      title: "About us",
      metaDescription: "About the company.",
      body: "Crescent Electric LLC is run by Parker McPhetridge. Crescent Electric answers the phone.",
      faq: [],
    };
    const ctx = makeContext({
      page: archPage(page.url, "DEGRADED"),
      incumbentTexts: crescentIncumbents(),
    });
    const failures = infoGain(branded, ctx);
    expect(failures.length).toBe(1);
    expect(failures[0].message).toContain("0 unique local info unit(s)");
  });

  it("discounts units repeated across ≥2 siblings as template furniture", () => {
    const filler = "The Grange Hall Historic District anchors the town square.";
    const page = { ...samplePage(), body: filler, title: "t", metaDescription: "m", faq: [] };
    const sib = (url: string) => ({ url, title: "t", metaDescription: "m", body: filler, faq: [] });
    const ctx = makeContext({
      page: archPage(page.url, "DEGRADED"),
      siblings: [sib("/a"), sib("/b")],
      incumbentTexts: ["Some incumbent text about electrical work."],
    });
    const failures = infoGain(page, ctx);
    expect(failures.length).toBe(1);
    expect(failures[0].message).not.toContain("Grange Hall");
  });

  it("passes vacuously when no incumbent texts are injected (V05 tightening)", () => {
    const page = crescentPages()[0];
    const ctx = makeContext({ page: archPage(page.url), incumbentTexts: [] });
    expect(infoGain(page, ctx)).toEqual([]);
  });
});
