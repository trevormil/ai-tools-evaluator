import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = {
  title: "Submit a tool — AIx",
  description: "Drop a GitHub repo into the queue for a harsh, honest AIx evaluation.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <p className="eyebrow">Submit</p>
        <h1 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Put a tool <span className="text-brand">on the bench.</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Drop a GitHub repo and the scanner evaluates it on its next run — the 10-metric scorecard,
          the verdict, and the &ldquo;is this just complexity?&rdquo; devil&apos;s advocate. It
          shows in the queue until then.
        </p>
      </div>
      <SubmitForm />
    </div>
  );
}
