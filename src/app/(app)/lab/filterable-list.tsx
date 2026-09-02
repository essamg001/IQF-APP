"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";

type Item = { key: string; searchText: string; node: React.ReactNode };

// The Resolved lists can hold dozens of past results -- a plain scroll is
// the only way to find one specific lot today. This keeps every row
// server-rendered (forms, certificate links, and all) and just filters
// which of those already-rendered nodes are shown, by lot number.
export function FilterableList({
  items,
  placeholder,
  emptyMessage,
  noMatchMessage,
}: {
  items: Item[];
  placeholder: string;
  emptyMessage: string;
  noMatchMessage: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? items.filter((i) => i.searchText.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div>
      {items.length > 0 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="mb-2"
        />
      )}
      <div className="divide-y divide-slate-100">
        {filtered.map((i) => (
          <div key={i.key}>{i.node}</div>
        ))}
        {items.length === 0 && <p className="py-2 text-sm text-slate-400">{emptyMessage}</p>}
        {items.length > 0 && filtered.length === 0 && <p className="py-2 text-sm text-slate-400">{noMatchMessage}</p>}
      </div>
    </div>
  );
}
