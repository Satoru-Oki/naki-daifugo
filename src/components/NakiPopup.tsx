"use client";

import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface NakiPopupProps {
  targetCard: GameCard;
  onNaki: () => void;
  onSkip: () => void;
}

export default function NakiPopup({ targetCard, onNaki, onSkip }: NakiPopupProps) {
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50
      bg-[#1a0e08f2] rounded-2xl px-5 py-3 border-2 border-red-500/50
      shadow-[0_0_24px_rgba(231,76,60,0.2)] flex flex-col items-center gap-2 min-w-[220px]">
      <span className="text-red-500 text-sm font-black">🀄 鳴きチャンス！</span>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 text-xs">対象:</span>
        <PlayingCard card={targetCard} size="md" glowing />
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={onNaki}
          className="bg-gradient-to-br from-red-700 to-red-500 text-white
            border-none rounded-lg px-6 py-2 text-sm font-black cursor-pointer
            hover:from-red-600 hover:to-red-400 transition-colors"
        >
          鳴く
        </button>
        <button
          onClick={onSkip}
          className="bg-white/5 text-gray-400 border border-white/10
            rounded-lg px-5 py-2 text-sm cursor-pointer hover:bg-white/10 transition-colors"
        >
          スルー
        </button>
      </div>
    </div>
  );
}
