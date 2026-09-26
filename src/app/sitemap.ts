import type { MetadataRoute } from "next";

import { sitemapEntries } from "@/lib/seo";

// /sitemap.xml: the public pages, each with its Fongbe and Yoruba versions.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
