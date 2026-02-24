"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, GameCard } from "@/lib/types";
import type { VoiceUser } from "@/lib/webrtc";
import { QUICK_MESSAGES, VOICE_STAMPS } from "@/lib/constants";
import HistoryPanel from "./HistoryPanel";

// ─── Voice Bar ───
interface VoiceBarProps {
  inVoice: boolean;
  micEnabled: boolean;
  speakerEnabled: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  voiceUsers: VoiceUser[];
}

export function VoiceBar({ inVoice, micEnabled, speakerEnabled, onToggleMic, onToggleSpeaker, onJoinVoice, onLeaveVoice, voiceUsers }: VoiceBarProps) {
  if (!inVoice) {
    return (
      <div className="flex justify-center items-center px-3.5 py-1">
        <button
          onClick={onJoinVoice}
          className="rounded-xl px-3 py-0.5 text-[11px] font-semibold border cursor-pointer transition-colors
            bg-emerald-500/10 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20"
        >
          🎤 通話に参加
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center gap-2.5 px-3.5 py-1">
      <button
        onClick={onToggleMic}
        className={`rounded-xl px-2.5 py-0.5 text-[11px] font-semibold border cursor-pointer transition-colors
          ${micEnabled
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20"
            : "bg-red-500/10 text-red-500 border-red-500/25 hover:bg-red-500/20"
          }`}
      >
        {micEnabled ? "🎤 ON" : "🎤 OFF"}
      </button>
      <button
        onClick={onToggleSpeaker}
        className={`rounded-xl px-2.5 py-0.5 text-[11px] font-semibold border cursor-pointer transition-colors
          ${speakerEnabled
            ? "bg-blue-500/10 text-blue-500 border-blue-500/25 hover:bg-blue-500/20"
            : "bg-gray-400/10 text-gray-400 border-gray-400/25 hover:bg-gray-400/20"
          }`}
      >
        {speakerEnabled ? "🔊 ON" : "🔇 OFF"}
      </button>
      <button
        onClick={onLeaveVoice}
        className="rounded-xl px-2.5 py-0.5 text-[11px] font-semibold border cursor-pointer transition-colors
          bg-red-500/10 text-red-500 border-red-500/25 hover:bg-red-500/20"
      >
        退出
      </button>
      {voiceUsers.length > 0 && (
        <span className="text-[10px] text-emerald-500 font-semibold self-center">
          {voiceUsers.length}人通話中
        </span>
      )}
    </div>
  );
}

// ─── Action Buttons ───
interface ActionButtonsProps {
  canPlay: boolean;
  canPass: boolean;
  onPlay: () => void;
  onPass: () => void;
  history?: GameCard[];
  handCount?: number;
  selectedCount?: number;
  chatOpen?: boolean;
  onChatToggle?: () => void;
}

export function ActionButtons({ canPlay, canPass, onPlay, onPass, history, handCount = 0, selectedCount = 0, chatOpen, onChatToggle }: ActionButtonsProps) {
  return (
    <div className="relative px-3.5 py-1.5">
      <div className="flex gap-2 justify-center">
        <button
          onClick={onPlay}
          disabled={!canPlay}
          className={`rounded-lg px-8 py-2.5 text-sm font-black border-none transition-all
            ${canPlay
              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white cursor-pointer hover:from-amber-300 hover:to-orange-400 shadow-lg"
              : "bg-white/[0.03] text-gray-600 cursor-default"
            }`}
        >
          出す
        </button>
        <button
          onClick={onPass}
          disabled={!canPass}
          className={`rounded-lg px-6 py-2.5 text-sm font-semibold border border-white/5 transition-all
            ${canPass
              ? "bg-white/5 text-white cursor-pointer hover:bg-white/10"
              : "bg-white/[0.02] text-gray-700 cursor-default"
            }`}
        >
          パス
        </button>
      </div>
      {onChatToggle && (
        <button
          onClick={onChatToggle}
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border-none text-white text-base
            cursor-pointer z-[100] shadow-lg flex items-center justify-center transition-colors
            ${chatOpen ? "bg-red-500 hover:bg-red-400" : "bg-blue-500 hover:bg-blue-400"}`}
        >
          {chatOpen ? "✕" : "💬"}
        </button>
      )}
      {history && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          <HistoryPanel history={history} handCount={handCount} selectedCount={selectedCount} />
        </div>
      )}
    </div>
  );
}

// ─── Game Info Bar ───
interface GameInfoProps {
  rank: string;
  round: number;
  revolution: boolean;
  elevenBack: boolean;
  nakiCount: number;
}

export function GameInfoBar({ rank, round, revolution, elevenBack }: GameInfoProps) {
  const items = [
    { label: "階級", value: rank, color: "text-white" },
    { label: "ラウンド", value: String(round), color: "text-white" },
    { label: "革命", value: revolution ? "発動中" : "なし", color: revolution ? "text-red-400" : "text-white/50" },
    { label: "11バック", value: elevenBack ? "発動中" : "なし", color: elevenBack ? "text-purple-400" : "text-white/50" },
  ];

  return (
    <div className="flex justify-around px-3.5 py-1 pb-1.5 sm:py-1 sm:pb-1 transition-colors duration-500"
      style={{ backgroundColor: "var(--bg-darker, #1a5a2e)", borderTop: "1px solid var(--border-dark, #145228)" }}>
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="text-white/60 text-xs font-semibold">{item.label}</div>
          <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Chat Panel ───
interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onVoiceStamp?: (stampId: string) => void;
  positionClassName?: string;
}

export function ChatToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-20 right-3 w-11 h-11 rounded-full border-none text-white text-xl
        cursor-pointer z-[100] shadow-lg flex items-center justify-center transition-colors
        ${open ? "bg-red-500 hover:bg-red-400" : "bg-blue-500 hover:bg-blue-400"}`}
    >
      {open ? "✕" : "💬"}
    </button>
  );
}

export function ChatPanel({ messages, onSend, onVoiceStamp, positionClassName }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className={`${positionClassName ?? "fixed bottom-[130px] right-3"} w-[340px] bg-[#0a150ef8] rounded-xl border border-[#1a2e1e]
      z-[100] flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.6)] overflow-hidden`}>
      <div className="px-4 py-2 border-b border-[#1a2e1e] text-sm font-bold text-[#d4c5a0]">
        チャット
      </div>
      <div className="flex gap-1.5 px-3 py-1.5 flex-wrap border-b border-[#1a2e1e]/20">
        {QUICK_MESSAGES.map((q) => (
          <button
            key={q}
            onClick={() => setInput(q)}
            className={`border rounded-lg px-2 py-1
              text-xs cursor-pointer transition-colors
              ${input === q
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/[0.03] border-white/5 text-[#8a9a84] hover:bg-white/10"
              }`}
          >
            {q}
          </button>
        ))}
      </div>
      {onVoiceStamp && (
        <div className="flex gap-1.5 px-3 py-1.5 flex-wrap border-b border-[#1a2e1e]/20">
          {VOICE_STAMPS.map((vs) => (
            <button
              key={vs.id}
              onClick={() => onVoiceStamp(vs.id)}
              className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1
                text-xs text-purple-300 cursor-pointer transition-colors hover:bg-purple-500/20"
            >
              🔊 {vs.label}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[220px] overflow-y-auto px-3 py-2">
        {messages.map((m, i) => (
          <div key={i} className="mb-1.5">
            <span className={`text-xs font-bold ${m.from === "あなた" ? "text-amber-400" : "text-blue-400"}`}>
              {m.from}
            </span>
            <div className="text-[#bbb] text-sm mt-0.5">{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-1.5 px-3 py-2 border-t border-[#1a2e1e]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="メッセージ..."
          className="flex-1 bg-white/[0.03] border border-white/5 rounded-md px-3 py-1.5
            text-[#ccc] text-sm outline-none placeholder:text-gray-600"
        />
        <button
          onClick={handleSend}
          className="bg-blue-500/20 border border-blue-500/35 rounded-md px-3 py-1.5
            text-blue-400 text-sm font-bold cursor-pointer hover:bg-blue-500/30 transition-colors"
        >
          送信
        </button>
      </div>
    </div>
  );
}
