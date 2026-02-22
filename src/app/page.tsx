"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { GameCard, ChatMessage, Player } from "@/lib/types";
import { NAKI_RANKS } from "@/lib/constants";
import { canNaki, isJoker, sortHand } from "@/lib/gameLogic";
import { connectSocket, disconnectAndClearSession, getStoredSessionId, storeSessionId, storeLastRoom, clearLastRoom, startKeepAlive, stopKeepAlive, type GameSocket } from "@/lib/socket";
import { playDeal, playCard as playCardSfx, playPass as playPassSfx, playTurnNotify, playNaki, playRevolution, playMiyakoOchi, playChat } from "@/lib/sfx";
import { VoiceChat, type VoiceUser } from "@/lib/webrtc";
import type { ClientGameState, RoomInfo } from "../../shared/events";

import Lobby from "@/components/Lobby";
import WaitingRoom from "@/components/WaitingRoom";
import GameHeader from "@/components/GameHeader";
import { ActionButtons, GameInfoBar, ChatPanel } from "@/components/GameUI";
import OpponentBar, { SideOpponents } from "@/components/OpponentBar";
import Field from "@/components/Field";
import NakiPopup from "@/components/NakiPopup";
import HistoryPanel from "@/components/HistoryPanel";
import Hand from "@/components/Hand";
import Notification, { BigAnnouncement } from "@/components/Notification";
import JoinRequestPopup from "@/components/JoinRequestPopup";
import Scoreboard from "@/components/Scoreboard";
import CardExchangeUI from "@/components/CardExchangeUI";

type Screen = "lobby" | "waiting" | "game";

export default function GamePage() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const [myId, setMyId] = useState("");
  const myIdRef = useRef("");

  // ゲーム状態
  const [hand, setHand] = useState<GameCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [field, setField] = useState<GameCard[]>([]);
  const [history, setHistory] = useState<GameCard[]>([]);
  const [currentTurn, setCurrentTurn] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [nakiTarget, setNakiTarget] = useState<GameCard | null>(null);
  const [note, setNote] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nakiCount, setNakiCount] = useState(0);
  const [isRevolution, setIsRevolution] = useState(false);
  const [isElevenBack, setIsElevenBack] = useState(false);
  const [round, setRound] = useState(1);
  const [myRank, setMyRank] = useState<Player["rank"]>("平民");
  const [joinRequestFrom, setJoinRequestFrom] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [scores, setScores] = useState<{ id: string; name: string; score: number; avatar?: string }[]>([]);
  const [phase, setPhase] = useState<string>("");
  const [exchangeInfo, setExchangeInfo] = useState<{
    needToGive: number;
    receivedCards: GameCard[];
    waitingFor: string[];
  } | null>(null);
  const voiceChatRef = useRef<VoiceChat | null>(null);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [inVoice, setInVoice] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [announcement, setAnnouncement] = useState<{ message: string; type: "naki" | "revolution" | "miyakoOchi" | "eightCut" } | null>(null);
  const [connected, setConnected] = useState(true);
  const prevPhaseRef = useRef<string>("");
  const prevTurnRef = useRef<string>("");
  const prevRevolutionRef = useRef(false);
  const handRef = useRef<GameCard[]>([]);

  const notify = useCallback((text: string) => {
    setNote(text);
    setTimeout(() => setNote(""), 5000);
  }, []);

  const announce = useCallback((message: string, type: "naki" | "revolution" | "miyakoOchi" | "eightCut") => {
    setAnnouncement({ message, type });
    setTimeout(() => setAnnouncement(null), 2000);
  }, []);

  // Socketイベントリスナー登録
  const registerSocketListeners = useCallback((socket: GameSocket) => {
    // 既存リスナーをクリア
    socket.off("connect");
    socket.off("disconnect");
    socket.off("session");
    socket.off("reconnected");
    socket.off("room_info");
    socket.off("game_state");
    socket.off("intercept_window");
    socket.off("intercept_result");
    socket.off("round_end");
    socket.off("chat_message");
    socket.off("notification");
    socket.off("game_error");
    socket.off("join_request");
    socket.off("join_request_result");

    // 接続状態の監視
    socket.on("connect", () => {
      setConnected(true);
    });
    socket.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io server disconnect") {
        // サーバーから切断された場合は手動で再接続
        socket.connect();
      }
      // その他の理由（transport close等）はSocket.ioが自動再接続する
    });

    // セッション情報受信
    socket.on("session", (data: { sessionId: string; playerId: string }) => {
      storeSessionId(data.sessionId);
      setMyId(data.playerId);
      myIdRef.current = data.playerId;
    });

    // 再接続成功 → ゲーム画面に遷移（game_stateより先に確実に画面切替）
    socket.on("reconnected", (data: { roomId: string; playerName: string }) => {
      setScreen("game");
      notify(`${data.roomId}に再接続しました`);
    });

    socket.on("room_info", (info: RoomInfo) => {
      setRoomInfo(info);
    });

    socket.on("game_state", (state: ClientGameState) => {
      // カード配り演出: waiting/round_end/card_exchange → playing の遷移時
      const prevPhase = prevPhaseRef.current;
      if (state.phase === "playing" && (prevPhase === "waiting" || prevPhase === "" || prevPhase === "round_end" || prevPhase === "card_exchange")) {
        setDealing(true);
        playDeal(state.hand.length);
        setTimeout(() => setDealing(false), state.hand.length * 60 + 200);
      }
      prevPhaseRef.current = state.phase;

      setScreen("game");
      setJoinRequestFrom(null);
      setPhase(state.phase);
      const sorted = sortHand(state.hand, false);
      handRef.current = sorted;
      setHand(sorted);
      setField(state.field);
      setHistory(state.history);
      setCurrentTurn(state.currentTurn);
      // ターンが変わったら全員に通知音
      if (prevTurnRef.current !== state.currentTurn) {
        playTurnNotify();
      }
      prevTurnRef.current = state.currentTurn;
      // 革命が発動したら派手に演出
      if (state.isRevolution && !prevRevolutionRef.current) {
        playRevolution();
        announce("革命発動！！", "revolution");
      }
      prevRevolutionRef.current = state.isRevolution;
      setIsRevolution(state.isRevolution);
      setIsElevenBack(state.isElevenBack);
      setRound(state.round);
      setMyRank(state.myRank);
      setNakiCount(state.nakiCount);
      setScores(state.scores);
      setExchangeInfo(state.exchangeInfo || null);
      // 左回り（反時計回り）: 自分の次のターンの人から順に並べる
      const myIdx = state.players.findIndex((p) => p.id === myIdRef.current);
      const total = state.players.length;
      const ordered: typeof state.players = [];
      for (let i = 1; i < total; i++) {
        ordered.push(state.players[(myIdx + i) % total]);
      }
      setPlayers(
        ordered.map((p) => ({
          ...p,
          speaking: false,
          avatar: p.avatar,
        }))
      );
      if (state.phase !== "naki_chance") {
        setNakiTarget(null);
      }
    });

    socket.on("intercept_window", (data: { card: GameCard }) => {
      // 自分の手札で鳴けるかチェック（鳴けない場合は表示しない）
      const { possible } = canNaki(data.card, handRef.current);
      if (possible) {
        setNakiTarget(data.card);
        notify("鳴きチャンス！");
      }
    });

    socket.on("intercept_result", (data: { playerName: string }) => {
      playNaki();
      announce(`${data.playerName}が鳴きました！！`, "naki");
    });

    socket.on("round_end", (data: { rankings: { playerId: string; rank: string }[]; miyakoOchi?: { playerId: string; playerName: string } }) => {
      if (data.miyakoOchi) {
        playMiyakoOchi();
        announce("都落ち！！", "miyakoOchi");
      }
    });

    socket.on("chat_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.fromId !== myIdRef.current) {
        playChat();
        notify(`💬 ${msg.from}: ${msg.text}`);
      }
    });

    socket.on("notification", (data: { message: string }) => {
      if (data.message.includes("8切り")) {
        announce("✂️ 8切り！", "eightCut");
        return;
      }
      notify(data.message);
    });

    socket.on("game_error", (data: { message: string }) => {
      notify(data.message);
      setPendingJoin(false);
      // 待機室に入れなかった場合のみlastRoomをクリア（自動再接続失敗時は残す）
      setScreen((prev) => {
        if (prev === "waiting") {
          clearLastRoom();
          setRoomInfo(null);
          return "lobby";
        }
        return prev;
      });
    });

    // 参加要請を受信（既存メンバー側）
    socket.on("join_request", (data: { playerName: string }) => {
      setJoinRequestFrom(data.playerName);
    });

    // 参加要請の結果を受信（要請者側）
    socket.on("join_request_result", (data: { accepted: boolean; message: string }) => {
      setPendingJoin(false);
      if (!data.accepted) {
        notify(data.message);
      }
      // accepted の場合は game_state イベントでゲーム画面に遷移する
    });
  }, [notify]);

  // マウント時: sessionIdがあれば自動再接続
  useEffect(() => {
    const sessionId = getStoredSessionId();
    if (!sessionId) return;

    const socket = connectSocket();
    socketRef.current = socket;
    registerSocketListeners(socket);
    startKeepAlive(socket);
    // connectSocketが既にconnect()を呼ぶので、reconnectedイベントを待つだけ
  }, [registerSocketListeners]);

  // ルーム参加
  const handleJoinRoom = useCallback((playerName: string, roomId: string, avatar?: string) => {
    const socket = connectSocket();
    socketRef.current = socket;

    // ルーム情報をlocalStorageに保存（再参加用）
    storeLastRoom(roomId, playerName, avatar);

    // リスナーを先に登録してからjoin
    registerSocketListeners(socket);
    startKeepAlive(socket);

    const joinRoom = () => {
      socket.emit("join_room", { roomId, playerName, avatar });
      setScreen("waiting");
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    setPendingJoin(true);
  }, [registerSocketListeners]);

  // ゲーム開始（ホストのみ）
  const handleStartGame = useCallback(() => {
    socketRef.current?.emit("start_game");
  }, []);

  // ルーム退出
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
  }, []);

  // --- ゲーム操作 ---
  const isMyTurn = currentTurn === myId;
  const canPlay = selected.size > 0 && isMyTurn;

  const tapCard = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const playCards = useCallback(() => {
    if (selected.size === 0 || !isMyTurn) return;
    const cardIds = Array.from(selected);
    socketRef.current?.emit("play_card", { cardIds });
    playCardSfx();
    setSelected(new Set());
  }, [selected, isMyTurn]);

  const doNaki = useCallback(() => {
    socketRef.current?.emit("intercept");
    setNakiTarget(null);
  }, []);

  const skipNaki = useCallback(() => {
    socketRef.current?.emit("skip_intercept");
    setNakiTarget(null);
  }, []);

  const doPass = useCallback(() => {
    if (!isMyTurn) return;
    socketRef.current?.emit("pass");
    playPassSfx();
  }, [isMyTurn]);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit("chat_message", { text });
  }, []);

  const joinVoice = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      notify("サーバーに接続されていません");
      return;
    }
    if (!myIdRef.current) {
      notify("セッション情報がありません");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      notify("この環境ではマイクを使用できません（HTTPS接続が必要です）");
      return;
    }
    try {
      let vc = voiceChatRef.current;
      if (!vc) {
        vc = new VoiceChat();
        vc.setCallbacks({
          onUsersChanged: (users) => setVoiceUsers(users),
        });
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

  const submitExchange = useCallback((cardIds: string[]) => {
    socketRef.current?.emit("card_exchange", { cardIds });
  }, []);

  const currentTurnName = players.find((p) => p.id === currentTurn)?.name
    || (currentTurn === myId ? "you" : "");

  // --- 画面分岐 ---
  if (screen === "lobby") {
    return <Lobby onJoinRoom={handleJoinRoom} />;
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

  if (screen === "game") {
    const isReversed = isRevolution !== isElevenBack;
    const bgColor = isReversed ? "#6b2d2d" : "#2d6b3f";
    return (
      <div className="max-w-[430px] md:max-w-[640px] mx-auto min-h-dvh text-gray-300
        font-sans flex flex-col relative overflow-hidden transition-colors duration-500"
        style={{
          containerType: "inline-size",
          backgroundColor: bgColor,
          "--bg-main": bgColor,
          "--bg-darker": isReversed ? "#5a1a1a" : "#1a5a2e",
          "--bg-mid": isReversed ? "#5f2525" : "#256b35",
          "--border-dark": isReversed ? "#4a1414" : "#145228",
        } as React.CSSProperties}>
        <Notification message={note} />
        {!connected && (
          <div className="absolute inset-x-0 top-0 z-50 bg-red-800/90 text-white text-center py-1 text-sm animate-pulse">
            接続が切れています…再接続中
          </div>
        )}
        {announcement && <BigAnnouncement message={announcement.message} type={announcement.type} />}
        {joinRequestFrom && (
          <JoinRequestPopup
            playerName={joinRequestFrom}
            onAccept={acceptJoinRequest}
            onReject={rejectJoinRequest}
          />
        )}
        <GameHeader
          isMyTurn={isMyTurn}
          currentTurnName={currentTurnName}
          inVoice={inVoice}
          micEnabled={micEnabled}
          speakerEnabled={speakerEnabled}
          onToggleMic={toggleMic}
          onToggleSpeaker={toggleSpeaker}
          onJoinVoice={joinVoice}
          onLeaveVoice={leaveVoice}
          voiceUsers={voiceUsers}
        />

        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-[1]" />
          <OpponentBar players={players} />
          <div className="flex-[2]" />
          <div className="relative shrink-0">
            <SideOpponents players={players} />
            <Field cards={field} />
          </div>
          <div className="flex-[3]" />
          {nakiTarget && (
            <NakiPopup targetCard={nakiTarget} onNaki={doNaki} onSkip={skipNaki} />
          )}
          {phase === "card_exchange" && exchangeInfo && (
            <CardExchangeUI
              hand={hand}
              needToGive={exchangeInfo.needToGive}
              receivedCards={exchangeInfo.receivedCards}
              waitingFor={exchangeInfo.waitingFor}
              myRank={myRank}
              onSubmit={submitExchange}
            />
          )}
        </div>

        <ActionButtons canPlay={canPlay} canPass={isMyTurn} onPlay={playCards} onPass={doPass} chatOpen={chatOpen} onChatToggle={() => setChatOpen(!chatOpen)} />
        <div className="relative">
          <button
            onClick={() => { if (window.confirm("ゲームから退出しますか？")) handleLeave(); }}
            className="absolute right-2 -top-6 z-[110] rounded-lg px-3 py-1 text-xs font-bold
              bg-white/10 text-white/50 border border-white/15 cursor-pointer hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors"
          >
            退出
          </button>
          <Hand cards={hand} selectedIds={selected} onTapCard={tapCard} enabled={true} dealing={dealing} />
        </div>
        <GameInfoBar rank={myRank} round={round} revolution={isRevolution} elevenBack={isElevenBack} nakiCount={nakiCount} />
        <div style={{ backgroundColor: "var(--bg-darker, #1a5a2e)" }}>
          <Scoreboard scores={scores} myId={myId} />
        </div>

        {chatOpen && <ChatPanel messages={messages} onSend={sendChat} />}
      </div>
    );
  }

  // waiting画面でroomInfoがまだない場合のローディング
  return (
    <div className="max-w-[430px] md:max-w-[640px] mx-auto min-h-dvh bg-[#2d6b3f] text-gray-300
      font-sans flex items-center justify-center">
      <p className="text-[#6a7a64] animate-pulse">接続中...</p>
    </div>
  );
}
