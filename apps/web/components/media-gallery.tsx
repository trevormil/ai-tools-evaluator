import type { MediaAsset } from "@aix/core";

export function MediaGallery({ media }: { media: MediaAsset[] }) {
  if (!media.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {media.map((m, i) => {
        const src = m.cachedUrl ?? m.url;
        return m.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={m.alt ?? ""}
            className="w-full rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
          />
        ) : (
          <video key={i} src={src} controls className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800" />
        );
      })}
    </div>
  );
}
