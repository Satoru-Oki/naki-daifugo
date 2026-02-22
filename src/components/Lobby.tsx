"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { clearLastRoom, getLastRoom, type LastRoomInfo } from "@/lib/socket";
import { AVATARS } from "../../shared/constants";

interface LobbyProps {
  onJoinRoom: (playerName: string, roomId: string, avatar?: string) => void;
}

function generateRoomId(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function Lobby({ onJoinRoom }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [lastRoom, setLastRoom] = useState<LastRoomInfo | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>(undefined);

  // クライアント側でのみlocalStorageを読む（SSR不一致回避）
  // ルームが存在するかAPIで確認し、存在しなければlocalStorageをクリア
  useEffect(() => {
    const saved = getLastRoom();
    if (!saved) return;
    // 前回の名前・ルームIDを復元（ルームが消えていても入り直し可能）
    setLastRoom(saved);
    setPlayerName(saved.playerName);
    if (saved.avatar) setSelectedAvatar(saved.avatar);
  }, []);

  const canCreate = playerName.trim().length > 0;
  const canJoin = playerName.trim().length > 0 && roomId.trim().length === 4;

  const handleCreate = () => {
    if (!canCreate) return;
    const newRoomId = generateRoomId();
    onJoinRoom(playerName.trim(), newRoomId, selectedAvatar);
  };

  const handleJoin = () => {
    if (!canJoin) return;
    onJoinRoom(playerName.trim(), roomId.trim(), selectedAvatar);
  };

  const handleRejoin = () => {
    if (!lastRoom) return;
    onJoinRoom(lastRoom.playerName, lastRoom.roomId, lastRoom.avatar ?? selectedAvatar);
  };

  return (
    <div className="max-w-[430px] mx-auto min-h-dvh bg-[#2d6b3f]
      font-sans flex flex-col items-center justify-center px-6 py-8 relative overflow-y-auto">

      {/* タイトル */}
      <div className="text-center mb-12 relative">
        <p className="text-xl text-white/90 font-light tracking-[0.5em] mb-3 ml-4 font-[family-name:var(--font-fredoka)]">
          大富豪
        </p>
        <h1 className="text-6xl font-black text-white tracking-tight mb-3">
          Exiles
        </h1>
        <p className="text-base text-white font-medium tracking-widest">
          ～ようこそおやじたち
        </p>
      </div>

      {/* 再参加バナー */}
      {lastRoom && (
        <div className="w-full mb-4 relative">
          <button
            onClick={handleRejoin}
            className="w-full py-3.5 rounded-2xl font-bold text-base
              bg-amber-500 text-white
              shadow-[0_4px_16px_rgba(245,158,11,0.4)]
              hover:bg-amber-400 active:scale-[0.98] transition-all"
          >
            ゲームに戻る（{lastRoom.roomId}）
          </button>
          <button
            onClick={() => { clearLastRoom(); setLastRoom(null); }}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full
              bg-black/40 text-white text-sm flex items-center justify-center
              hover:bg-black/60 transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* カード風コンテナ */}
      <div className="w-full bg-[#f5f0e0] rounded-2xl p-6
        shadow-[0_4px_24px_rgba(0,0,0,0.2)] relative">

        {/* 名前入力 */}
        <div className="mb-5">
          <label className="block text-[11px] text-[#2d6b3f] mb-2 font-bold uppercase tracking-wider">
            Player Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="名前を入力..."
            maxLength={10}
            className="w-full px-4 py-3 rounded-xl bg-[#ece7d5] border border-[#ddd8c5]
              text-[#333] placeholder-[#aaa] outline-none
              focus:border-[#2d6b3f] focus:ring-2 focus:ring-[#2d6b3f]/20
              transition-all text-base"
          />
        </div>

        {/* アバター選択 */}
        <div className="mb-5">
          <label className="block text-[11px] text-[#2d6b3f] mb-2 font-bold uppercase tracking-wider">
            Avatar
          </label>
          <div className="grid grid-cols-4 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.file}
                onClick={() => setSelectedAvatar(selectedAvatar === a.file ? undefined : a.file)}
                className={`relative aspect-square rounded-xl overflow-hidden border-[3px] transition-all
                  ${selectedAvatar === a.file
                    ? "border-[#2d6b3f] shadow-[0_0_12px_rgba(45,107,63,0.4)] scale-105"
                    : "border-transparent opacity-70 hover:opacity-100"
                  }`}
              >
                <Image
                  src={`/icon/${a.file}`}
                  alt={a.label}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {mode === "menu" ? (
          <div className="space-y-3">
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="w-full py-3.5 rounded-xl font-bold text-base
                bg-[#2d6b3f] text-white
                shadow-[0_4px_16px_rgba(45,107,63,0.3)]
                disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
                hover:bg-[#368a4a] active:scale-[0.98] transition-all"
            >
              ルームを作成
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={!playerName.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-base
                bg-[#ece7d5] border border-[#ddd8c5] text-[#555]
                disabled:opacity-30 disabled:cursor-not-allowed
                hover:border-[#2d6b3f] hover:text-[#2d6b3f]
                active:scale-[0.98] transition-all"
            >
              ルームに参加
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-[#2d6b3f] mb-2 font-bold uppercase tracking-wider">
                Room ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                inputMode="numeric"
                className="w-full px-4 py-3 rounded-xl bg-[#ece7d5] border border-[#ddd8c5]
                  text-[#333] placeholder-[#ccc] outline-none text-center text-2xl tracking-[0.5em] font-mono
                  focus:border-[#2d6b3f] focus:ring-2 focus:ring-[#2d6b3f]/20
                  transition-all"
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={!canJoin}
              className="w-full py-3.5 rounded-xl font-bold text-base
                bg-[#2d6b3f] text-white
                shadow-[0_4px_16px_rgba(45,107,63,0.3)]
                disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
                hover:bg-[#368a4a] active:scale-[0.98] transition-all"
            >
              参加する
            </button>
            <button
              onClick={() => { setMode("menu"); setRoomId(""); }}
              className="w-full py-2.5 text-sm text-[#999] hover:text-[#2d6b3f] transition-colors"
            >
              戻る
            </button>
          </div>
        )}
      </div>

      {/* フッター */}
      <p className="mt-10 text-[10px] text-white/50 tracking-wider">
        v0.1.0
      </p>
    </div>
  );
}
