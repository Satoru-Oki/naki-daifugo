"use client";

import { useRef, useState, useEffect } from "react";
import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface HandProps {
  cards: GameCard[];
  selectedIds: Set<string>;
  onTapCard: (id: string) => void;
  enabled: boolean;
  dealing?: boolean;
}

/** カード幅: コンテナ幅の20%を基準に 70〜90px にクランプ */
function calcCardWidth(containerWidth: number): number {
  return Math.round(Math.min(90, Math.max(70, (containerWidth - 16) * 0.2)));
}

export default function Hand({ cards, selectedIds, onTapCard, enabled, dealing = false }: HandProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(375);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      } else {
        setContainerWidth(Math.min(window.innerWidth, 640));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const N = cards.length;
  const cardWidth = calcCardWidth(containerWidth);
  const cardHeight = Math.round(cardWidth * 1.4);

  // 水平オフセット: オーバーラップ幅は最大30pxに制限し、中央にコンパクト表示
  // 左端のカードが回転で見切れないよう右寄せ補正
  const leftPad = 12;
  const available = containerWidth - 8 - leftPad; // px-1(8px) + 左余白
  const maxOverlap = 30;
  const visibleWidth =
    N <= 1 ? 0 : Math.min(maxOverlap, Math.max(14, Math.floor((available - cardWidth) / (N - 1))));

  // 扇の総幅（中央配置用）
  const totalFanWidth = N <= 1 ? cardWidth : cardWidth + visibleWidth * (N - 1);

  // 回転角度
  const spread = Math.min(30, (N - 1) * 3);

  // コンテナ高さ: カード高さ + 弧の高さ + 選択時の浮き分
  const arcMax = 12;
  const selectLift = 15;
  const fanHeight = cardHeight + arcMax + selectLift;

  return (
    <div className="px-1 transition-colors duration-500" style={{ backgroundColor: "var(--bg-mid, #256b35)" }}>
      {dealing && (
        <style>{`
          @keyframes dealFanIn {
            from { opacity: 0; transform: translateY(-30px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      )}
      <div
        ref={containerRef}
        className="relative mx-auto"
        style={{ height: fanHeight, maxWidth: 640 }}
      >
        {cards.map((card, i) => {
          const isSelected = selectedIds.has(card.id);

          // 水平位置: 左余白分だけ右にオフセット
          const offsetX = leftPad + (available - totalFanWidth) / 2;
          const left = offsetX + i * visibleWidth;

          // 回転: -spread/2 〜 +spread/2 に均等分布
          const angle =
            N <= 1 ? 0 : -spread / 2 + (spread / (N - 1)) * i;

          // 弧: 放物線で中央が高く、両端が下がる（∩ ドーム型）
          const t = N <= 1 ? 0 : (2 * i) / (N - 1) - 1; // -1 〜 +1
          const yOffset = arcMax * t * t;

          // top: selectLift分を余白として確保 + 弧のオフセット
          const top = selectLift + yOffset;

          return (
            <div
              key={card.id}
              style={{
                position: "absolute",
                left,
                top,
                width: cardWidth,
                height: cardHeight,
                transform: `rotate(${angle}deg)${isSelected ? " translateY(-15px)" : ""}`,
                transformOrigin: "center bottom",
                zIndex: isSelected ? 50 : i,
                transition: "transform 0.15s ease",
              }}
            >
              <div
                style={
                  dealing
                    ? {
                        opacity: 0,
                        animation: "dealFanIn 200ms ease-out forwards",
                        animationDelay: `${i * 60}ms`,
                      }
                    : undefined
                }
              >
                <PlayingCard
                  card={card}
                  widthPx={cardWidth}
                  heightPx={cardHeight}
                  selected={isSelected}
                />
              </div>
            </div>
          );
        })}
        {/* 透明クリックターゲット: 各カードの見える帯幅で配置し、視覚z-indexに影響されずタップ可能にする */}
        {enabled && cards.map((card, i) => {
          const offsetX = leftPad + (available - totalFanWidth) / 2;
          const left = offsetX + i * visibleWidth;
          const hitWidth = i === N - 1 ? cardWidth : visibleWidth;

          return (
            <div
              key={`hit-${card.id}`}
              onClick={() => onTapCard(card.id)}
              style={{
                position: "absolute",
                left,
                top: 0,
                width: hitWidth,
                height: fanHeight,
                zIndex: 100,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
      {selectedIds.size > 0 && (
        <div className="text-center text-xs text-white/50 leading-tight">
          {selectedIds.size}枚選択中
        </div>
      )}
    </div>
  );
}
