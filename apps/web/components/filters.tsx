"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  INTEGRATION_KINDS,
  Verdict,
  PRIMARY_AUDIENCES,
  PRIMARY_AUDIENCE_LABELS,
} from "@aix/core";

const VERDICTS = Verdict.options;
const SORTS = ["hot", "new", "top"] as const;

/**
 * The bench control strip: one prominent search field, then a compact row of
 * scoped selects. Every control writes straight to the URL.
 */
export function Filters() {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`/?${next.toString()}`);
    },
    [params, router],
  );

  const val = (k: string) => params.get(k) ?? "";
  const hasFilters = ["q", "category", "integration", "verdict", "audience", "minScore"].some(
    (k) => !!params.get(k),
  );

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        defaultValue={val("q")}
        placeholder="Search tools, papers, MCP servers…   ⏎"
        className="input !rounded-xl !px-4 !py-3 text-base"
        aria-label="Search the directory"
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="input !w-auto !rounded-lg !py-1.5 text-xs"
          value={val("category")}
          onChange={(e) => setParam("category", e.target.value)}
          aria-label="Category"
        >
          <option value="">Category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !rounded-lg !py-1.5 text-xs"
          value={val("integration")}
          onChange={(e) => setParam("integration", e.target.value)}
          aria-label="Integration"
        >
          <option value="">Integration</option>
          {INTEGRATION_KINDS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !rounded-lg !py-1.5 text-xs"
          value={val("verdict")}
          onChange={(e) => setParam("verdict", e.target.value)}
          aria-label="Verdict"
        >
          <option value="">Verdict</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !rounded-lg !py-1.5 text-xs"
          value={val("audience")}
          onChange={(e) => setParam("audience", e.target.value)}
          aria-label="Audience"
        >
          <option value="">Audience</option>
          {PRIMARY_AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {PRIMARY_AUDIENCE_LABELS[a]}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !rounded-lg !py-1.5 text-xs"
          value={val("minScore")}
          onChange={(e) => setParam("minScore", e.target.value)}
          aria-label="Minimum score"
        >
          <option value="">Any score</option>
          {[50, 60, 70, 80, 90].map((s) => (
            <option key={s} value={String(s)}>
              {s}+
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !rounded-lg !py-1.5 text-xs"
          value={val("sort") || "hot"}
          onChange={(e) => setParam("sort", e.target.value)}
          aria-label="Sort"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              sort: {s}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink"
            onClick={() => router.push("/")}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
