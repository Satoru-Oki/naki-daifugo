"use client";

import Image from "next/image";
import type { Player } from "@/lib/types";

interface OpponentBarProps {
  players: Player[];
}

const CARD_W = 56;
const CARD_H = 78;

/** 裏向きカード */
function CardBack({ w = CARD_W, h = CARD_H }: { w?: number; h?: number } = {}) {
  return (
    <div
      className="rounded-[4px] border border-white/15 flex-shrink-0 overflow-hidden relative"
      style={{ width: w, height: h }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-red-950" />
      <div className="absolute inset-[2px] rounded-[2px] border border-amber-400/25" />
      <svg className="absolute inset-[3px]" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="oppDiamonds" x="0" y="0" width="8" height="10" patternUnits="userSpaceOnUse">
            <polygon points="4,0 8,5 4,10 0,5" fill="rgba(255,215,0,0.12)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#oppDiamonds)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full border border-amber-400/35 bg-amber-400/10" />
      </div>
    </div>
  );
}

const TOP_CARD_W = 44;
const TOP_CARD_H = 62;

/** 横扇形カード（上部対戦相手用 — 少し小さめ） */
function HorizontalFan({ count }: { count: number }) {
  if (count === 0) return null;
  const show = Math.min(count, 6);
  const overlap = 16;
  const spread = Math.min(24, (show - 1) * 4);
  const fanW = TOP_CARD_W + (show - 1) * overlap;
  return (
    <div className="relative" style={{ width: fanW, height: TOP_CARD_H + 8 }}>
      {Array.from({ length: show }, (_, i) => {
        const t = show <= 1 ? 0 : (2 * i) / (show - 1) - 1;
        const angle = show <= 1 ? 0 : -spread / 2 + (spread / (show - 1)) * i;
        const yOff = 4 * t * t;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * overlap,
              top: yOff,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "center bottom",
              zIndex: i,
            }}
          >
            <CardBack w={TOP_CARD_W} h={TOP_CARD_H} />
          </div>
        );
      })}
    </div>
  );
}

/** 縦扇形カード（左右対戦相手用） */
function VerticalFan({ count, side }: { count: number; side: "left" | "right" }) {
  if (count === 0) return null;
  const show = Math.min(count, 4);
  const vGap = 14;
  const spread = Math.min(20, (show - 1) * 5);
  const dir = side === "left" ? 1 : -1;
  return (
    <div className="relative" style={{ width: CARD_W + 14, height: CARD_H + (show - 1) * vGap + 6 }}>
      {Array.from({ length: show }, (_, i) => {
        const angle = show <= 1 ? 0 : (-spread / 2 + (spread / (show - 1)) * i) * dir;
        const t = show <= 1 ? 0 : (2 * i) / (show - 1) - 1;
        const xOff = 4 * t * t * dir;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: side === "left" ? xOff : undefined,
              right: side === "right" ? xOff : undefined,
              top: i * vGap,
              transform: `rotate(${angle}deg)`,
              transformOrigin: side === "left" ? "left center" : "right center",
              zIndex: i,
            }}
          >
            <CardBack />
          </div>
        );
      })}
    </div>
  );
}

/** アイコン */
function PlayerIcon({ player }: { player: Player }) {
  const isTurn = player.isCurrentTurn;
  return (
    <div className={`
      w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold
      overflow-hidden relative
      ${isTurn
        ? "border-[3px] border-yellow-400 shadow-[0_0_16px_rgba(241,196,15,0.5)]"
        : "border-[3px] border-white/15"
      }
      ${!player.avatar && (isTurn
        ? "bg-gradient-to-br from-amber-400 to-orange-500"
        : "bg-slate-700"
      )}
    `}>
      {player.avatar ? (
        <Image
          src={`/icon/${player.avatar}`}
          alt={player.name}
          fill
          sizes="80px"
          className="object-cover"
        />
      ) : (
        player.name[0]
      )}
      {player.speaking && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0f1e14]" />
      )}
    </div>
  );
}

/** ラベル: 枚数と名前の表示。inline=true で横並び */
function PlayerLabel({ player, inline = false }: { player: Player; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex items-center gap-1.5 mb-1">
        {player.cardCount > 0 ? (
          <span className="text-white/70 text-base font-bold leading-tight">{player.cardCount}枚</span>
        ) : (
          <span className="text-amber-400 text-base font-bold leading-tight">上がり</span>
        )}
        <span className="text-white text-lg font-bold leading-tight">{player.name}</span>
        {player.passed && <span className="text-red-400 text-sm font-bold leading-tight">PASS</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center mb-1">
      {player.cardCount > 0 ? (
        <span className="text-white/70 text-base font-bold leading-tight">{player.cardCount}枚</span>
      ) : (
        <span className="text-amber-400 text-base font-bold leading-tight">上がり</span>
      )}
      <span className="text-white text-lg font-bold leading-tight">{player.name}</span>
      {player.passed && <span className="text-red-400 text-sm font-bold leading-tight">PASS</span>}
    </div>
  );
}

/** 上部の対戦相手: カードの上にアイコンが重なる */
function TopAvatar({ player }: { player: Player }) {
  const dimmed = player.passed ? "opacity-40" : "";
  return (
    <div className={`flex flex-col items-center ${dimmed}`}>
      <PlayerLabel player={player} inline />
      {/* カード領域 + アイコン重ね */}
      <div className="relative mt-0.5">
        {/* カード（背面） */}
        {player.cardCount > 0 && (
          <div className="pt-5">
            <HorizontalFan count={player.cardCount} />
          </div>
        )}
        {/* アイコン（前面、カードに重なる） */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <PlayerIcon player={player} />
        </div>
      </div>
    </div>
  );
}

/** 左右の対戦相手: アイコンがカード扇の中央に重なる */
function SideAvatar({ player, side }: { player: Player; side: "left" | "right" }) {
  const dimmed = player.passed ? "opacity-40" : "";
  return (
    <div className={`${dimmed}`}>
      {/* カード領域 + アイコン中央重ね（固定幅で名前の長さに影響されない） */}
      <div className="relative w-[90px] min-h-[80px]">
        {/* 名前ラベル（absoluteでレイアウトに影響しない） */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 whitespace-nowrap z-10">
          <PlayerLabel player={player} />
        </div>
        {player.cardCount > 0 && (
          <VerticalFan count={player.cardCount} side={side} />
        )}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <PlayerIcon player={player} />
        </div>
      </div>
    </div>
  );
}

/** 向かい（上部）に表示する対戦相手 */
export function TopOpponents({ players }: OpponentBarProps) {
  const n = players.length;
  if (n <= 2) return null;

  if (n === 3) {
    return (
      <div className="flex justify-center py-1 z-10 shrink-0">
        <TopAvatar player={players[1]} />
      </div>
    );
  }

  if (n === 4) {
    // 5人プレイ: 上部2人を均等配置（重ならないように）
    return (
      <div className="flex justify-evenly py-1 z-10 shrink-0 px-4">
        <TopAvatar player={players[1]} />
        <TopAvatar player={players[2]} />
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-10 py-1 z-10 shrink-0">
      <TopAvatar player={players[1]} />
      <TopAvatar player={players[2]} />
    </div>
  );
}

/** 左右に表示する対戦相手 */
export function SideOpponents({ players }: OpponentBarProps) {
  const n = players.length;
  const left = players[0];
  const right = n <= 2 ? players[1] : n === 3 ? players[2] : players[3];

  return (
    <>
      {left && (
        <div className="absolute left-4 top-1/2 sm:top-[65%] -translate-y-1/2 z-10">
          <SideAvatar player={left} side="left" />
        </div>
      )}
      {right && (
        <div className="absolute right-4 top-1/2 sm:top-[65%] -translate-y-1/2 z-10">
          <SideAvatar player={right} side="right" />
        </div>
      )}
    </>
  );
}

export default function OpponentBar({ players }: OpponentBarProps) {
  return <TopOpponents players={players} />;
}
