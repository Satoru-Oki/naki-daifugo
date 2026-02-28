"use client";

import * as deck from "@letele/playing-cards";
import type { GameCard } from "@/lib/types";
import { isJoker } from "@/lib/gameLogic";
import type { ComponentType, SVGProps } from "react";

// Build lookup map for card components
const cardComponents = deck as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

import Image from "next/image";

interface PlayingCardProps {
  card: GameCard;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** JS算出のピクセル幅（指定時は cqi ではなくこの値を使用） */
  widthPx?: number;
  /** JS算出のピクセル高（指定時は cqi ではなくこの値を使用） */
  heightPx?: number;
  selected?: boolean;
  glowing?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  className?: string;
}

// デザイン基準幅430px。コンテナ幅に連動してスマホ縮小 / PC拡大
const DESIGN_WIDTH = 430;
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.5;

function responsivePx(px: number): string {
  const cqi = ((px / DESIGN_WIDTH) * 100).toFixed(1);
  const min = Math.round(px * MIN_SCALE);
  const max = Math.round(px * MAX_SCALE);
  return `clamp(${min}px, ${cqi}cqi, ${max}px)`;
}

const BASE = {
  sm: { width: 32, height: 45 },
  md: { width: 48, height: 67 },
  lg: { width: 60, height: 84 },
  xl: { width: 84, height: 118 },
  "2xl": { width: 120, height: 168 },
};

const SIZES = Object.fromEntries(
  (Object.keys(BASE) as (keyof typeof BASE)[]).map((k) => [
    k,
    { width: responsivePx(BASE[k].width), height: responsivePx(BASE[k].height) },
  ])
) as Record<keyof typeof BASE, { width: string; height: string }>;

function getComponentKey(card: GameCard): string {
  if (isJoker(card)) {
    return card.id === "JOKER-1" ? "J1" : "J2";
  }
  // Export names: S7, H10, Ca (ace lowercase), Cj, Cq, Ck
  const rankMap: Record<string, string> = { A: "a", J: "j", Q: "q", K: "k" };
  const r = rankMap[card.rank] || card.rank;
  return `${card.suit}${r}`;
}

export default function PlayingCard({
  card,
  size = "md",
  widthPx,
  heightPx,
  selected = false,
  glowing = false,
  faceDown = false,
  onClick,
  className = "",
}: PlayingCardProps) {
  const responsive = SIZES[size];
  const width = widthPx != null ? widthPx : responsive.width;
  const height = heightPx != null ? heightPx : responsive.height;
  const isFaceDown = faceDown;
  const isJokerCard = !isFaceDown && isJoker(card);
  const key = isFaceDown ? "B1" : getComponentKey(card);
  const CardSvg = cardComponents[key];

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-md overflow-hidden flex-shrink-0 transition-transform duration-150
        ${onClick ? "cursor-pointer" : ""}
        ${selected ? "-translate-y-2 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(243,156,18,0.5)]" : "shadow-md"}
        ${glowing ? "ring-2 ring-red-500 shadow-[0_0_8px_rgba(231,76,60,0.4)]" : ""}
        ${className}
      `}
      style={{ width, height }}
    >
      {isJokerCard ? (
        <Image
          src={card.id === "JOKER-1" ? "/joker/JOKER1.jpg" : "/joker/JOKER2.jpg"}
          alt="JOKER"
          fill
          className="object-cover"
        />
      ) : CardSvg ? (
        <CardSvg
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
          {key}
        </div>
      )}
    </div>
  );
}
