"use client";

import { useState } from "react";
import Image from "next/image";

interface ScoreboardProps {
  scores: { id: string; name: string; score: number; avatar?: string }[];
  myId: string;
}

/** スコア・ルール内容（インライン表示用） */
export function ScoringRulesContent() {
  return (
    <>
      <h4 className="font-semibold mb-1 text-amber-400">ランク基本点</h4>
      <table className="w-full text-xs mb-3 border-collapse">
        <thead>
          <tr className="text-white/50 border-b border-white/10">
            <th className="text-left py-1">階級</th>
            <th className="text-center py-1">5人</th>
            <th className="text-center py-1">4人</th>
            <th className="text-center py-1">3人</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/5">
            <td className="py-1">大富豪</td>
            <td className="text-center">7</td>
            <td className="text-center">5</td>
            <td className="text-center">4</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="py-1">富豪</td>
            <td className="text-center">4</td>
            <td className="text-center">3</td>
            <td className="text-center">-</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="py-1">平民</td>
            <td className="text-center">2</td>
            <td className="text-center">-</td>
            <td className="text-center">2</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="py-1">貧民</td>
            <td className="text-center">1</td>
            <td className="text-center">1</td>
            <td className="text-center">-</td>
          </tr>
          <tr>
            <td className="py-1">大貧民</td>
            <td className="text-center">0</td>
            <td className="text-center">0</td>
            <td className="text-center">0</td>
          </tr>
        </tbody>
      </table>

      <h4 className="font-semibold mb-1 text-amber-400">ボーナス点</h4>
      <ul className="text-xs space-y-2 text-white/80">
        <li>
          <span className="font-semibold text-white">下剋上ボーナス</span>
          <br />
          前ラウンド大貧民 → 大富豪: <span className="text-green-400 font-bold">+10点</span>
          <br />
          前ラウンド大貧民 → 富豪: <span className="text-green-400 font-bold">+7点</span>
        </li>
        <li>
          <span className="font-semibold text-white">ノー強カードボーナス</span>
          <br />
          手札（交換後）にJoker・2が一切なく、大富豪 or 富豪で終了:
          <span className="text-green-400 font-bold"> +3点</span>
        </li>
      </ul>
    </>
  );
}

export function ScoringRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#1a2e1a] border border-white/20 rounded-lg p-4 mx-4 max-w-sm w-full max-h-[80vh] overflow-y-auto text-white text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-base">得点ルール</h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>
        <ScoringRulesContent />
      </div>
    </div>
  );
}

/** ゲームルールモーダル */
export function GameRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#1a2e1a] border border-white/20 rounded-lg p-4 mx-4 max-w-sm w-full max-h-[80vh] overflow-y-auto text-white text-sm"
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

        <h4 className="font-semibold mb-1 text-amber-400">基本</h4>
        <ul className="text-xs space-y-1 text-white/80 mb-3 list-disc pl-4">
          <li>3〜5人、54枚（52枚+ジョーカー2枚）</li>
          <li>手札を全て出し切った順に順位が決定</li>
          <li>初回は♥7持ちが先攻</li>
        </ul>

        <h4 className="font-semibold mb-1 text-amber-400">カードの強さ</h4>
        <p className="text-xs text-white/80 mb-1">3 &lt; 4 &lt; ... &lt; K &lt; A &lt; 2 &lt; Joker</p>
        <p className="text-xs text-white/60 mb-3">革命時は逆順（Jokerは常に最強、♠3で切れる）</p>

        <h4 className="font-semibold mb-1 text-amber-400">出し方</h4>
        <ul className="text-xs space-y-1 text-white/80 mb-3 list-disc pl-4">
          <li>単体 / ペア / トリプル / 4枚組 / 連番（同スート3枚以上）</li>
          <li>場と同枚数でより強いカードを出す</li>
          <li>パスしたら場が流れるまで出せない</li>
          <li>全員パスで場が流れる</li>
        </ul>

        <h4 className="font-semibold mb-1 text-amber-400">特殊ルール</h4>
        <ul className="text-xs space-y-1.5 text-white/80 mb-3 list-disc pl-4">
          <li><span className="text-white font-semibold">8切り:</span> 8を含むカードで場が流れる</li>
          <li><span className="text-white font-semibold">イレブンバック:</span> Jを含むカードで強さ一時逆転</li>
          <li><span className="text-white font-semibold">革命:</span> 同ランク4枚 or 連番4枚以上で強さ逆転</li>
        </ul>

        <h4 className="font-semibold mb-1 text-amber-400">鳴き（インターセプト）</h4>
        <ul className="text-xs space-y-1 text-white/80 mb-3 list-disc pl-4">
          <li>単体出し時のみ、対象ランク 6〜Q</li>
          <li>同スートの前後カードを持っていれば鳴ける</li>
          <li>例: ♠7が出たら♠6と♠8で鳴き → ♠6-7-8</li>
          <li>鳴き後、場が流れて鳴いた人のターンに</li>
        </ul>

        <h4 className="font-semibold mb-1 text-amber-400">カード交換（2ラウンド目〜）</h4>
        <ul className="text-xs space-y-1 text-white/80 list-disc pl-4">
          <li>大富豪 ↔ 大貧民: 2枚交換</li>
          <li>富豪 ↔ 貧民: 1枚交換</li>
          <li>下位は最強カードを渡し、上位は不要カードを渡す</li>
        </ul>
      </div>
    </div>
  );
}

export default function Scoreboard({ scores, myId }: ScoreboardProps) {
  const [showRules, setShowRules] = useState(false);

  if (!scores || scores.length === 0) {
    return (
      <div className="px-3 py-3 text-center text-xs text-[#6a7a64]">
        スコアはラウンド終了後に表示されます
      </div>
    );
  }

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const me = scores.find((s) => s.id === myId);

  return (
    <div className="px-3 py-2 flex items-center">
      {/* 左: 自分のアバター（大きく表示） */}
      <div className="flex-shrink-0 relative w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400/50 ml-12">
        {me?.avatar ? (
          <Image
            src={`/icon/${me.avatar}`}
            alt={me.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-700 flex items-center justify-center text-white text-xl font-bold">
            {me?.name?.[0] || "?"}
          </div>
        )}
      </div>

      {/* 右: スコアテーブル */}
      <table className="flex-1 ml-10 text-sm">
        <thead>
          <tr className="text-white/50 border-b border-white/10">
            <th className="text-right py-1 font-semibold w-6">#</th>
            <th className="text-left py-1 font-semibold pl-2">Player</th>
            <th className="text-left py-1 font-semibold pl-3">
              Score
              <button
                onClick={() => setShowRules(true)}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/30 text-white/50 hover:text-white hover:border-white/60"
                title="得点ルール"
              >
                ?
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const isMe = s.id === myId;
            return (
              <tr
                key={s.id}
                className={isMe ? "text-amber-400" : "text-white/70"}
              >
                <td className="text-right py-1">{i + 1}</td>
                <td className="py-1 pl-2">{s.name}{isMe ? " (you)" : ""}</td>
                <td className="text-left py-1 font-bold pl-3">{s.score > 0 ? `+${s.score}` : s.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showRules && <ScoringRulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
