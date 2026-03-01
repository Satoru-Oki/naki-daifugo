"use client";

import PlayingCard from "@/components/PlayingCard";
import type { Card } from "../../../shared/poker/types";

interface PokerHandProps {
  cards: Card[];
}

export default function PokerHand({ cards }: PokerHandProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex justify-center gap-2 py-3">
      {cards.map((card) => (
        <PlayingCard key={card.id} card={card} size="xl" />
      ))}
    </div>
  );
}
