// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFile, downloadName } from "@/lib/file-download";

const STORAGE_URL =
  "https://example.convex.cloud/api/storage/d540a90d-0ec0-42d8-b3e5-3dc5fad63eac";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadFile", () => {
  it("saves the stored bytes under the file's own name", async () => {
    const text = "Příliš žluťoučký kůň úpěl ďábelské ódy";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(text, { headers: { "Content-Type": "text/plain" } })),
    );
    let saved: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      saved = blob as Blob;
      return "blob:workeee/1";
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await downloadFile(STORAGE_URL, "landing-texty.txt");

    const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined;

    expect(clicked?.download).toBe("landing-texty.txt");
    expect(clicked?.href).toBe("blob:workeee/1");
    expect(new TextDecoder().decode(await saved!.arrayBuffer())).toBe(text);
  });

  it("refuses with a readable message when storage answers an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await expect(downloadFile(STORAGE_URL, "a.pdf")).rejects.toThrow(
      "Soubor se nepovedlo stáhnout.",
    );
    expect(click).not.toHaveBeenCalled();
  });
});

describe("downloadName", () => {
  it("keeps a real name and names an unnamed block by its type", () => {
    expect(downloadName("Zadání.pdf", "application/pdf")).toBe("Zadání.pdf");
    expect(downloadName("", "image/jpeg")).toBe("soubor.jpg");
    expect(downloadName(" ", "text/plain;charset=utf-8")).toBe("soubor.txt");
    expect(downloadName("", "")).toBe("soubor");
  });
});
