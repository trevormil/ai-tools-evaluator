import type { ProfileLink } from "@aix/db";
import { ProfileLinkIcon } from "@/components/profile-link-icon";
import { PROFILE_LINK_META, isProfileLinkKind } from "@/lib/profile-link-kinds";

/** Public row of external profile links (icon buttons). */
export function ProfileLinks({ links }: { links: ProfileLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l) =>
        isProfileLinkKind(l.kind) ? (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer nofollow"
            title={PROFILE_LINK_META[l.kind].label}
            aria-label={PROFILE_LINK_META[l.kind].label}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:border-orange-500 hover:text-orange-600 dark:border-neutral-700 dark:hover:text-orange-400"
          >
            <ProfileLinkIcon kind={l.kind} className="h-4 w-4" />
          </a>
        ) : null,
      )}
    </div>
  );
}
