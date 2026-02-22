"use client";

import { useState, useCallback } from "react";
import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface CardExchangeUIProps {
  hand: GameCard[];
  needToGive: number;
  receivedCards: GameCard[];
  waitingFor: string[];
  myRank: string;
  onSubmit: (cardIds: string[]) => void;
}

export default function CardExchangeUI({
  hand,
  needToGive,
  receivedCards,
  waitingFor,
  myRank,
  onSubmit,
}: CardExchangeUIProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const tapCard = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < needToGive) {
          next.add(id);
        }
      }
      return next;
    });
  }, [needToGive]);

  const handleSubmit = useCallback(() => {
    if (selected.size === needToGive) {
      onSubmit(Array.from(selected));
    }
  }, [selected, needToGive, onSubmit]);

  const canSubmit = selected.size === needToGive;

  return (
    <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center p-4">
      <div className="bg-[#1a3a24] rounded-xl p-4 max-w-[400px] w-full shadow-xl border border-[#2d6b3f]">
        <h2 className="text-center text-amber-400 font-bold text-lg mb-2">
          カード交換
        </h2>

        {/* 自分の階級表示 */}
        <p className="text-center text-gray-300 text-sm mb-3">
          あなたは <span className="text-amber-300 font-bold">{myRank}</span> です
        </p>

        {/* 受け取ったカード */}
        {receivedCards.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1 text-center">受け取ったカード:</p>
            <div className="flex justify-center gap-1">
              {receivedCards.map((card) => (
                <PlayingCard key={card.id} card={card} size="md" glowing />
              ))}
            </div>
          </div>
        )}

        {/* カード選択 (渡す必要がある場合) */}
        {needToGive > 0 ? (
          <>
            <p className="text-center text-gray-300 text-sm mb-2">
              {needToGive}枚選んで渡してください
            </p>
            <div className="flex justify-center flex-wrap gap-1 mb-3 max-h-[200px] overflow-y-auto">
              {hand.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={selected.has(card.id)}
                  onClick={() => tapCard(card.id)}
                />
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                canSubmit
                  ? "bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {canSubmit ? `${needToGive}枚渡す` : `${selected.size}/${needToGive}枚 選択中`}
            </button>
          </>
        ) : (
          <p className="text-center text-gray-400 text-sm mb-3">
            交換を待っています...
          </p>
        )}

        {/* 待機中プレイヤー */}
        {waitingFor.length > 0 && (
          <p className="text-center text-xs text-gray-500 mt-2">
            交換待ち: {waitingFor.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
