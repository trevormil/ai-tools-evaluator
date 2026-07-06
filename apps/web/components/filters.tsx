"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CATEGORIES, CATEGORY_LABELS, INTEGRATION_KINDS, Verdict, PRIMARY_AUDIENCES, PRIMARY_AUDIENCE_LABELS } from "@aix/core";

const VERDICTS = Verdict.options;
const SORTS = ["hot", "new", "top"] as const;

export function Filters() {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/directory?${next.toString()}`);
    },
    [params, router],
  );

  const val = (k: string) => params.get(k) ?? "";

  return (
    <div className="card flex flex-col gap-3 p-4">
      <input
        type="search"
        defaultValue={val("q")}
        placeholder="Search tools…"
        className="input"
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
        }}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <select className="input" value={val("category")} onChange={(e) => setParam("category", e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="input" value={val("integration")} onChange={(e) => setParam("integration", e.target.value)}>
          <option value="">All integrations</option>
          {INTEGRATION_KINDS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select className="input" value={val("verdict")} onChange={(e) => setParam("verdict", e.target.value)}>
          <option value="">All verdicts</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select className="input" value={val("audience")} onChange={(e) => setParam("audience", e.target.value)}>
          <option value="">All audiences</option>
          {PRIMARY_AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {PRIMARY_AUDIENCE_LABELS[a]}
            </option>
          ))}
        </select>
        <select className="input" value={val("minScore")} onChange={(e) => setParam("minScore", e.target.value)}>
          <option value="">Any score</option>
          {[50, 60, 70, 80, 90].map((s) => (
            <option key={s} value={String(s)}>
              {s}+
            </option>
          ))}
        </select>
        <select className="input" value={val("sort") || "hot"} onChange={(e) => setParam("sort", e.target.value)}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={() => router.push("/directory")}>
          Reset
        </button>
      </div>
    </div>
  );
}
