import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { renderSvg } from "./render";
import { decodePixels } from "./scan";
import { buildPayload, contentSchema, normalizeUrl } from "./content";
import { DOT_SHAPES, EYE_BALLS, EYE_FRAMES, styleSchema } from "./style";

/** Rasterise exactly like a print/PNG export would, then decode with a real QR reader. */
function scan(svg: string, px = 900): string | null {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: px } }).render();
  return decodePixels(new Uint8ClampedArray(img.pixels), img.width, img.height);
}

describe("scan round-trip (rendered image -> QR reader)", () => {
  const url = "https://example.com/menu?table=12&lang=en";

  for (const dotShape of DOT_SHAPES) {
    it(`decodes dot shape: ${dotShape}`, () => {
      expect(scan(renderSvg(url, { dotShape }))).toBe(url);
    });
  }
  for (const eyeFrame of EYE_FRAMES) {
    for (const eyeBall of EYE_BALLS) {
      it(`decodes eyes: frame=${eyeFrame} ball=${eyeBall}`, () => {
        expect(scan(renderSvg(url, { eyeFrame, eyeBall, dotShape: "heart" }))).toBe(url);
      });
    }
  }

  it("decodes the heart design from the brief (heart dots, rounded eyes, black on white)", () => {
    expect(scan(renderSvg(url, { dotShape: "heart", eyeFrame: "rounded", eyeBall: "square" }))).toBe(url);
  });

  for (const px of [250, 400, 700, 900, 1200]) {
    it(`decodes hearts at ${px}px`, () => {
      expect(scan(renderSvg(url, { dotShape: "heart" }), px)).toBe(url);
    });
  }

  it("decodes coloured codes with a custom eye colour", () => {
    expect(scan(renderSvg(url, { dotShape: "heart", fg: "#1d4ed8", eyeColor: "#be123c", bg: "#fff7ed" }))).toBe(url);
  });

  it("decodes long, dense payloads", () => {
    const long = "https://example.com/" + "a".repeat(300);
    expect(scan(renderSvg(long, { dotShape: "heart" }), 1400)).toBe(long);
  });

  it("decodes with a centred logo (error correction forced to H)", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const svg = renderSvg(url, { dotShape: "rounded", logo: { href: png, size: 0.2 }, ecc: "L" });
    expect(scan(svg)).toBe(url);
  });
});

describe("renderer safety", () => {
  it("rejects non-hex colours that could inject SVG", () => {
    expect(() => renderSvg("x", { fg: '#000"/><script>alert(1)</script>' })).toThrow();
    expect(() => styleSchema.parse({ bg: "red" })).toThrow();
  });
  it("rejects remote / script logo URIs", () => {
    expect(() => renderSvg("x", { logo: { href: "https://evil.example/x.png", size: 0.2 } })).toThrow();
    expect(() => renderSvg("x", { logo: { href: "javascript:alert(1)", size: 0.2 } })).toThrow();
  });
  it("produces a self-contained SVG with no scripts", () => {
    const svg = renderSvg("hello", { dotShape: "heart" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script|onload|href="http/i);
  });
});

describe("content payloads", () => {
  it("normalises URLs and blocks dangerous schemes", () => {
    expect(normalizeUrl("example.com/a")).toBe("https://example.com/a");
    expect(normalizeUrl("localhost:3000/x")).toBe("https://localhost:3000/x");
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeUrl("data:text/html,hi")).toThrow();
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow();
    expect(() => normalizeUrl("https://user:pw@example.com")).toThrow();
  });

  it("builds WiFi payloads with escaping", () => {
    const c = contentSchema.parse({ type: "wifi", ssid: 'My;Net:"1"', password: "p;a,s\\s", security: "WPA" });
    expect(buildPayload(c)).toBe('WIFI:T:WPA;S:My\\;Net\\:\\"1\\";P:p\\;a\\,s\\\\s;H:false;;');
  });

  it("builds an open WiFi network without a password", () => {
    const c = contentSchema.parse({ type: "wifi", ssid: "Cafe", password: "ignored", security: "nopass" });
    expect(buildPayload(c)).toBe("WIFI:T:nopass;S:Cafe;P:;H:false;;");
  });

  it("builds a vCard and prevents field injection through newlines", () => {
    const c = contentSchema.parse({
      type: "vcard",
      firstName: "Ada\nTEL:666",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    const v = buildPayload(c);
    expect(v.startsWith("BEGIN:VCARD\nVERSION:3.0")).toBe(true);
    expect(v.split("\n").filter((l) => l.startsWith("TEL:"))).toHaveLength(0);
    expect(v.endsWith("END:VCARD")).toBe(true);
  });

  it("builds email, sms, phone and geo", () => {
    expect(buildPayload(contentSchema.parse({ type: "email", to: "a@b.co", subject: "Hi there" }))).toBe("mailto:a@b.co?subject=Hi%20there");
    expect(buildPayload(contentSchema.parse({ type: "sms", phone: "+1 (555) 123-4567", message: "yo" }))).toBe("SMSTO:+15551234567:yo");
    expect(buildPayload(contentSchema.parse({ type: "phone", phone: "+91 98765 43210" }))).toBe("tel:+919876543210");
    expect(buildPayload(contentSchema.parse({ type: "geo", lat: 28.6139, lng: 77.209 }))).toBe("geo:28.6139,77.209");
  });
});
