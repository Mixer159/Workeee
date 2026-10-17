import type { MetadataRoute } from "next";
import { absolute } from "@/lib/site-url";

/** Everything may be crawled; the sitemap lists the two pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absolute("/sitemap.xml"),
  };
}
