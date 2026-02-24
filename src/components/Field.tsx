"use client";

import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface FieldProps {
  cards: GameCard[];
  stack?: GameCard[][];
}

/** カードIDから決定的なハッシュ値を生成（全クライアントで同じ結果） */
function hashIds(ids: string): number {
  let h = 0;
  for (let i = 0; i < ids.length; i++) {
    h = ((h << 5) - h + ids.charCodeAt(i)) | 0;
  }
  return h;
}

/** ハッシュから 0〜1 の値を返す */
function hashToFloat(h: number, salt: number): number {
  const v = Math.sin(h * 9301 + salt * 49297) * 49979;
  return v - Math.floor(v);
}

/** カード群を描画（複数枚は左下を原点に扇形に広げる） */
function CardGroup({ cards, size = "md" }: { cards: GameCard[]; size?: "md" | "lg" | "xl" }) {
  const count = cards.length;

  if (count <= 1) {
    return (
      <div>
        {cards.map((c) => <PlayingCard key={c.id} card={c} size={size} />)}
      </div>
    );
  }

  const spread = 5;
  // 扇形の視覚的中心を場の中央に合わせるため、枚数に応じて右にオフセット
  const offsetX = (count - 1) * 10;

  return (
    <div className="relative"
      style={{
        width: size === "xl" ? 84 : size === "lg" ? 60 : 48,
        height: size === "xl" ? 118 : size === "lg" ? 84 : 67,
        transform: count > 1 ? `translateX(${offsetX}px)` : undefined,
      }}
    >
      {cards.map((c, i) => (
        <div
          key={c.id}
          className="absolute left-0 bottom-0"
          style={{
            transformOrigin: "0% 250%",
            transform: `rotate(${(i - count + 1) * spread}deg)`,
            zIndex: i,
          }}
        >
          <PlayingCard card={c} size={size} />
        </div>
      ))}
    </div>
  );
}

/** カードIDから決定的なオフセットを計算 */
function getOffset(cards: GameCard[]) {
  const ids = cards.map(c => c.id).join(",");
  const h = hashIds(ids);
  return {
    x: Math.round((hashToFloat(h, 1) - 0.5) * 20),    // -10〜+10px
    y: Math.round((hashToFloat(h, 2) - 0.5) * 16),     // -8〜+8px
    rotate: Math.round((hashToFloat(h, 3) - 0.5) * 10), // -5〜+5deg
  };
}

/** 場のカード表示（スタック + 現在のカード） */
function FieldPile({ cards, stack, size }: { cards: GameCard[]; stack: GameCard[][]; size: "md" | "lg" | "xl" }) {
  const lastIndex = stack.length - 1;
  return (
    <div className="relative">
      {/* 過去のカードをスタック表示 */}
      {stack.map((layer, i) => {
        const { x, y, rotate } = getOffset(layer);
        const isLast = i === lastIndex;
        return (
          <div key={i} className="absolute left-0 top-0"
            style={{
              // 直前のカードは上に12pxずらして数字を見せる
              transform: `translate(${x}px, ${isLast ? -12 + y : y}px) rotate(${rotate}deg)`,
              zIndex: i,
            }}
          >
            <CardGroup cards={layer} size={size} />
          </div>
        );
      })}
      {/* 現在のカード（最前面） */}
      <div className="relative" style={{ zIndex: stack.length }}>
        <CardGroup cards={cards} size={size} />
      </div>
    </div>
  );
}

export default function Field({ cards, stack = [] }: FieldProps) {
  const hasCurrent = cards.length > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80px] relative mt-4 sm:mt-10">
      {/* Green felt effect */}
      <div className="absolute inset-4 rounded-[60px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(34,85,51,0.15), transparent 70%)" }}
      />
      <div className="relative z-[1] min-h-[68px] flex items-center justify-center">
        {hasCurrent ? (
          <>
            <div className="sm:hidden">
              <FieldPile cards={cards} stack={stack} size="xl" />
            </div>
            <div className="hidden sm:block">
              <FieldPile cards={cards} stack={stack} size="lg" />
            </div>
          </>
        ) : (
          <div className="text-white/10 text-sm font-semibold px-8 py-5 rounded-xl border border-dashed border-white/5">
            場にカードなし
          </div>
        )}
      </div>
    </div>
  );
}
