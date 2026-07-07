import type { MetadataRoute } from "next";
import { listItems } from "@/lib/queries";
import { absoluteUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

/** Static top-level pages plus every published item URL. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = ["/", "/directory"].map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
  }));

  const items = listItems({ sort: "new", limit: 100 }).map((item) => ({
    url: absoluteUrl(`/item/${item.slug}`),
    lastModified: new Date(item.createdAt * 1000),
  }));

  return [...staticPaths, ...items];
}
