"use client";

import Image from "next/image";
import PlayingCard from "@/components/PlayingCard";
import type { PokerPlayerInfo } from "../../../shared/poker/types";

interface PokerOpponentBarProps {
  players: PokerPlayerInfo[];
  myId: string;
}

export default function PokerOpponentBar({ players, myId }: PokerOpponentBarProps) {
  // 自分以外のプレイヤーを自分の次の席から順に表示
  const myIdx = players.findIndex((p) => p.id === myId);
  const total = players.length;
  const opponents: PokerPlayerInfo[] = [];
  for (let i = 1; i < total; i++) {
    opponents.push(players[(myIdx + i) % total]);
  }

  return (
    <div className="flex justify-center gap-3 px-3 py-2 flex-wrap">
      {opponents.map((p) => (
        <div
          key={p.id}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[90px]
            ${p.isCurrentTurn ? "bg-yellow-500/25 ring-2 ring-yellow-400/50" : "bg-black/25"}
            ${p.folded ? "opacity-40" : ""}`}
        >
          {/* アバター */}
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-600 ring-1 ring-white/10">
            {p.avatar ? (
              <Image src={`/icon/${p.avatar}`} alt={p.name} fill sizes="48px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-base text-white/60 font-bold">
                {p.name[0]}
              </div>
            )}
          </div>

          {/* 名前 */}
          <span className="text-sm text-white/90 truncate max-w-[80px] font-medium">
            {p.name}
          </span>

          {/* 役職バッジ */}
          <div className="flex gap-1">
            {p.isDealer && (
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-bold">D</span>
            )}
            {p.isSB && (
              <span className="text-[10px] bg-blue-500/40 text-blue-200 px-1.5 py-0.5 rounded font-bold">SB</span>
            )}
            {p.isBB && (
              <span className="text-[10px] bg-orange-500/40 text-orange-200 px-1.5 py-0.5 rounded font-bold">BB</span>
            )}
          </div>

          {/* チップ */}
          <span className="text-sm text-yellow-300 font-mono font-bold">
            {p.chips}
          </span>

          {/* ベット額 */}
          {p.currentBet > 0 && (
            <span className="text-xs text-green-300 font-mono">
              Bet: {p.currentBet}
            </span>
          )}

          {/* 状態 */}
          {p.folded && <span className="text-xs text-red-400 font-bold">Fold</span>}
          {p.allIn && !p.folded && <span className="text-xs text-purple-300 font-bold">All-in</span>}

          {/* ショーダウン時のホールカード */}
          {p.holeCards && p.holeCards.length > 0 && (
            <div className="flex gap-1 mt-1">
              {p.holeCards.map((c) => (
                <PlayingCard key={c.id} card={c} size="md" />
              ))}
            </div>
          )}
          {p.handLabel && (
            <span className="text-[10px] text-amber-300 font-bold">{p.handLabel}</span>
          )}
        </div>
      ))}
    </div>
  );
}
