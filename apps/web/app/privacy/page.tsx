import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — AIx",
  description:
    "What AIx collects (nothing), what stays on your device, and what the iOS app talks to.",
};

/**
 * Required by the App Store: a reachable privacy policy whose claims match
 * `ios/AIx/PrivacyInfo.xcprivacy` (no tracking, no data collected). Keep the two
 * in sync — a drift here is a review rejection, not a docs nit.
 */
const LAST_UPDATED = "July 21, 2026";
const CONTACT = "trevormiller23@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="eyebrow">Privacy</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          We do not collect your data.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Not as a policy position that hedges elsewhere in the fine print — there is no analytics
          SDK, no advertising identifier, and no third-party tracker in the AIx website or the iOS
          app.
        </p>
        <p className="data mt-3 text-[11px] uppercase tracking-[0.2em] text-faint">
          Last updated {LAST_UPDATED}
        </p>
      </div>

      <Section title="The iOS app">
        <p>
          The app is a read-only reader. It makes anonymous HTTPS <code>GET</code> requests to this
          site&apos;s public API to fetch evaluations, the daily pick, and trending items. Those
          requests carry no account, no identifier, and no advertising ID — our servers see the
          standard web-request metadata (IP address and user agent) that any HTTPS request
          necessarily includes, and we do not build profiles from it or associate it with you.
        </p>
        <p>
          There is no sign-in inside the app. Accounts and every social action live on the website.
        </p>
      </Section>

      <Section title="Favorites stay on your device">
        <p>
          Bookmarked items and your saved reading list are written to local storage on your device
          only. They are never uploaded, never synced to us, and never leave the phone. Deleting the
          app deletes them.
        </p>
      </Section>

      <Section title="Notifications are local">
        <p>
          The optional daily-pick reminder is a <em>local</em> notification scheduled by your
          device. There is no push infrastructure and no device token is sent anywhere. The
          permission prompt appears only if you turn the reminder on in Settings, and turning it off
          cancels it.
        </p>
      </Section>

      <Section title="Tracking">
        <p>
          We do not track you across apps or websites, and we do not sell or share data with data
          brokers or advertisers. The app&apos;s privacy manifest declares no tracking domains and
          no collected data types.
        </p>
      </Section>

      <Section title="The website">
        <p>
          Browsing the site anonymously requires no account. If you choose to create one, we store
          what you give us to make the account work — your username, email, and the content you
          post. Posts, takes, and comments you publish are public by intent. Session cookies keep
          you signed in; they are not used for advertising.
        </p>
        <p>
          The optional newsletter stores your email address for the purpose of sending it, and every
          issue has an unsubscribe link.
        </p>
      </Section>

      <Section title="Third parties">
        <p>
          Evaluations are generated with the help of large language model providers, and items are
          sourced from public APIs such as GitHub, Hugging Face, Hacker News, and Product Hunt.
          Those requests concern public repositories and papers — your personal data is not sent to
          them.
        </p>
      </Section>

      <Section title="Children">
        <p>
          AIx is a developer-tools directory not directed at children, and we do not knowingly
          collect information from anyone under 13.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes materially, the date above changes with it. Questions, corrections,
          or a request to delete a website account:{" "}
          <a className="text-brand underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
