"use client";

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

/** 派手な全画面アナウンス（鳴き・革命・都落ち・8切り用） */
export function BigAnnouncement({ message, type, cards }: { message: string; type: "naki" | "revolution" | "miyakoOchi" | "eightCut"; cards?: GameCard[] }) {
  if (!message) return null;

  const colors = type === "revolution"
    ? "from-red-600/90 to-orange-600/90 border-red-400"
    : type === "miyakoOchi"
    ? "from-purple-800/90 to-gray-900/90 border-purple-500"
    : type === "eightCut"
    ? "from-emerald-700/90 to-teal-900/90 border-emerald-400"
    : "from-blue-600/90 to-purple-600/90 border-blue-400";

  const textColor = type === "revolution"
    ? "text-yellow-300"
    : type === "miyakoOchi"
    ? "text-purple-200"
    : type === "eightCut"
    ? "text-emerald-200"
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
        {type === "eightCut" && cards && cards.length > 0 && (
          <div className="flex gap-1.5 items-center">
            {cards.map((c) => (
              <PlayingCard key={c.id} card={c} size="md" />
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes announceIn {
          0% { opacity: 0; transform: scale(0.5); }
          60% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
