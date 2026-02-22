"use client";

import { useState } from "react";
import type { GameCard } from "@/lib/types";
import type { Card } from "@/lib/types";
import { SUITS, SUIT_SYMBOL } from "@/lib/constants";
import { isJoker } from "@/lib/gameLogic";
import PlayingCard from "./PlayingCard";

interface HistoryPanelProps {
  history: GameCard[];
  handCount?: number;
  selectedCount?: number;
}

export default function HistoryPanel({ history, handCount = 0, selectedCount = 0 }: HistoryPanelProps) {
  const [open, setOpen] = useState(false);

  const suitCounts = SUITS.map((s) => ({
    suit: s,
    symbol: SUIT_SYMBOL[s],
    remaining: 13 - history.filter((c) => !isJoker(c) && (c as Card).suit === s).length,
  }));

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="bg-white/[0.08] border border-white/10 rounded-md px-2 py-0.5
          text-white/60 text-[10px] cursor-pointer hover:bg-white/15 transition-colors whitespace-nowrap"
      >
        {open ? "閉じる" : "履歴"}
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 right-0 w-[300px] bg-[#0a150ef2] px-3.5 py-2.5 rounded-xl border border-[#1a2e1e] z-[200]">
          <div className="flex flex-wrap gap-1 mb-2">
            {history.length > 0 ? (
              history.map((c, i) => <PlayingCard key={`${c.id}-${i}`} card={c} size="sm" />)
            ) : (
              <span className="text-white/40 text-[11px]">まだなし</span>
            )}
          </div>
          <div className="flex gap-2.5 flex-wrap">
            {suitCounts.map((s) => (
              <span key={s.suit} className="text-[10px] text-white/50">
                {s.symbol} 残{s.remaining}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
