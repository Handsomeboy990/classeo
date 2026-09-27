import type { MetadataRoute } from "next";

import { robotsRules } from "@/lib/seo";

// /robots.txt: the public pages are open to search engines, the private
// space, the API, the demonstration page and the password flows are not.
export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
