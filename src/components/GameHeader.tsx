"use client";

import { useState } from "react";
import type { VoiceUser } from "@/lib/webrtc";

interface GameHeaderProps {
  isMyTurn: boolean;
  currentTurnName: string;
  inVoice: boolean;
  micEnabled: boolean;
  speakerEnabled: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  voiceUsers: VoiceUser[];
}

function GameRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#1a2e1a] border border-white/20 rounded-lg p-4 mx-4 max-w-md w-full max-h-[80vh] overflow-y-auto text-white text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-base">ゲームルール</h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        <section className="mb-3">
          <h4 className="font-semibold mb-1 text-amber-400 text-xs">カードの強さ</h4>
          <p className="text-xs text-white/80 leading-relaxed">
            3 &lt; 4 &lt; ... &lt; A &lt; 2 &lt; Joker<br />
            Jokerは♠3でのみ切れる
          </p>
        </section>

        <section className="mb-3">
          <h4 className="font-semibold mb-1 text-amber-400 text-xs">出し方</h4>
          <ul className="text-xs text-white/80 space-y-0.5 list-disc pl-3">
            <li>単体 / ペア / トリプル / 4枚組 / 連番（同スート3枚以上）</li>
            <li>場と同じ枚数・タイプで、より強いカードを出す</li>
            <li>パスすると場が流れるまで出せない</li>
          </ul>
        </section>

        <section className="mb-3">
          <h4 className="font-semibold mb-1 text-amber-400 text-xs">鳴き（インターセプト）</h4>
          <ul className="text-xs text-white/80 space-y-0.5 list-disc pl-3">
            <li>単体出し時のみ発動可能</li>
            <li>対象ランク: 6〜Q</li>
            <li>同スートの前後カードを両方持っていれば鳴ける</li>
            <li>3枚セットが捨てられ、場が流れて自分のターンに</li>
          </ul>
        </section>

        <section className="mb-3">
          <h4 className="font-semibold mb-1 text-amber-400 text-xs">特殊ルール</h4>
          <ul className="text-xs text-white/80 space-y-0.5 list-disc pl-3">
            <li><span className="text-white font-semibold">革命</span>: 同ランク4枚 or 同スート連番4枚以上で強さ逆転</li>
            <li><span className="text-white font-semibold">8切り</span>: 8を含むカードで場が即流れる</li>
            <li><span className="text-white font-semibold">イレブンバック</span>: Jを含むカードで場が流れるまで強さ一時逆転</li>
            <li><span className="text-white font-semibold">都落ち</span>: 前ラウンドの大富豪が1位以外で大貧民に降格</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold mb-1 text-amber-400 text-xs">階級とカード交換</h4>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                <th className="text-left py-0.5">階級</th>
                <th className="text-center py-0.5">交換</th>
                <th className="text-left py-0.5">内容</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <tr className="border-b border-white/5">
                <td className="py-0.5">大富豪</td>
                <td className="text-center">2枚</td>
                <td>最強2枚を受取り / 不要2枚を渡す</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-0.5">富豪</td>
                <td className="text-center">1枚</td>
                <td>最強1枚を受取り / 不要1枚を渡す</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-0.5">平民</td>
                <td className="text-center">-</td>
                <td>交換なし</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-0.5">貧民</td>
                <td className="text-center">1枚</td>
                <td>最強1枚を渡す / 不要1枚を受取り</td>
              </tr>
              <tr>
                <td className="py-0.5">大貧民</td>
                <td className="text-center">2枚</td>
                <td>最強2枚を渡す / 不要2枚を受取り</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default function GameHeader({
  isMyTurn, currentTurnName,
  inVoice, micEnabled, speakerEnabled,
  onToggleMic, onToggleSpeaker, onJoinVoice, onLeaveVoice, voiceUsers,
}: GameHeaderProps) {
  const [showRules, setShowRules] = useState(false);

  return (
    <>
      <div className="flex items-center px-3.5 py-2 gap-2 transition-colors duration-500"
        style={{ backgroundColor: "var(--bg-mid, #256b35)", borderBottom: "1px solid var(--bg-darker, #1a5a2e)" }}>
        <span className="text-xs sm:text-xl font-bold text-white/90 tracking-wider">OREHANIGEKIRU</span>
        <button
          onClick={() => setShowRules(true)}
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full border border-white/30 text-white/50 hover:text-white hover:border-white/60 -ml-1"
          title="ゲームルール"
        >
          ?
        </button>

        <div className="flex gap-1.5 mx-auto items-center">
          {inVoice ? (
            <>
              <button
                onClick={onToggleMic}
                className={`rounded-xl px-2 py-0.5 text-[10px] font-semibold border cursor-pointer transition-colors
                  ${micEnabled
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                    : "bg-red-500/10 text-red-500 border-red-500/25"
                  }`}
              >
                {micEnabled ? "🎤 ON" : "🎤 OFF"}
              </button>
              <button
                onClick={onToggleSpeaker}
                className={`rounded-xl px-2 py-0.5 text-[10px] font-semibold border cursor-pointer transition-colors
                  ${speakerEnabled
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/25"
                    : "bg-gray-400/10 text-gray-400 border-gray-400/25"
                  }`}
              >
                {speakerEnabled ? "🔊 ON" : "🔇 OFF"}
              </button>
              <button
                onClick={onLeaveVoice}
                className="rounded-xl px-2 py-0.5 text-[10px] font-semibold border cursor-pointer transition-colors
                  bg-red-500/10 text-red-500 border-red-500/25 hover:bg-red-500/20"
              >
                退出
              </button>
              {voiceUsers.length > 0 && (
                <span className="text-[9px] text-emerald-500 font-semibold">
                  {voiceUsers.length}人通話中
                </span>
              )}
            </>
          ) : (
            <button
              onClick={onJoinVoice}
              className="rounded-xl px-3 py-1 text-sm font-semibold border cursor-pointer transition-colors
                bg-emerald-500/10 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20"
            >
              🎤 通話に参加
            </button>
          )}
        </div>

        <div className={`px-3 py-1 rounded-xl text-sm font-bold border
          ${isMyTurn
            ? "bg-yellow-400/20 text-yellow-300 border-yellow-400/40"
            : "bg-white/10 text-white/80 border-white/20"
          }`}>
          {isMyTurn ? "YOUR TURN" : `${currentTurnName}のターン`}
        </div>
      </div>
      {showRules && <GameRulesModal onClose={() => setShowRules(false)} />}
    </>
  );
}
