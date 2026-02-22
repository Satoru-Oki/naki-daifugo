"use client";

import type { VoiceUser } from "@/lib/webrtc";

interface VoicePanelProps {
  inVoice: boolean;
  voiceUsers: VoiceUser[];
  micEnabled: boolean;
  speakerEnabled: boolean;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
}

export default function VoicePanel({
  inVoice,
  voiceUsers,
  micEnabled,
  speakerEnabled,
  onJoinVoice,
  onLeaveVoice,
  onToggleMic,
  onToggleSpeaker,
}: VoicePanelProps) {
  if (!inVoice) {
    return (
      <div className="mt-6">
        <h2 className="text-sm font-bold text-[#6a7a64] mb-2">ボイスチャット</h2>
        <button
          onClick={onJoinVoice}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-center
            bg-emerald-500/20 text-emerald-300 border border-emerald-500/30
            hover:bg-emerald-500/30 transition-colors"
        >
          通話に参加
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold text-[#6a7a64] mb-2">ボイスチャット</h2>

      {/* コントロール */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={onToggleMic}
          className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-colors
            ${micEnabled
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
              : "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
            }`}
        >
          {micEnabled ? "🎤 ON" : "🎤 OFF"}
        </button>
        <button
          onClick={onToggleSpeaker}
          className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-colors
            ${speakerEnabled
              ? "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
              : "bg-gray-400/20 text-gray-400 border-gray-400/30 hover:bg-gray-400/30"
            }`}
        >
          {speakerEnabled ? "🔊 ON" : "🔇 OFF"}
        </button>
        <button
          onClick={onLeaveVoice}
          className="px-3 py-2 rounded-xl text-sm font-bold
            bg-red-500/20 text-red-300 border border-red-500/30
            hover:bg-red-500/30 transition-colors"
        >
          退出
        </button>
      </div>

      {/* 参加者一覧 */}
      {voiceUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {voiceUsers.map((u) => (
            <span
              key={u.id}
              className="px-2 py-0.5 rounded-full text-xs font-semibold
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              {u.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
