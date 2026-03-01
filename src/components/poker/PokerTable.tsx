"use client";

import PlayingCard from "@/components/PlayingCard";
import type { Card } from "../../../shared/poker/types";

interface PokerTableProps {
  communityCards: Card[];
  pot: number;
}

export default function PokerTable({ communityCards, pot }: PokerTableProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {/* ポット表示 */}
      <div className="text-sm font-bold text-yellow-300 tracking-wide">
        POT: {pot}
      </div>

      {/* コミュニティカード */}
      <div className="flex gap-1.5 justify-center min-h-[84px]">
        {[0, 1, 2, 3, 4].map((i) => {
          const card = communityCards[i];
          if (card) {
            return <PlayingCard key={card.id} card={card} size="lg" />;
          }
          return (
            <div
              key={`empty-${i}`}
              className="w-[60px] h-[84px] rounded-md border border-white/10 bg-white/5"
            />
          );
        })}
      </div>
    </div>
  );
}
