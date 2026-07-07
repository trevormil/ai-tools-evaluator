import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/public-api";

/** Allow all crawlers; advertise the sitemap and Atom feed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
