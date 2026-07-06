import { getCurrentUser } from "@/lib/auth";
import { listSubmissionsByUser } from "@/lib/queries";
import { SubmitForm } from "@/components/submit-form";
import { SubmissionRow } from "@/components/submission-row";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const user = await getCurrentUser();
  const submissions = user ? listSubmissionsByUser(user.id) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Submit a tool</h1>
        <p className="text-sm text-neutral-500">
          Drop a GitHub repo, paper, or link. The scanner drains the queue first on its next run —
          subject to the daily cap and dedup.
        </p>
      </div>

      {user ? (
        <SubmitForm />
      ) : (
        <div className="card p-6 text-center">
          <p className="mb-3 text-sm text-neutral-500">Sign in with GitHub to submit.</p>
          <a href="/api/auth/github" className="btn-primary">
            Sign in with GitHub
          </a>
        </div>
      )}

      {user && submissions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Your submissions
          </h2>
          <ul className="flex flex-col gap-2">
            {submissions.map((s) => (
              <SubmissionRow key={s.id} submission={s} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
