import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { search, getHighlights, trackClickThrough } from "../api.js";

/** A minimal ok Response stub for the global fetch mock. */
function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("search", () => {
  it("hits the brand endpoint with braille thumbnails + first-party headers", async () => {
    fetchMock.mockResolvedValue(
      okJson({ brand: "ray-ban", query: "aviators", products: [{ title: "X" }] }),
    );

    const res = await search("ray-ban", "aviators", "cli-test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/ray-ban?q=aviators");
    expect(url).toContain("format=json");
    expect(url).toContain("thumbnails=braille");
    expect(init.headers["X-Agent-Name"]).toBe("Aigency CLI");
    expect(init.headers["X-Channel"]).toBe("cli");
    expect(init.headers["X-Session-Id"]).toBe("cli-test");
    expect(init.headers["User-Agent"]).toMatch(/^aigency-cli\//);
    expect(res.products[0].title).toBe("X");
  });

  it("throws a clear error on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    } as Response);
    await expect(search("ray-ban", "x", "cli-test")).rejects.toThrow(/500/);
  });
});

describe("getHighlights", () => {
  it("requests braille tiles and returns items, [] on a bad shape", async () => {
    fetchMock.mockResolvedValue(okJson({ items: [{ title: "Sunglasses", query: "sunglasses" }] }));
    const items = await getHighlights("ray-ban", "cli-test");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/highlights/ray-ban?thumbnails=braille",
    );
    expect(items).toHaveLength(1);

    fetchMock.mockResolvedValue(okJson({ nope: true }));
    expect(await getHighlights("ray-ban", "cli-test")).toEqual([]);
  });

  it("resolves to [] on network failure (never throws)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await getHighlights("ray-ban", "cli-test")).toEqual([]);
  });
});

describe("trackClickThrough", () => {
  it("POSTs a session-scoped click_through with the product + utm source", async () => {
    fetchMock.mockResolvedValue(okJson({ ok: true }));

    await trackClickThrough(
      { brand: "ray-ban", product: "Aviator Classic", url: "https://x/p" },
      "cli-test",
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/track");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Channel"]).toBe("cli");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      event: "click_through",
      sessionId: "cli-test",
      brandKey: "ray-ban",
      product: "Aviator Classic",
      url: "https://x/p",
      utmSource: "aigency-cli",
    });
  });

  it("never throws, even when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(
      trackClickThrough({ brand: "ray-ban", product: "X" }, "cli-test"),
    ).resolves.toBeUndefined();
  });
});
