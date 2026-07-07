/** Client-safe stack constants (no DB imports, so client components can use them). */
export const STACK_STATUSES = ["using", "trying", "want-to-try", "dropped"] as const;
export type StackStatus = (typeof STACK_STATUSES)[number];

export const STACK_STATUS_LABELS: Record<StackStatus, string> = {
  using: "Using",
  trying: "Trying",
  "want-to-try": "Want to try",
  dropped: "Dropped",
};
