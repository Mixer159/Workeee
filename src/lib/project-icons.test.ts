import { describe, expect, it } from "vitest";
import {
  ICON_ACCEPT,
  MAX_ICON_BYTES,
  iconMimeType,
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

  it("names an unnamed .ico by its extension", () => {
    expect(iconMimeType(file("favicon.ICO", ""))).toBe("image/x-icon");
    expect(iconMimeType(file("favicon.ico", "application/octet-stream"))).toBe(
      "image/x-icon",
    );
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

  it("refuses SVG — it is a script surface", () => {
    expect(validateIconFile(file("logo.svg", "image/svg+xml"))).toMatch(
      /musí být obrázek/,
    );
    expect(
      validateIconFile(file("logo.svg", "image/svg+xml;charset=utf-8")),
    ).toMatch(/musí být obrázek/);
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

describe("ICON_ACCEPT", () => {
  it("offers .ico by extension as well as by type", () => {
    expect(ICON_ACCEPT).toContain("image/x-icon");
    expect(ICON_ACCEPT).toContain("image/vnd.microsoft.icon");
    expect(ICON_ACCEPT.split(",")).toContain(".ico");
  });

  it("never offers SVG", () => {
    expect(ICON_ACCEPT).not.toContain("svg");
  });
});
