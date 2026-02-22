"use client";

import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface FieldProps {
  cards: GameCard[];
}

export default function Field({ cards }: FieldProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100px] relative">
      {/* Green felt effect */}
      <div className="absolute inset-4 rounded-[60px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(34,85,51,0.15), transparent 70%)" }}
      />
      <div className="relative z-[1] flex gap-1.5 min-h-[84px] items-center">
        {cards.length > 0 ? (
          cards.map((c) => <PlayingCard key={c.id} card={c} size="lg" />)
        ) : (
          <div className="text-white/10 text-sm font-semibold px-8 py-5 rounded-xl border border-dashed border-white/5">
            場にカードなし
          </div>
        )}
      </div>
    </div>
  );
}
