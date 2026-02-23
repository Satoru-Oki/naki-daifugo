"use client";

import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface FieldProps {
  cards: GameCard[];
  prevCards?: GameCard[];
}

/** カード群を描画（重ね表示対応） */
function CardGroup({ cards, opacity }: { cards: GameCard[]; opacity?: string }) {
  const count = cards.length;
  const overlap = count >= 4;
  const overlapOffset = count >= 6 ? 18 : count >= 4 ? 22 : 0;

  if (overlap) {
    return (
      <div className={`flex items-center justify-center ${opacity ?? ""}`}>
        {cards.map((c, i) => (
          <div
            key={c.id}
            style={{
              marginLeft: i === 0 ? 0 : -overlapOffset,
              zIndex: i,
            }}
          >
            <PlayingCard card={c} size="md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex gap-1.5 items-center ${opacity ?? ""}`}>
      {cards.map((c) => <PlayingCard key={c.id} card={c} size="md" />)}
    </div>
  );
}

export default function Field({ cards, prevCards = [] }: FieldProps) {
  const hasPrev = prevCards.length > 0;
  const hasCurrent = cards.length > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80px] relative mt-2">
      {/* Green felt effect */}
      <div className="absolute inset-4 rounded-[60px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(34,85,51,0.15), transparent 70%)" }}
      />
      <div className="relative z-[1] min-h-[68px] flex items-center justify-center">
        {hasCurrent ? (
          <div className="relative">
            {/* 直前のカード（少し上にずらして薄く表示） */}
            {hasPrev && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-0">
                <CardGroup cards={prevCards} opacity="opacity-35" />
              </div>
            )}
            {/* 現在のカード */}
            <div className="relative z-10">
              <CardGroup cards={cards} />
            </div>
          </div>
        ) : (
          <div className="text-white/10 text-sm font-semibold px-8 py-5 rounded-xl border border-dashed border-white/5">
            場にカードなし
          </div>
        )}
      </div>
    </div>
  );
}
