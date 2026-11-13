import { EXPLORE_QUERY_MAX } from "@highdea/shared";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

import { inputClassName } from "../../components/FormField";

/** 入力が止まってから検索するまでの待ち時間 */
export const SEARCH_DEBOUNCE_MS = 400;

type ExploreSearchProps = { value: string; onSearch: (q: string) => void };

/** Explore の検索欄。入力が止まるか Enter で検索し、検索語は URL の ?q= に持つ（manifests/explore.md P-07） */
export function ExploreSearch({ value, onSearch }: ExploreSearchProps) {
  const [text, setText] = useState(value);
  const onSearchRef = useRef(onSearch);
  const lastSent = useRef(value);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = trimmed;
      onSearchRef.current(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    lastSent.current = text.trim();
    onSearch(text.trim());
  }

  return (
    <form role="search" onSubmit={submit} className="relative">
      <label htmlFor="explore-search" className="sr-only">
        Search public trees
      </label>
      <input
        id="explore-search"
        type="search"
        value={text}
        maxLength={EXPLORE_QUERY_MAX}
        placeholder="Search ideas by title or description"
        onChange={(e) => {
          setText(e.target.value);
        }}
        data-testid="explore-search"
        className={`${inputClassName} pr-10`}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText("");
            lastSent.current = "";
            onSearch("");
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-lg text-slate-400 hover:text-slate-700"
        >
          ×
        </button>
      )}
    </form>
  );
}
