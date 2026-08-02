import { describe, expect, it } from "vitest";
import {
  ICON_ACCEPT,
  MAX_ICON_BYTES,
  MAX_ICON_SVG_BYTES,
  iconMimeType,
  isSvgFile,
  validateIconFile,
} from "@/lib/project-icons";

function file(name: string, type: string, size = 1024): File {
  const blob = new File([new Uint8Array(size)], name, { type });
  return blob;
}

describe("iconMimeType", () => {
  it("keeps the type the browser reported", () => {
    expect(iconMimeType(file("logo.png", "image/png"))).toBe("image/png");
    expect(iconMimeType(file("favicon.ico", "image/x-icon"))).toBe(
      "image/x-icon",
    );
    expect(iconMimeType(file("favicon.ico", "image/vnd.microsoft.icon"))).toBe(
      "image/vnd.microsoft.icon",
    );
  });

  it("drops parameters and normalizes case", () => {
    expect(iconMimeType(file("logo.png", "IMAGE/PNG; charset=binary"))).toBe(
      "image/png",
    );
  });

  it("names an unnamed .ico or .svg by its extension", () => {
    expect(iconMimeType(file("favicon.ICO", ""))).toBe("image/x-icon");
    expect(iconMimeType(file("favicon.ico", "application/octet-stream"))).toBe(
      "image/x-icon",
    );
    expect(iconMimeType(file("logo.SVG", ""))).toBe("image/svg+xml");
  });

  it("invents nothing for any other unnamed file", () => {
    expect(iconMimeType(file("neco.bin", ""))).toBe("");
    expect(iconMimeType(file("neco.bin", "application/octet-stream"))).toBe(
      "application/octet-stream",
    );
  });
});

describe("validateIconFile", () => {
  it("accepts the raster formats the picker offers", () => {
    expect(validateIconFile(file("logo.png", "image/png"))).toBeNull();
    expect(validateIconFile(file("logo.gif", "image/gif"))).toBeNull();
    expect(validateIconFile(file("favicon.ico", "image/x-icon"))).toBeNull();
    expect(
      validateIconFile(file("favicon.ico", "image/vnd.microsoft.icon")),
    ).toBeNull();
    // The one an operating system may hand over with no type at all.
    expect(validateIconFile(file("favicon.ico", ""))).toBeNull();
  });

  it("accepts an SVG small enough to ride in the project list", () => {
    expect(validateIconFile(file("logo.svg", "image/svg+xml"))).toBeNull();
    expect(
      validateIconFile(file("logo.svg", "image/svg+xml;charset=utf-8")),
    ).toBeNull();
    // The 2 MB raster cap does not apply to markup, and the small one does.
    expect(
      validateIconFile(file("logo.svg", "image/svg+xml", MAX_ICON_SVG_BYTES + 1)),
    ).toMatch(/nejvýš 32 kB/);
  });

  it("refuses anything that is not an image", () => {
    expect(validateIconFile(file("dokument.pdf", "application/pdf"))).toMatch(
      /musí být obrázek/,
    );
    expect(validateIconFile(file("neco.bin", ""))).toMatch(/musí být obrázek/);
  });

  it("refuses an image over the cap", () => {
    expect(
      validateIconFile(file("logo.png", "image/png", MAX_ICON_BYTES + 1)),
    ).toMatch(/nejvýš 2 MB/);
  });
});

describe("isSvgFile", () => {
  it("decides which of the two roads a file takes", () => {
    expect(isSvgFile(file("logo.svg", "image/svg+xml"))).toBe(true);
    expect(isSvgFile(file("logo.svg", ""))).toBe(true);
    expect(isSvgFile(file("logo.png", "image/png"))).toBe(false);
    expect(isSvgFile(file("favicon.ico", "image/x-icon"))).toBe(false);
  });
});

describe("ICON_ACCEPT", () => {
  it("offers .ico and .svg by extension as well as by type", () => {
    expect(ICON_ACCEPT).toContain("image/x-icon");
    expect(ICON_ACCEPT).toContain("image/vnd.microsoft.icon");
    expect(ICON_ACCEPT).toContain("image/svg+xml");
    expect(ICON_ACCEPT.split(",")).toContain(".ico");
    expect(ICON_ACCEPT.split(",")).toContain(".svg");
  });
});
