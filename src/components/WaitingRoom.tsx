"use client";

import { useState } from "react";
import Image from "next/image";
import type { RoomInfo } from "../../shared/events";
import type { ChatMessage } from "@/lib/types";
import type { VoiceUser } from "@/lib/webrtc";
import { ChatPanel } from "./GameUI";
import VoicePanel from "./VoicePanel";
import { ScoringRulesModal, GameRulesModal } from "./Scoreboard";

interface WaitingRoomProps {
  roomInfo: RoomInfo;
  myId: string;
  onStartGame: () => void;
  onLeave: () => void;
  onAddCpu?: () => void;
  onRemoveCpu?: (cpuId: string) => void;
  messages: ChatMessage[];
  onSendChat: (text: string) => void;
  onVoiceStamp: (stampId: string) => void;
  inVoice: boolean;
  voiceUsers: VoiceUser[];
  micEnabled: boolean;
  speakerEnabled: boolean;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
}

export default function WaitingRoom({
  roomInfo, myId, onStartGame, onLeave, onAddCpu, onRemoveCpu, messages, onSendChat, onVoiceStamp,
  inVoice, voiceUsers, micEnabled, speakerEnabled,
  onJoinVoice, onLeaveVoice, onToggleMic, onToggleSpeaker,
}: WaitingRoomProps) {
  const me = roomInfo.players.find((p) => p.id === myId);
  const isHost = me?.isHost ?? false;
  const canStart = isHost && roomInfo.players.length >= 3;
  const [chatOpen, setChatOpen] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="max-w-[430px] mx-auto min-h-dvh bg-[#0f1e14] text-gray-300
      font-sans flex flex-col px-6 pt-12 relative">

      {/* ヘッダー */}
      <div className="text-center mb-8">
        <p className="text-xs text-[#6a7a64] font-semibold mb-1">ROOM</p>
        <div className="text-4xl font-black text-[#d4c5a0] tracking-[0.3em]">
          {roomInfo.roomId}
        </div>
        <p className="text-xs text-[#4a6a4e] mt-2">
          このIDを友達に共有してください
        </p>
      </div>

      {/* プレイヤー一覧 */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#6a7a64]">プレイヤー</h2>
          <span className="text-xs text-[#4a6a4e]">
            {roomInfo.players.length} / {roomInfo.maxPlayers}
          </span>
        </div>

        <div className="space-y-2">
          {roomInfo.players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border
                ${player.id === myId
                  ? "bg-[#1a2e1e] border-[#d4c5a0]/30"
                  : "bg-[#0a150e] border-[#1a2e1e]"
                }`}
            >
              {/* アバター */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                overflow-hidden relative
                ${player.id === myId
                  ? "bg-[#d4c5a0]/20 text-[#d4c5a0]"
                  : "bg-[#2a4a30] text-[#6a7a64]"
                }`}>
                {player.avatar ? (
                  <Image
                    src={`/icon/${player.avatar}`}
                    alt={player.name}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  player.name.charAt(0)
                )}
              </div>

              {/* 名前 */}
              <span className={`flex-1 font-semibold text-sm
                ${player.id === myId ? "text-[#d4c5a0]" : "text-gray-300"}`}>
                {player.name}
                {player.id === myId && (
                  <span className="text-[10px] text-[#6a7a64] ml-1.5">YOU</span>
                )}
              </span>

              {/* ホストバッジ */}
              {player.isHost && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold
                  bg-yellow-400/10 text-yellow-400 border border-yellow-400/25">
                  HOST
                </span>
              )}

              {/* CPUバッジ */}
              {player.isCpu && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold
                  bg-blue-400/10 text-blue-400 border border-blue-400/25">
                  CPU
                </span>
              )}

              {/* CPU削除ボタン（ホストのみ） */}
              {player.isCpu && isHost && (
                <button
                  onClick={() => onRemoveCpu?.(player.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center
                    text-red-400/60 hover:text-red-400 hover:bg-red-400/10
                    transition-colors text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* 空きスロット */}
          {Array.from({ length: roomInfo.maxPlayers - roomInfo.players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border
                border-dashed border-[#1a2e1e] opacity-40"
            >
              <div className="w-9 h-9 rounded-full bg-[#1a2e1e] flex items-center justify-center">
                <span className="text-[#3a5a3e] text-lg">?</span>
              </div>
              <span className="text-sm text-[#3a5a3e]">待機中...</span>
            </div>
          ))}

          {/* CPU追加ボタン（ホストのみ、空きがある場合） */}
          {isHost && roomInfo.players.length < roomInfo.maxPlayers && (
            <button
              onClick={onAddCpu}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border
                border-dashed border-blue-400/30 text-blue-400/70 hover:text-blue-400
                hover:border-blue-400/50 hover:bg-blue-400/5 transition-colors text-sm"
            >
              <span className="text-lg">+</span>
              CPU追加
            </button>
          )}
        </div>

        {/* ルールボタン */}
        <div className="mt-4 flex items-center gap-5">
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 text-[#6a7a64] hover:text-white/80 transition-colors text-sm"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full border border-[#6a7a64] font-bold">?</span>
            Rules
          </button>
          <button
            onClick={() => setShowScoring(true)}
            className="flex items-center gap-1.5 text-[#6a7a64] hover:text-white/80 transition-colors text-sm"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full border border-[#6a7a64] font-bold">?</span>
            Score
          </button>
        </div>
        {showRules && <GameRulesModal onClose={() => setShowRules(false)} />}
        {showScoring && <ScoringRulesModal onClose={() => setShowScoring(false)} />}

        {/* ボイスチャット */}
        <VoicePanel
          inVoice={inVoice}
          voiceUsers={voiceUsers}
          micEnabled={micEnabled}
          speakerEnabled={speakerEnabled}
          onJoinVoice={onJoinVoice}
          onLeaveVoice={onLeaveVoice}
          onToggleMic={onToggleMic}
          onToggleSpeaker={onToggleSpeaker}
        />
      </div>

      {/* アクションボタン */}
      <div className="py-6 space-y-3">
        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className="w-full py-3.5 rounded-xl font-bold text-base
              bg-[#d4c5a0] text-[#0f1e14]
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-[#e0d4b0] active:bg-[#c4b590]
              transition-colors"
          >
            {canStart
              ? "ゲーム開始"
              : `あと${3 - roomInfo.players.length}人で開始可能`}
          </button>
        ) : (
          <div className="w-full py-3.5 rounded-xl text-center text-sm text-[#6a7a64]
            bg-[#1a2e1e] border border-[#2a4a30]">
            ホストの開始を待っています...
          </div>
        )}
        <button
          onClick={onLeave}
          className="w-full py-2.5 text-sm text-[#6a7a64]
            hover:text-red-400 transition-colors"
        >
          退出する
        </button>
      </div>

      {/* チャットトグルボタン */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-4 w-12 h-12 rounded-full border-none text-white text-xl
          cursor-pointer z-[100] shadow-lg flex items-center justify-center transition-colors
          ${chatOpen ? "bg-red-500 hover:bg-red-400" : "bg-blue-500 hover:bg-blue-400"}`}
      >
        {chatOpen ? "✕" : "💬"}
      </button>

      {/* チャットパネル */}
      {chatOpen && (
        <ChatPanel
          messages={messages}
          onSend={onSendChat}
          onVoiceStamp={onVoiceStamp}
          positionClassName="fixed bottom-20 right-4"
        />
      )}
    </div>
  );
}
