"use client";

import Image from "next/image";
import type { GameCard } from "@/lib/types";
import PlayingCard from "./PlayingCard";

interface NotificationProps {
  message: string;
}

export default function Notification({ message }: NotificationProps) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]
      bg-gray-900 text-yellow-400 px-5 py-2 rounded-full text-sm font-bold
      border border-yellow-400/30 whitespace-nowrap shadow-lg">
      {message}
    </div>
  );
}

/** JOKER1のカードデータ（大富豪演出用） */
const JOKER_CARD: GameCard = { id: "JOKER-1", suit: "JOKER", rank: "JOKER" };

/** プレイヤーアイコン + 名前の表示 */
function PlayerBadge({ name, avatar }: { name: string; avatar?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0 relative bg-slate-700 flex items-center justify-center text-white text-sm font-bold">
        {avatar ? (
          <Image src={`/icon/${avatar}`} alt={name} fill sizes="40px" className="object-cover" />
        ) : (
          name[0]
        )}
      </div>
      <span className="text-white text-lg font-bold drop-shadow-lg">{name}</span>
    </div>
  );
}

/** 派手な全画面アナウンス */
export function BigAnnouncement({ message, type, cards, playerName, playerAvatar }: {
  message: string;
  type: "naki" | "revolution" | "miyakoOchi" | "eightCut" | "daihinmin" | "daifugo" | "gekokujo";
  cards?: GameCard[];
  playerName?: string;
  playerAvatar?: string;
}) {
  if (!message) return null;

  // 下剋上: 赤金グラデーション + テキスト大きめ + JOKER1回転表示
  if (type === "gekokujo") {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
        <div className="bg-gradient-to-r from-red-900/90 to-yellow-800/90 border-2 border-red-400 rounded-2xl px-10 py-6 shadow-2xl animate-[announceIn_0.3s_ease-out] flex flex-col items-center gap-3">
          {playerName && <PlayerBadge name={playerName} avatar={playerAvatar} />}
          <div className="text-4xl font-black text-red-300 drop-shadow-lg">
            下剋上！！
          </div>
          <div className="animate-[daifugoCard_3.5s_ease-in-out_0.3s_both]">
            <PlayingCard card={JOKER_CARD} size="2xl" />
          </div>
        </div>
        <style>{`
          @keyframes daifugoCard {
            0% { opacity: 0; transform: scale(0.3) rotate(-180deg); }
            25% { opacity: 1; transform: scale(1.1) rotate(0deg); }
            35% { transform: scale(1) rotate(0deg); }
            85% { opacity: 1; transform: scale(1) rotate(360deg); }
            100% { opacity: 0; transform: scale(0.8) rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 大富豪: ボックス + テキスト大きめ + JOKER1表示
  if (type === "daifugo") {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
        <div className="bg-gradient-to-r from-yellow-900/90 to-amber-800/90 border-2 border-yellow-400 rounded-2xl px-10 py-6 shadow-2xl animate-[announceIn_0.3s_ease-out] flex flex-col items-center gap-3">
          {playerName && <PlayerBadge name={playerName} avatar={playerAvatar} />}
          <div className="text-4xl font-black text-yellow-300 drop-shadow-lg">
            大富豪
          </div>
          <div className="animate-[daifugoCard_3.5s_ease-in-out_0.3s_both]">
            <PlayingCard card={JOKER_CARD} size="2xl" />
          </div>
        </div>
        <style>{`
          @keyframes daifugoCard {
            0% { opacity: 0; transform: scale(0.3) rotate(-180deg); }
            25% { opacity: 1; transform: scale(1.1) rotate(0deg); }
            35% { transform: scale(1) rotate(0deg); }
            85% { opacity: 1; transform: scale(1) rotate(360deg); }
            100% { opacity: 0; transform: scale(0.8) rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 大貧民: ボックス + テキスト大きめ + 画像フェードイン
  if (type === "daihinmin") {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
        <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 border-2 border-gray-500 rounded-2xl px-10 py-6 shadow-2xl animate-[announceIn_0.3s_ease-out] flex flex-col items-center gap-3">
          {playerName && <PlayerBadge name={playerName} avatar={playerAvatar} />}
          <div className="text-4xl font-black text-gray-200 drop-shadow-lg">
            大貧民
          </div>
          <div className="animate-[daihinminImg_3.5s_ease-in-out_0.3s_both]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/effect/大貧民.jpg"
              alt="大貧民"
              className="w-56 h-auto rounded-lg"
            />
          </div>
        </div>
        <style>{`
          @keyframes daihinminImg {
            0% { opacity: 0; transform: scale(0.5); }
            25% { opacity: 1; transform: scale(1.05); }
            35% { transform: scale(1); }
            85% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // 都落ち: ボックス + テキスト大きめ + 画像フェードイン（大貧民演出と同様）
  if (type === "miyakoOchi") {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
        <div className="bg-gradient-to-r from-purple-900/90 to-gray-900/90 border-2 border-purple-500 rounded-2xl px-10 py-6 shadow-2xl animate-[announceIn_0.3s_ease-out] flex flex-col items-center gap-3">
          {playerName && <PlayerBadge name={playerName} avatar={playerAvatar} />}
          <div className="text-4xl font-black text-purple-200 drop-shadow-lg">
            都落ち
          </div>
          <div className="animate-[daihinminImg_3.5s_ease-in-out_0.3s_both]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/effect/大貧民.jpg"
              alt="都落ち"
              className="w-56 h-auto rounded-lg"
            />
          </div>
        </div>
        <style>{`
          @keyframes daihinminImg {
            0% { opacity: 0; transform: scale(0.5); }
            25% { opacity: 1; transform: scale(1.05); }
            35% { transform: scale(1); }
            85% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // 8切り: テキスト + カード演出（場の中央付近に表示）
  if (type === "eightCut") {
    return (
      <div className="fixed inset-x-0 top-[30%] z-[300] flex flex-col items-center pointer-events-none">
        <div className="animate-[eightCutText_0.4s_ease-out_both] text-5xl font-black text-emerald-300 drop-shadow-[0_0_20px_rgba(16,185,129,0.7)]">
          ✂️ 8切り！
        </div>
        {cards && cards.length > 0 && (
          <div className="flex gap-2 mt-4">
            {cards.map((c, i) => (
              <div
                key={c.id}
                className="animate-[eightCutCard_0.5s_ease-out_both]"
                style={{ animationDelay: `${0.2 + i * 0.08}s` }}
              >
                <PlayingCard card={c} size="lg" />
              </div>
            ))}
          </div>
        )}
        <style>{`
          @keyframes eightCutText {
            0% { opacity: 0; transform: scale(1.8); }
            60% { opacity: 1; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes eightCutCard {
            0% { opacity: 0; transform: translateY(-60px) scale(0.4); }
            70% { opacity: 1; transform: translateY(4px) scale(1.05); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  const colors = type === "revolution"
    ? "from-red-600/90 to-orange-600/90 border-red-400"
    : "from-blue-600/90 to-purple-600/90 border-blue-400";

  const textColor = type === "revolution"
    ? "text-yellow-300"
    : "text-white";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
      <div className={`
        bg-gradient-to-r ${colors} border-2 rounded-2xl px-10 py-5 shadow-2xl
        animate-[announceIn_0.3s_ease-out]
        flex flex-col items-center gap-3
      `}>
        <div className={`text-2xl font-black ${textColor} whitespace-nowrap drop-shadow-lg`}>
          {message}
        </div>
        {type === "naki" && cards && cards.length === 3 && (
          <div className="flex items-center gap-1 relative">
            {/* 左カード（鳴いた人のカード）- 左からスライドイン */}
            <div className="animate-[nakiSlideLeft_0.45s_ease-out_both]">
              <PlayingCard card={cards[0]} size="lg" />
            </div>
            {/* 中央カード（場に出されたカード）- スケールパルス */}
            <div className="animate-[nakiCenter_0.5s_ease-out_both]">
              <PlayingCard card={cards[1]} size="lg" />
            </div>
            {/* 右カード（鳴いた人のカード）- 右からスライドイン */}
            <div className="animate-[nakiSlideRight_0.45s_ease-out_both]">
              <PlayingCard card={cards[2]} size="lg" />
            </div>
            {/* 3枚揃ったタイミングの光エフェクト */}
            <div className="absolute inset-0 animate-[nakiGlow_0.6s_ease-out_0.4s_both] rounded-lg pointer-events-none" />
          </div>
        )}
      </div>
      <style>{`
        @keyframes announceIn {
          0% { opacity: 0; transform: scale(0.5); }
          60% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes nakiSlideLeft {
          0% { opacity: 0; transform: translateX(-80px) scale(0.3); }
          70% { opacity: 1; transform: translateX(4px) scale(1.05); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes nakiSlideRight {
          0% { opacity: 0; transform: translateX(80px) scale(0.3); }
          70% { opacity: 1; transform: translateX(-4px) scale(1.05); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes nakiCenter {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes nakiGlow {
          0% { box-shadow: 0 0 0px rgba(255,255,255,0); }
          50% { box-shadow: 0 0 30px rgba(200,220,255,0.6), 0 0 60px rgba(150,180,255,0.3); }
          100% { box-shadow: 0 0 0px rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
}
