import type { MetadataRoute } from "next";
import { CHANGELOG } from "@/lib/changelog";
import { absolute } from "@/lib/site-url";

/**
 * The two pages. Both change when the changelog does: the landing page
 * shows its four newest entries.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = CHANGELOG[0].date;
  return [
    { url: absolute("/"), lastModified, changeFrequency: "monthly", priority: 1 },
    { url: absolute("/zmeny"), lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
