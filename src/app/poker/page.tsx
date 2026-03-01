"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import { VOICE_STAMPS } from "@/lib/constants";
import { connectSocket, disconnectAndClearSession, getStoredSessionId, storeSessionId, clearSessionId, storeLastRoom, clearLastRoom, getLastRoom, startKeepAlive, stopKeepAlive, type GameSocket } from "@/lib/socket";
import { playChat, playVoiceStamp } from "@/lib/sfx";
import { VoiceChat, type VoiceUser } from "@/lib/webrtc";
import type { PokerClientState, PokerPlayerInfo, PokerAction } from "../../../shared/poker/types";
import type { PokerRoomInfo } from "../../../shared/poker/events";

import Lobby from "@/components/Lobby";
import WaitingRoom from "@/components/WaitingRoom";
import Notification from "@/components/Notification";
import JoinRequestPopup from "@/components/JoinRequestPopup";
import { ChatPanel } from "@/components/GameUI";

import PokerTable from "@/components/poker/PokerTable";
import PokerHand from "@/components/poker/PokerHand";
import PokerOpponentBar from "@/components/poker/PokerOpponentBar";
import PokerActionButtons from "@/components/poker/PokerActionButtons";

type Screen = "lobby" | "waiting" | "game";

export default function PokerPage() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [roomInfo, setRoomInfo] = useState<PokerRoomInfo | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const [myId, setMyId] = useState("");
  const myIdRef = useRef("");

  // ポーカーゲーム状態
  const [pokerState, setPokerState] = useState<PokerClientState | null>(null);

  // UI状態
  const [note, setNote] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [joinRequestFrom, setJoinRequestFrom] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  // ボイスチャット
  const voiceChatRef = useRef<VoiceChat | null>(null);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [inVoice, setInVoice] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((text: string) => {
    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    setNote(text);
    notifyTimerRef.current = setTimeout(() => setNote(""), 5000);
  }, []);

  // Socketイベントリスナー
  const registerSocketListeners = useCallback((socket: GameSocket) => {
    socket.off("connect");
    socket.off("disconnect");
    socket.off("session");
    socket.off("reconnected");
    socket.off("room_info");
    (socket as any).off("poker_state");
    socket.off("chat_message");
    socket.off("notification");
    socket.off("game_error");
    socket.off("session_expired");
    socket.off("replaced");
    socket.off("join_request");
    socket.off("join_request_result");
    socket.off("voice_stamp");

    socket.on("connect", () => {
      if (disconnectDebounceRef.current) {
        clearTimeout(disconnectDebounceRef.current);
        disconnectDebounceRef.current = null;
      }
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        setConnected(false);
        return;
      }
      if (!disconnectDebounceRef.current) {
        disconnectDebounceRef.current = setTimeout(() => {
          disconnectDebounceRef.current = null;
          setConnected(false);
        }, 2000);
      }
    });

    socket.on("session", (data: { sessionId: string; playerId: string }) => {
      storeSessionId(data.sessionId);
      setMyId(data.playerId);
      myIdRef.current = data.playerId;
    });

    socket.on("reconnected", (data: { roomId: string; playerName: string; gameType?: string }) => {
      if (data.gameType && data.gameType !== "poker") {
        window.location.href = "/";
        return;
      }
      setScreen("game");
      notify(`${data.roomId}に再接続しました`);
    });

    socket.on("room_info", (info: any) => {
      setRoomInfo(info as PokerRoomInfo);
    });

    (socket as any).on("poker_state", (state: PokerClientState) => {
      setPokerState(state);
      setScreen("game");
      setJoinRequestFrom(null);
    });

    socket.on("chat_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.fromId !== myIdRef.current) {
        playChat();
        notify(`💬 ${msg.from}: ${msg.text}`);
      }
    });

    socket.on("voice_stamp", (data: { fromId: string; fromName: string; stampId: string }) => {
      playVoiceStamp(data.stampId);
      const stamp = VOICE_STAMPS.find((v) => v.id === data.stampId);
      if (data.fromId !== myIdRef.current) {
        notify(`🔊 ${data.fromName}: ${stamp?.label || data.stampId}`);
      }
    });

    socket.on("notification", (data: { message: string }) => {
      notify(data.message);
    });

    socket.on("game_error", (data: { message: string }) => {
      notify(data.message);
      setScreen((prev) => {
        if (prev === "waiting") {
          clearLastRoom();
          setRoomInfo(null);
          return "lobby";
        }
        return prev;
      });
    });

    socket.on("session_expired", () => {
      clearSessionId();
      const lastRoom = getLastRoom();
      if (lastRoom) {
        // 大富豪ルームなら大富豪ページにリダイレクト
        if (lastRoom.gameType !== "poker") {
          window.location.href = "/";
          return;
        }
        notify("サーバーが再起動されました。再参加中…");
        socket.emit("join_room", {
          roomId: lastRoom.roomId,
          playerName: lastRoom.playerName,
          avatar: lastRoom.avatar,
          gameType: "poker",
        });
        setScreen("waiting");
      } else {
        notify("セッションが切れました。ロビーに戻ります");
        setScreen("lobby");
      }
    });

    socket.on("replaced", () => {
      clearSessionId();
      notify("別のデバイスまたはタブで接続されました");
      setScreen("lobby");
    });

    socket.on("join_request", (data: { playerName: string }) => {
      setJoinRequestFrom(data.playerName);
    });

    socket.on("join_request_result", (data: { accepted: boolean; message: string }) => {
      if (!data.accepted) notify(data.message);
    });
  }, [notify]);

  // マウント時: sessionIdがあれば自動再接続（大富豪ならリダイレクト）
  useEffect(() => {
    const sessionId = getStoredSessionId();
    if (!sessionId) return;

    // lastRoomが大富豪なら大富豪ページにリダイレクト
    const lastRoom = getLastRoom();
    if (lastRoom && lastRoom.gameType !== "poker") {
      window.location.href = "/";
      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;
    registerSocketListeners(socket);
    startKeepAlive(socket);
  }, [registerSocketListeners]);

  // ルーム参加
  const handleJoinRoom = useCallback((playerName: string, roomId: string, avatar?: string) => {
    const socket = connectSocket();
    socketRef.current = socket;
    storeLastRoom(roomId, playerName, avatar, "poker");
    registerSocketListeners(socket);
    startKeepAlive(socket);

    const joinRoom = () => {
      socket.emit("join_room", { roomId, playerName, avatar, gameType: "poker" });
      setScreen("waiting");
    };

    if (socket.connected) joinRoom();
    else socket.once("connect", joinRoom);
  }, [registerSocketListeners]);

  const handleStartGame = useCallback(() => {
    socketRef.current?.emit("start_game");
  }, []);

  const handleLeave = useCallback(() => {
    voiceChatRef.current?.leave();
    setInVoice(false);
    setVoiceUsers([]);
    stopKeepAlive();
    socketRef.current?.emit("leave_room");
    disconnectAndClearSession();
    clearLastRoom();
    socketRef.current = null;
    setScreen("lobby");
    setRoomInfo(null);
    setMyId("");
    myIdRef.current = "";
    setMessages([]);
    setPokerState(null);
  }, []);

  const handleAction = useCallback((action: PokerAction, amount?: number) => {
    if (!socketRef.current?.connected) {
      notify("接続中…しばらくお待ちください");
      return;
    }
    (socketRef.current as any).emit("poker_action", { action, amount });
  }, [notify]);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit("chat_message", { text });
  }, []);

  const sendVoiceStamp = useCallback((stampId: string) => {
    socketRef.current?.emit("voice_stamp", { stampId });
  }, []);

  const joinVoice = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !myIdRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      notify("この環境ではマイクを使用できません（HTTPS接続が必要です）");
      return;
    }
    try {
      let vc = voiceChatRef.current;
      if (!vc) {
        vc = new VoiceChat();
        vc.setCallbacks({ onUsersChanged: (users) => setVoiceUsers(users) });
        voiceChatRef.current = vc;
      }
      await vc.join(socket, myIdRef.current);
      setInVoice(true);
      setMicEnabled(true);
      setSpeakerEnabled(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "不明なエラー";
      notify(`マイクの取得に失敗しました: ${msg}`);
    }
  }, [notify]);

  const leaveVoice = useCallback(() => {
    voiceChatRef.current?.leave();
    setInVoice(false);
    setVoiceUsers([]);
  }, []);

  const toggleMic = useCallback(() => {
    const vc = voiceChatRef.current;
    if (!vc) return;
    const next = !micEnabled;
    vc.setMicEnabled(next);
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleSpeaker = useCallback(() => {
    const vc = voiceChatRef.current;
    if (!vc) return;
    const next = !speakerEnabled;
    vc.setSpeakerEnabled(next);
    setSpeakerEnabled(next);
  }, [speakerEnabled]);

  const acceptJoinRequest = useCallback(() => {
    socketRef.current?.emit("join_request_response", { accept: true });
    setJoinRequestFrom(null);
  }, []);

  const rejectJoinRequest = useCallback(() => {
    socketRef.current?.emit("join_request_response", { accept: false });
    setJoinRequestFrom(null);
  }, []);

  // --- 画面分岐 ---
  if (screen === "lobby") {
    return <Lobby onJoinRoom={handleJoinRoom} gameType="poker" />;
  }

  if (screen === "waiting" && roomInfo) {
    return (
      <>
        <Notification message={note} />
        <WaitingRoom
          roomInfo={roomInfo}
          myId={myId}
          onStartGame={handleStartGame}
          onLeave={handleLeave}
          messages={messages}
          onSendChat={sendChat}
          onVoiceStamp={sendVoiceStamp}
          inVoice={inVoice}
          voiceUsers={voiceUsers}
          micEnabled={micEnabled}
          speakerEnabled={speakerEnabled}
          onJoinVoice={joinVoice}
          onLeaveVoice={leaveVoice}
          onToggleMic={toggleMic}
          onToggleSpeaker={toggleSpeaker}
        />
      </>
    );
  }

  if (screen === "game" && pokerState) {
    const isMyTurn = pokerState.currentTurn === myId
      && pokerState.phase !== "showdown"
      && pokerState.phase !== "hand_end"
      && pokerState.phase !== "waiting";

    return (
      <div
        className="max-w-[430px] md:max-w-[640px] mx-auto min-h-dvh text-gray-300
          font-sans flex flex-col relative overflow-hidden"
        style={{
          containerType: "inline-size",
          backgroundColor: "#1a3a2a",
          "--bg-main": "#1a3a2a",
          "--bg-darker": "#0a2a1a",
          "--bg-mid": "#153525",
          "--border-dark": "#0a2a1a",
        } as React.CSSProperties}
      >
        <Notification message={note} />
        {!connected && (
          <div className="absolute inset-x-0 top-0 z-50 bg-red-800/90 text-white text-center py-1 text-sm animate-pulse">
            接続が切れています…再接続中
          </div>
        )}
        {joinRequestFrom && (
          <JoinRequestPopup
            playerName={joinRequestFrom}
            onAccept={acceptJoinRequest}
            onReject={rejectJoinRequest}
          />
        )}

        {/* ヘッダー */}
        <div className="shrink-0 px-3 py-2 flex items-center justify-between"
          style={{ backgroundColor: "var(--bg-darker)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Texas Hold&apos;em</span>
            <span className="text-xs text-white/50">Hand #{pokerState.round}</span>
          </div>
          <div className="flex items-center gap-3">
            {isMyTurn && (
              <span className="text-sm font-bold bg-yellow-500/30 text-yellow-200 px-4 py-1.5 rounded-full animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.3)]">
                Your Turn
              </span>
            )}
            {/* ボイスチャットボタン */}
            {inVoice ? (
              <div className="flex items-center gap-1">
                <button onClick={toggleMic} className={`text-xs px-1.5 py-0.5 rounded ${micEnabled ? "bg-green-600/40 text-green-300" : "bg-red-600/40 text-red-300"}`}>
                  {micEnabled ? "🎙" : "🔇"}
                </button>
                <button onClick={toggleSpeaker} className={`text-xs px-1.5 py-0.5 rounded ${speakerEnabled ? "bg-green-600/40 text-green-300" : "bg-red-600/40 text-red-300"}`}>
                  {speakerEnabled ? "🔊" : "🔈"}
                </button>
                <button onClick={leaveVoice} className="text-xs px-1.5 py-0.5 rounded bg-red-600/40 text-red-300">
                  退出
                </button>
              </div>
            ) : (
              <button onClick={joinVoice} className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20">
                🎤 Voice
              </button>
            )}
            <button
              onClick={() => { if (window.confirm("ゲームから退出しますか？")) handleLeave(); }}
              className="rounded-lg px-3 py-1 text-xs font-bold
                bg-white/10 text-white/50 border border-white/15 cursor-pointer hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors"
            >
              退出
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-[1]" />

          {/* 対戦相手 */}
          <PokerOpponentBar players={pokerState.players} myId={myId} />

          <div className="flex-[1]" />

          {/* コミュニティカード & ポット */}
          <PokerTable communityCards={pokerState.communityCards} pot={pokerState.pot} />

          <div className="flex-[1]" />

          {/* ショーダウン結果 */}
          {pokerState.phase === "showdown" && pokerState.winners && (
            <div className="text-center py-2">
              {pokerState.winners.map((w) => (
                <div key={w.playerId} className="text-sm text-yellow-300 font-bold">
                  {w.playerName} が {w.amount} チップ獲得
                  {w.handLabel && ` (${w.handLabel})`}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 自分のホールカード */}
        <PokerHand cards={pokerState.holeCards} />

        {/* 自分のチップ情報 */}
        <div className="text-center text-xs text-white/60 pb-1">
          <span className="text-yellow-300 font-mono font-bold">{pokerState.myChips}</span> chips
          {pokerState.myCurrentBet > 0 && (
            <span className="ml-2 text-green-300">Bet: {pokerState.myCurrentBet}</span>
          )}
        </div>

        {/* アクションボタン */}
        <PokerActionButtons
          isMyTurn={isMyTurn && connected}
          currentBet={pokerState.currentBet}
          myCurrentBet={pokerState.myCurrentBet}
          myChips={pokerState.myChips}
          minRaise={pokerState.minRaise}
          onAction={handleAction}
          chatOpen={chatOpen}
          onChatToggle={() => setChatOpen(!chatOpen)}
        />


        {chatOpen && <ChatPanel messages={messages} onSend={sendChat} onVoiceStamp={sendVoiceStamp} />}
      </div>
    );
  }

  // ローディング
  return (
    <div className="max-w-[430px] md:max-w-[640px] mx-auto min-h-dvh bg-[#1a3a2a] text-gray-300
      font-sans flex items-center justify-center">
      <p className="text-white/40 animate-pulse">接続中...</p>
    </div>
  );
}
