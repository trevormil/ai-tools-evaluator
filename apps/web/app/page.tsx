import { Suspense } from "react";
import type { Item } from "@aix/db";
import { loadCorpus } from "@/lib/corpus";
import { latestRecap } from "@/lib/recap";
import { listQueued } from "@/lib/queue";
import { DirectoryClient } from "./directory-client";
import type { DirectoryItem } from "@/components/item-row";

/** Project a full corpus row to the slim shape the directory ships to the client. */
function toDirectoryItem(i: Item): DirectoryItem {
  return {
    id: i.id,
    slug: i.slug,
    title: i.title,
    tagline: i.tagline,
    verdict: i.verdict,
    category: i.category,
    integration: i.integration,
    primaryAudience: i.primaryAudience,
    overallScore: i.overallScore,
    noiseScore: i.noiseScore,
    coverImageUrl: i.coverImageUrl,
    scoreStatus: i.scoreStatus,
    tagsJson: i.tagsJson,
    createdAt: i.createdAt,
    externalId: i.externalId,
    kind: i.kind,
  };
}

/**
 * Home IS the directory. Static export (ADR-0004): at build we read the whole
 * git corpus, project a slim catalog, and hand it to the client component, which
 * does all filtering/search/sort/pagination in the browser off the URL.
 */
export default function HomePage() {
  const items = loadCorpus().map(toDirectoryItem);
  const lead = latestRecap()?.leadPick ?? null;
  const pick = lead ? toDirectoryItem(lead) : null;
  const queued = listQueued();

  return (
    <Suspense>
      <DirectoryClient items={items} queued={queued} pick={pick} />
    </Suspense>
  );
}
