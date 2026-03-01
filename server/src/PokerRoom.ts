import { Server, Socket } from "socket.io";
import { PokerEngine } from "./PokerEngine";
import type { PokerClientToServerEvents, PokerServerToClientEvents, PokerRoomInfo } from "../../shared/poker/events";
import type { PokerClientState } from "../../shared/poker/types";
import { MIN_PLAYERS, MAX_PLAYERS } from "../../shared/poker/constants";

type PokerSocket = Socket<PokerClientToServerEvents, PokerServerToClientEvents>;

interface RoomPlayer {
  socket: PokerSocket;
  id: string;
  name: string;
  isHost: boolean;
  avatar?: string;
}

interface PendingJoin {
  socket: PokerSocket;
  playerId: string;
  name: string;
  avatar?: string;
  onAccepted?: () => void;
}

export class PokerRoom {
  id: string;
  players: RoomPlayer[] = [];
  engine: PokerEngine;
  maxPlayers: number;
  pendingJoin: PendingJoin | null = null;
  voiceUsers: Set<string> = new Set();
  gameType: "poker" = "poker";
  private io: Server;
  private nextHandTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectedPlayerIds = new Set<string>();
  private engineRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private autoActionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(io: Server, roomId: string) {
    this.io = io;
    this.id = roomId;
    this.maxPlayers = MAX_PLAYERS;
    this.engine = new PokerEngine();
  }

  /** プレイヤー参加 */
  join(socket: PokerSocket, playerId: string, playerName: string, avatar?: string): boolean {
    if (this.players.length >= this.maxPlayers) return false;
    if (this.engine.phase !== "waiting" && this.engine.phase !== "hand_end") return false;

    const isHost = this.players.length === 0;
    this.players.push({ socket, id: playerId, name: playerName, isHost, avatar });
    this.engine.addPlayer(playerId, playerName, avatar);
    socket.join(this.id);

    this.broadcastRoomInfo();
    this.registerHandlers(socket, playerId);
    return true;
  }

  /** ゲーム中の参加要請 */
  requestJoin(socket: PokerSocket, playerId: string, playerName: string, avatar?: string, onAccepted?: () => void): void {
    if (this.pendingJoin) {
      (socket as any).emit("game_error", { message: "別の参加要請を処理中です" });
      return;
    }
    if (this.players.length >= this.maxPlayers) {
      (socket as any).emit("game_error", { message: "ルームが満員です" });
      return;
    }

    this.pendingJoin = { socket, playerId, name: playerName, avatar, onAccepted };
    this.broadcast("join_request", { playerName });
    (socket as any).emit("notification", { message: "参加リクエスト送信中..." });
  }

  /** 参加要請を承認 */
  acceptJoin(): void {
    if (!this.pendingJoin) return;
    const { socket, playerId, name, avatar, onAccepted } = this.pendingJoin;
    this.pendingJoin = null;

    onAccepted?.();

    this.players.push({ socket, id: playerId, name, isHost: false, avatar });
    this.engine.addPlayer(playerId, name, avatar);
    socket.join(this.id);
    this.registerHandlers(socket, playerId);

    (socket as any).emit("join_request_result", { accepted: true, message: "参加が承認されました！" });
    this.broadcastRoomInfo();
    this.broadcastPokerState();
    this.broadcast("notification", { message: `${name}が参加しました` });
  }

  /** 参加要請を拒否 */
  rejectJoin(): void {
    if (!this.pendingJoin) return;
    const { socket } = this.pendingJoin;
    this.pendingJoin = null;
    (socket as any).emit("join_request_result", { accepted: false, message: "参加が拒否されました" });
  }

  /** プレイヤー退出 */
  leave(playerId: string): void {
    this.disconnectedPlayerIds.delete(playerId);
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.socket.leave(this.id);

    this.players = this.players.filter((p) => p.id !== playerId);
    this.engine.removePlayer(playerId);

    if (this.voiceUsers.delete(playerId)) {
      this.broadcast("voice_user_left", { userId: playerId });
    }

    if (this.players.length > 0) {
      if (!this.players.some((p) => p.isHost)) {
        this.players[0].isHost = true;
      }
      this.broadcastRoomInfo();
      if (this.engine.phase !== "waiting") {
        this.broadcastPokerState();
      }
    }
  }

  /** 再接続処理 */
  reconnect(socket: PokerSocket, playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;

    this.cancelEngineRemoval(playerId);
    player.socket = socket;
    socket.join(this.id);
    this.registerHandlers(socket, playerId);
    this.broadcastPokerState();
    this.broadcastRoomInfo();
  }

  /** エンジン除外を遅延スケジュール */
  scheduleEngineRemoval(playerId: string): void {
    this.cancelEngineRemoval(playerId);
    this.disconnectedPlayerIds.add(playerId);

    const player = this.players.find((p) => p.id === playerId);
    this.broadcast("notification", { message: `${player?.name || "プレイヤー"}が一時切断しました...` });

    const timer = setTimeout(() => {
      this.engineRemovalTimers.delete(playerId);
      this.removePlayerFromGame(playerId);
    }, 180_000);
    this.engineRemovalTimers.set(playerId, timer);

    this.scheduleAutoAction();
  }

  /** エンジン除外スケジュールをキャンセル */
  cancelEngineRemoval(playerId: string): void {
    this.disconnectedPlayerIds.delete(playerId);
    const timer = this.engineRemovalTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.engineRemovalTimers.delete(playerId);
    }
  }

  /** ゲームからのみ除外 */
  removePlayerFromGame(playerId: string): void {
    this.disconnectedPlayerIds.delete(playerId);
    this.engine.removePlayer(playerId);
    const player = this.players.find((p) => p.id === playerId);
    this.broadcast("notification", { message: `${player?.name || "プレイヤー"}が切断しました` });

    if (this.engine.players.length === 0) {
      this.clearTimers();
      this.engine.phase = "waiting";
      return;
    }
    this.broadcastPokerState();
    if ((this.engine.phase as string) === "showdown") {
      this.scheduleNextHand();
    }
  }

  /** ルーム全体に通知 */
  notifyAll(message: string): void {
    this.broadcast("notification", { message });
  }

  findPlayer(playerId: string): RoomPlayer | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  get isEmpty(): boolean {
    return this.players.length === 0;
  }

  get playerCount(): number {
    return this.players.length;
  }

  /** イベントハンドラ登録 */
  private registerHandlers(socket: PokerSocket, playerId: string): void {
    socket.on("start_game", () => {
      const player = this.players.find((p) => p.id === playerId);
      if (!player?.isHost) {
        (socket as any).emit("game_error", { message: "ホストのみ開始できます" });
        return;
      }
      if (this.players.length < MIN_PLAYERS) {
        (socket as any).emit("game_error", { message: `${MIN_PLAYERS}人以上で開始できます` });
        return;
      }

      this.engine.startHand();
      this.broadcastPokerState();
      this.broadcast("notification", { message: "ポーカー開始！" });
      this.scheduleAutoAction();
    });

    socket.on("poker_action", (data) => {
      const result = this.engine.doAction(playerId, data.action, data.amount);
      if (!result.success) {
        (socket as any).emit("game_error", { message: result.error! });
        return;
      }

      this.broadcastPokerState();

      const actionPhase = this.engine.phase as string;
      if (actionPhase === "showdown") {
        this.scheduleNextHand();
      } else if (actionPhase !== "hand_end" && actionPhase !== "waiting") {
        this.scheduleAutoAction();
      }
    });

    socket.on("chat_message", (data) => {
      const player = this.players.find((p) => p.id === playerId);
      if (player) {
        this.broadcast("chat_message", {
          from: player.name,
          fromId: playerId,
          text: data.text,
          timestamp: Date.now(),
        });
      }
    });

    socket.on("quick_message", (data) => {
      const player = this.players.find((p) => p.id === playerId);
      if (player) {
        this.broadcast("chat_message", {
          from: player.name,
          fromId: playerId,
          text: data.text,
          timestamp: Date.now(),
        });
      }
    });

    socket.on("voice_stamp", (data) => {
      const player = this.players.find((p) => p.id === playerId);
      if (player) {
        this.broadcast("voice_stamp", {
          fromId: playerId,
          fromName: player.name,
          stampId: data.stampId,
        });
      }
    });

    socket.on("join_request_response", (data) => {
      if (!this.pendingJoin) return;
      if (data.accept) this.acceptJoin();
      else this.rejectJoin();
    });

    socket.on("heartbeat", () => {});

    socket.on("voice_join", () => {
      this.voiceUsers.add(playerId);
      const player = this.players.find((p) => p.id === playerId);
      const users = Array.from(this.voiceUsers)
        .filter((id) => id !== playerId)
        .map((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return { id, name: p?.name || "" };
        });
      socket.emit("voice_users", { users });
      this.broadcast("voice_user_joined", { userId: playerId, userName: player?.name || "" });
    });

    socket.on("voice_leave", () => {
      this.voiceUsers.delete(playerId);
      this.broadcast("voice_user_left", { userId: playerId });
    });

    socket.on("voice_signal", (data) => {
      const target = this.players.find((p) => p.id === data.targetId);
      if (target) {
        target.socket.emit("voice_signal", { fromId: playerId, signal: data.signal });
      }
    });
  }

  /** 切断中プレイヤーのターンなら自動フォールド */
  private scheduleAutoAction(): void {
    if (this.autoActionTimer) {
      clearTimeout(this.autoActionTimer);
      this.autoActionTimer = null;
    }

    this.autoActionTimer = setTimeout(() => {
      this.autoActionTimer = null;
      this.autoActionIfDisconnected();
    }, 1000);
  }

  private autoActionIfDisconnected(): void {
    const p = this.engine.phase as string;
    if (p === "waiting" || p === "showdown" || p === "hand_end") return;
    const current = this.engine.currentPlayer;
    if (!current) return;
    if (!this.disconnectedPlayerIds.has(current.id)) return;

    // 切断中→チェックかフォールド
    if (current.currentBet >= this.engine.currentBet) {
      this.engine.doAction(current.id, "check");
    } else {
      this.engine.doAction(current.id, "fold");
    }

    const player = this.players.find((p) => p.id === current.id);
    this.broadcast("notification", { message: `${player?.name || "プレイヤー"}は切断中のため自動アクション` });
    this.broadcastPokerState();

    const afterPhase = this.engine.phase as string;
    if (afterPhase === "showdown") {
      this.scheduleNextHand();
    } else if (afterPhase !== "hand_end" && afterPhase !== "waiting") {
      this.scheduleAutoAction();
    }
  }

  /** ショーダウン後、次のハンドを自動開始 */
  private scheduleNextHand(): void {
    if (this.nextHandTimer) {
      clearTimeout(this.nextHandTimer);
    }
    this.nextHandTimer = setTimeout(() => {
      this.nextHandTimer = null;
      this.engine.endHand();

      // チップ0のプレイヤーを除外（エンジンのstartHandが処理）
      const alive = this.engine.players.filter((p) => p.chips > 0);
      if (alive.length < 2) {
        this.engine.phase = "waiting";
        this.broadcastPokerState();
        if (alive.length === 1) {
          this.broadcast("notification", { message: `${alive[0].name}の勝利！ゲーム終了` });
        }
        this.broadcastRoomInfo();
        return;
      }

      this.engine.startHand();
      this.broadcastPokerState();
      this.broadcast("notification", { message: `ハンド${this.engine.round} 開始` });
      this.scheduleAutoAction();
    }, 5000);
  }

  /** ポーカー状態を各プレイヤーに送信 */
  private broadcastPokerState(): void {
    if (this.engine.players.length === 0) return;
    for (const rp of this.players) {
      const state = this.engine.getClientState(rp.id);
      (rp.socket as any).emit("poker_state", state);
    }
  }

  /** ルーム情報を全員に送信 */
  private broadcastRoomInfo(): void {
    const info: PokerRoomInfo = {
      roomId: this.id,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        avatar: p.avatar,
      })),
      maxPlayers: this.maxPlayers,
      isStarted: this.engine.phase !== "waiting" && this.engine.phase !== "hand_end",
      gameType: "poker",
    };
    this.io.to(this.id).emit("room_info" as any, info);
  }

  /** ルーム全体にイベント送信 */
  private broadcast<E extends keyof PokerServerToClientEvents>(
    event: E,
    data: Parameters<PokerServerToClientEvents[E]>[0]
  ): void {
    this.io.to(this.id).emit(event as any, data as never);
  }

  private clearTimers(): void {
    if (this.nextHandTimer) {
      clearTimeout(this.nextHandTimer);
      this.nextHandTimer = null;
    }
    if (this.autoActionTimer) {
      clearTimeout(this.autoActionTimer);
      this.autoActionTimer = null;
    }
  }
}
