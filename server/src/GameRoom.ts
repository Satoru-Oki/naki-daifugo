import { Server, Socket } from "socket.io";
import { GameEngine } from "./GameEngine";
import { canNaki } from "../../shared/gameLogic";
import type { ClientToServerEvents, ServerToClientEvents, ClientGameState, RoomInfo } from "../../shared/events";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface RoomPlayer {
  socket: GameSocket;
  id: string;
  name: string;
  isHost: boolean;
  avatar?: string;
}

interface PendingJoin {
  socket: GameSocket;
  playerId: string;
  name: string;
  avatar?: string;
  onAccepted?: () => void;
}

export class GameRoom {
  id: string;
  players: RoomPlayer[] = [];
  engine: GameEngine;
  maxPlayers: number;
  nextRoundTimer: ReturnType<typeof setTimeout> | null = null;
  pendingJoin: PendingJoin | null = null;
  voiceUsers: Set<string> = new Set();
  private io: Server;
  private disconnectedScores = new Map<string, number>();
  private engineRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private disconnectedPlayerIds = new Set<string>();
  private autoPassTimer: ReturnType<typeof setTimeout> | null = null;
  private spade3CutTimer: ReturnType<typeof setTimeout> | null = null;
  private eightCutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(io: Server, roomId: string, maxPlayers = 5) {
    this.io = io;
    this.id = roomId;
    this.maxPlayers = maxPlayers;
    this.engine = new GameEngine();
  }

  /** プレイヤー参加 */
  join(socket: GameSocket, playerId: string, playerName: string, avatar?: string): boolean {
    if (this.players.length >= this.maxPlayers) return false;
    if (this.engine.phase !== "waiting") return false;

    const isHost = this.players.length === 0;
    const player: RoomPlayer = {
      socket,
      id: playerId,
      name: playerName,
      isHost,
      avatar,
    };

    this.players.push(player);
    this.engine.addPlayer(playerId, playerName, avatar);
    socket.join(this.id);

    // ルーム情報を全員に通知
    this.broadcastRoomInfo();

    // イベントハンドラ登録
    this.registerHandlers(socket, playerId);

    return true;
  }

  /** ゲーム中の参加要請 */
  requestJoin(socket: GameSocket, playerId: string, playerName: string, avatar?: string, onAccepted?: () => void): void {
    if (this.pendingJoin) {
      socket.emit("game_error", { message: "別の参加要請を処理中です" });
      return;
    }
    if (this.players.length >= this.maxPlayers) {
      socket.emit("game_error", { message: "ルームが満員です" });
      return;
    }

    this.pendingJoin = { socket, playerId, name: playerName, avatar, onAccepted };

    // 既存メンバー全員に参加要請を通知
    this.broadcast("join_request", { playerName });

    // 要請者にリクエスト送信中を通知
    socket.emit("notification", { message: "参加リクエスト送信中..." });
  }

  /** 参加要請を承認 */
  acceptJoin(): void {
    if (!this.pendingJoin) return;

    const { socket, playerId, name, avatar, onAccepted } = this.pendingJoin;
    this.pendingJoin = null;

    // コールバックで呼び出し元にルーム追跡を通知
    onAccepted?.();

    // 正式にルームに追加
    const player: RoomPlayer = {
      socket,
      id: playerId,
      name,
      isHost: false,
      avatar,
    };

    this.players.push(player);
    socket.join(this.id);

    // イベントハンドラ登録
    this.registerHandlers(socket, playerId);

    // エンジンリセット → 新プレイヤー追加 → ゲーム再開
    this.engine.resetForNewGame();
    this.engine.addPlayer(playerId, name, avatar);
    this.engine.startGame();

    // 要請者に承認通知
    socket.emit("join_request_result", { accepted: true, message: "参加が承認されました！" });

    // 全員にルーム情報 + ゲーム状態を送信
    this.broadcastRoomInfo();
    this.broadcastGameState();
    this.broadcast("notification", { message: `${name}が参加！ゲーム再開！` });
  }

  /** 参加要請を拒否 */
  rejectJoin(): void {
    if (!this.pendingJoin) return;

    const { socket } = this.pendingJoin;
    this.pendingJoin = null;

    socket.emit("join_request_result", { accepted: false, message: "参加が拒否されました" });
  }

  /** エンジン除外を遅延スケジュール（リロード復帰のための猶予：3分） */
  scheduleEngineRemoval(playerId: string): void {
    this.cancelEngineRemoval(playerId);

    this.disconnectedPlayerIds.add(playerId);

    const player = this.players.find((p) => p.id === playerId);
    this.broadcast("notification", {
      message: `${player?.name || "プレイヤー"}が一時切断しました...`,
    });

    const timer = setTimeout(() => {
      this.engineRemovalTimers.delete(playerId);
      this.removePlayerFromGame(playerId);
    }, 180_000);

    this.engineRemovalTimers.set(playerId, timer);

    // 鳴きチャンス中の切断 → 鳴きウィンドウを強制解決
    if (this.engine.phase === "naki_chance") {
      this.resolveNakiIfNeeded();
    }

    // 切断プレイヤーのターンなら自動パスをスケジュール
    this.scheduleAutoPass();
  }

  /** エンジン除外のスケジュールをキャンセル */
  cancelEngineRemoval(playerId: string): void {
    this.disconnectedPlayerIds.delete(playerId);

    const timer = this.engineRemovalTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.engineRemovalTimers.delete(playerId);
    }
  }

  /** ゲームからのみ除外（ルームには残す、切断時用） */
  removePlayerFromGame(playerId: string): void {
    this.disconnectedPlayerIds.delete(playerId);

    const enginePlayer = this.engine.players.find((p) => p.id === playerId);
    if (!enginePlayer) return;

    // スコアを保存（次ラウンド復帰時に使用）
    this.disconnectedScores.set(playerId, enginePlayer.totalScore);

    const phaseBefore = this.engine.phase;
    this.engine.removePlayer(playerId);

    const player = this.players.find((p) => p.id === playerId);
    this.broadcast("notification", {
      message: `${player?.name || "プレイヤー"}が切断しました（5分以内に再接続で次ラウンドから復帰）`,
    });

    // エンジンからプレイヤーが全員いなくなった場合、待機状態に戻す
    if (this.engine.players.length === 0) {
      if (this.nextRoundTimer) {
        clearTimeout(this.nextRoundTimer);
        this.nextRoundTimer = null;
      }
      if (this.spade3CutTimer) {
        clearTimeout(this.spade3CutTimer);
        this.spade3CutTimer = null;
      }
      if (this.eightCutTimer) {
        clearTimeout(this.eightCutTimer);
        this.eightCutTimer = null;
      }
      this.engine.phase = "waiting";
      return;
    }

    if (this.engine.players.length > 0) {
      this.broadcastGameState();
    }
    if (this.engine.phase === "round_end" && phaseBefore !== "round_end") {
      this.endRound();
    } else {
      this.scheduleAutoPass();
    }
  }

  /** プレイヤー退出（ルームからも完全削除） */
  leave(playerId: string): void {
    this.disconnectedPlayerIds.delete(playerId);

    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.socket.leave(this.id);
    }
    this.players = this.players.filter((p) => p.id !== playerId);
    this.disconnectedScores.delete(playerId);

    const phaseBefore = this.engine.phase;
    const wasInEngine = this.engine.players.some((p) => p.id === playerId);
    this.engine.removePlayer(playerId);

    // ボイスチャットからも退出
    if (this.voiceUsers.delete(playerId)) {
      this.broadcast("voice_user_left", { userId: playerId });
    }

    if (this.players.length > 0) {
      // エンジンにまだいた場合のみゲーム状態を再同期
      if (wasInEngine && phaseBefore !== "waiting") {
        this.broadcast("notification", { message: `${player?.name || "プレイヤー"}が退出しました` });
        if (this.engine.players.length > 0) {
          this.broadcastGameState();
        }
        if (this.engine.phase === "round_end" && phaseBefore !== "round_end") {
          this.endRound();
        } else {
          this.scheduleAutoPass();
        }
      }

      // ホスト移譲
      if (!this.players.some((p) => p.isHost)) {
        this.players[0].isHost = true;
      }
      this.broadcastRoomInfo();
    }
  }

  /** 再接続処理 — ソケット差替え + リスナー再登録 + 全員に状態再送信 */
  reconnect(socket: GameSocket, playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;

    // エンジン除外タイマーがあればキャンセル（リロード復帰）
    this.cancelEngineRemoval(playerId);

    // ソケット差替え
    player.socket = socket;
    socket.join(this.id);

    // リスナー再登録
    this.registerHandlers(socket, playerId);

    // 全員にゲーム状態を再送信（ターン情報の同期を保証）
    this.broadcastGameState();
    this.broadcastRoomInfo();

    // 鳴きチャンス中なら intercept_window を再送
    if (this.engine.phase === "naki_chance" && this.engine.field.length > 0) {
      const card = this.engine.field[0];
      const enginePlayer = this.engine.players.find((p) => p.id === playerId);
      if (enginePlayer && canNaki(card, enginePlayer.hand).possible) {
        socket.emit("intercept_window", { card });
      }
    }
  }

  /** 切断中プレイヤーを他のメンバーに通知 */
  markPlayerDisconnected(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      this.broadcast("notification", { message: `${player.name}が切断しました（5分以内に再接続可能）` });
    }
  }

  /** ルーム全体に通知を送信（外部から利用可） */
  notifyAll(message: string): void {
    this.broadcast("notification", { message });
  }

  /** 特定プレイヤーにゲーム状態を送信 */
  sendGameStateTo(player: RoomPlayer): void {
    if (this.engine.phase === "waiting" || this.engine.players.length === 0) return;
    if (!this.engine.currentPlayer) return;
    const scores = this.engine.players.map((p) => ({ id: p.id, name: p.name, score: p.totalScore, avatar: p.avatar }));
    const state: ClientGameState = {
      phase: this.engine.phase,
      hand: this.engine.getHand(player.id),
      field: this.engine.field,
      players: this.engine.getPlayerInfo(player.id),
      currentTurn: this.engine.currentPlayer.id,
      isRevolution: this.engine.isRevolution,
      isElevenBack: this.engine.isElevenBack,
      round: this.engine.round,
      myRank: this.engine.players.find((p) => p.id === player.id)?.rank || "平民",
      nakiCount: this.engine.nakiCount,
      discardCount: this.engine.discardPile.length,
      history: this.engine.discardPile,
      scores,
      exchangeInfo: this.engine.getExchangeInfo(player.id),
    };
    player.socket.emit("game_state", state);
  }

  /** 特定プレイヤーにルーム情報を送信 */
  sendRoomInfoTo(player: RoomPlayer): void {
    const info: RoomInfo = {
      roomId: this.id,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        avatar: p.avatar,
      })),
      maxPlayers: this.maxPlayers,
      isStarted: this.engine.phase !== "waiting",
    };
    player.socket.emit("room_info", info);
  }

  /** playerIdでプレイヤー検索 */
  findPlayer(playerId: string): RoomPlayer | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  /** イベントハンドラ登録 */
  private registerHandlers(socket: GameSocket, playerId: string): void {
    socket.on("start_game", () => {
      const player = this.players.find((p) => p.id === playerId);
      if (!player?.isHost) {
        socket.emit("game_error", { message: "ホストのみ開始できます" });
        return;
      }
      if (this.players.length < 3) {
        socket.emit("game_error", { message: "3人以上で開始できます" });
        return;
      }

      this.engine.startGame();
      this.broadcastGameState();
      this.broadcast("notification", { message: "ゲーム開始！" });
    });

    socket.on("play_card", (data) => {
      const result = this.engine.playCards(playerId, data.cardIds);
      if (!result.success) {
        socket.emit("game_error", { message: result.error! });
        return;
      }

      if (result.revolution && result.eightCut) {
        // 革命+8切り同時: 1つの通知にまとめる（8切り演出は出さない）
        this.broadcast("notification", { message: "🔄 革命発動！8切り！" });
      } else {
        if (result.revolution) {
          this.broadcast("notification", { message: "🔄 革命発動！" });
        }

        if (result.eightCut) {
          this.broadcast("notification", { message: "✂️ 8切り！", cards: result.eightCutCards });
        }
      }

      if (result.elevenBack) {
        const state = this.engine.isElevenBack ? "発動！" : "解除！";
        this.broadcast("notification", { message: `⏬ イレブンバック${state}` });
      }

      if (result.spade3Cut) {
        this.broadcast("notification", { message: "♠3でジョーカー返し！" });
      }

      if (result.playerFinished) {
        const player = this.players.find((p) => p.id === playerId);
        const enginePlayer = this.engine.players.find((p) => p.id === playerId);
        if (enginePlayer?.finishOrder === 1) {
          if (enginePlayer.prevRank === "大貧民") {
            this.broadcast("notification", { message: `${player?.name}が下剋上！` });
          } else {
            this.broadcast("notification", { message: `${player?.name}が大富豪！` });
          }
        } else {
          this.broadcast("notification", { message: `🎉 ${player?.name}が上がり！` });
        }
      }

      if (result.miyakoOchi) {
        this.broadcast("notification", { message: `都落ち！${result.miyakoOchi.playerName}のカードは破棄！` });
      }

      this.broadcastGameState();

      if (result.spade3Cut) {
        // ♠3を場に表示した状態で3秒待ってから流す
        this.spade3CutTimer = setTimeout(() => {
          this.spade3CutTimer = null;
          this.engine.resolveSpade3Cut();
          this.broadcastGameState();
          if (this.engine.phase === "round_end") {
            this.endRound();
          } else {
            this.scheduleAutoPass();
          }
        }, 3000);
      } else if (result.eightCut) {
        // 8切り: 場のカードを3.5秒表示してから流す
        this.eightCutTimer = setTimeout(() => {
          this.eightCutTimer = null;
          this.engine.resolveEightCut();
          this.broadcastGameState();
          if (this.engine.phase === "round_end") {
            this.endRound();
          } else {
            this.scheduleAutoPass();
          }
        }, 3500);
      } else if (result.nakiChance) {
        this.startNakiWindow();
      } else if (this.engine.phase === "round_end") {
        this.endRound();
      } else {
        this.scheduleAutoPass();
      }
    });

    socket.on("pass", () => {
      const result = this.engine.doPass(playerId);
      if (!result.success) {
        socket.emit("game_error", { message: result.error! });
        return;
      }

      if (result.fieldCleared) {
        this.broadcast("notification", { message: "場が流れました" });
      }

      this.broadcastGameState();

      if (this.engine.phase === "round_end") {
        this.endRound();
      } else {
        this.scheduleAutoPass();
      }
    });

    socket.on("intercept", () => {
      const result = this.engine.doIntercept(playerId);
      if (!result.success) {
        socket.emit("game_error", { message: result.error! });
        return;
      }

      const player = this.players.find((p) => p.id === playerId);
      this.broadcast("intercept_result", {
        playerId,
        playerName: player?.name || "",
        cards: result.cards || [],
      });

      if (result.playerFinished) {
        const enginePlayer = this.engine.players.find((p) => p.id === playerId);
        if (enginePlayer?.finishOrder === 1) {
          if (enginePlayer.prevRank === "大貧民") {
            this.broadcast("notification", { message: `${player?.name}が下剋上！` });
          } else {
            this.broadcast("notification", { message: `${player?.name}が大富豪！` });
          }
        } else {
          this.broadcast("notification", { message: `🎉 ${player?.name}が鳴き上がり！` });
        }
      }

      if (result.miyakoOchi) {
        this.broadcast("notification", { message: `都落ち！${result.miyakoOchi.playerName}のカードは破棄！` });
      }

      this.broadcastGameState();

      if (this.engine.phase === "round_end") {
        this.endRound();
      }
    });

    socket.on("skip_intercept", () => {
      if (this.engine.phase !== "naki_chance") return;
      // 鳴ける人のみスキップを受け付ける
      const enginePlayer = this.engine.players.find((p) => p.id === playerId);
      if (!enginePlayer || enginePlayer.finished) return;
      const card = this.engine.field[0];
      if (!card || !canNaki(card, enginePlayer.hand).possible) return;
      const nakiResult = this.engine.resolveNakiWindow();
      if (nakiResult.eightCut) {
        this.broadcast("notification", { message: "✂️ 8切り！", cards: nakiResult.eightCutCards });
      }
      this.broadcastGameState();
      if ((this.engine.phase as string) === "round_end") {
        this.endRound();
      } else {
        this.scheduleAutoPass();
      }
    });

    socket.on("card_exchange", (data) => {
      if (this.engine.phase !== "card_exchange") {
        socket.emit("game_error", { message: "交換フェーズではありません" });
        return;
      }
      const result = this.engine.doCardExchange(playerId, data.cardIds);
      if (!result.success) {
        socket.emit("game_error", { message: result.error! });
        return;
      }
      this.broadcastGameState();
      if (result.allDone) {
        this.broadcast("notification", { message: `ラウンド${this.engine.round} 開始！` });
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
      if (data.accept) {
        this.acceptJoin();
      } else {
        this.rejectJoin();
      }
    });

    socket.on("heartbeat", () => {
      // Engine.IOが自動でpingTimeoutをリセットするため処理不要
    });

    socket.on("voice_join", () => {
      this.voiceUsers.add(playerId);
      const player = this.players.find((p) => p.id === playerId);
      // 既存ボイスユーザー一覧を送信
      const users = Array.from(this.voiceUsers)
        .filter((id) => id !== playerId)
        .map((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return { id, name: p?.name || "" };
        });
      socket.emit("voice_users", { users });
      // 全員に参加通知
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

  /** 切断中プレイヤーのターンなら自動パスをスケジュール */
  private scheduleAutoPass(): void {
    if (this.autoPassTimer) return;

    this.autoPassTimer = setTimeout(() => {
      this.autoPassTimer = null;
      this.autoPassIfDisconnected();
    }, 1000);
  }

  /** 切断中プレイヤーが現在のターンなら自動パスを実行 */
  private autoPassIfDisconnected(): void {
    if (this.engine.phase !== "playing") return;
    if (!this.engine.currentPlayer) return;

    const currentId = this.engine.currentPlayer.id;
    if (!this.disconnectedPlayerIds.has(currentId)) return;

    // 接続中のアクティブプレイヤーが0人なら無限ループ防止のため停止
    const hasConnectedActive = this.engine.players.some(
      (p) => !p.finished && !this.disconnectedPlayerIds.has(p.id)
    );
    if (!hasConnectedActive) return;

    const result = this.engine.doPass(currentId);
    if (!result.success) return;

    const player = this.players.find((p) => p.id === currentId);
    this.broadcast("notification", {
      message: `${player?.name || "プレイヤー"}は切断中のため自動パス`,
    });

    if (result.fieldCleared) {
      this.broadcast("notification", { message: "場が流れました" });
    }

    this.broadcastGameState();

    if ((this.engine.phase as string) === "round_end") {
      this.endRound();
    } else {
      // 次のターンも切断中プレイヤーかもしれないので再チェック
      this.scheduleAutoPass();
    }
  }

  /** 鳴きウィンドウ開始（鳴ける人のみに送信） */
  private startNakiWindow(): void {
    const card = this.engine.field[0];
    for (const rp of this.players) {
      const ep = this.engine.players.find((p) => p.id === rp.id);
      if (ep && !ep.finished && canNaki(card, ep.hand).possible) {
        rp.socket.emit("intercept_window", { card });
      }
    }
  }

  /** 鳴きウィンドウを強制解決（切断時用） */
  private resolveNakiIfNeeded(): void {
    if (this.engine.phase !== "naki_chance") return;
    const nakiResult = this.engine.resolveNakiWindow();
    if (nakiResult.eightCut) {
      this.broadcast("notification", { message: "✂️ 8切り！", cards: nakiResult.eightCutCards });
    }
    this.broadcastGameState();
    if ((this.engine.phase as string) === "round_end") {
      this.endRound();
    } else {
      this.scheduleAutoPass();
    }
  }


  /** ラウンド終了処理 → 3秒後に次のラウンド自動開始 */
  private endRound(): void {
    const rankings = this.engine.players.map((p) => ({
      playerId: p.id,
      rank: p.rank,
      prevRank: p.prevRank,
    }));

    // 大貧民の通知を全員に送信（都落ちが発生した場合は都落ち演出で代替するため送らない）
    if (!this.engine.miyakoOchiResult) {
      const daihinminPlayer = this.engine.players.find((p) => p.rank === "大貧民");
      if (daihinminPlayer) {
        const roomPlayer = this.players.find((rp) => rp.id === daihinminPlayer.id);
        if (roomPlayer) {
          this.broadcast("notification", { message: `${roomPlayer.name}が大貧民！` });
        }
      }
    }

    this.broadcast("round_end", { rankings });

    // 3秒後に次のラウンド開始
    this.nextRoundTimer = setTimeout(() => {
      this.nextRoundTimer = null;

      // 切断後に再接続したプレイヤーをエンジンに再追加
      for (const rp of this.players) {
        if (!this.engine.players.find((ep) => ep.id === rp.id) && rp.socket.connected) {
          const savedScore = this.disconnectedScores.get(rp.id) || 0;
          this.engine.addPlayer(rp.id, rp.name, rp.avatar);
          const ep = this.engine.players.find((p) => p.id === rp.id);
          if (ep) ep.totalScore = savedScore;
          this.disconnectedScores.delete(rp.id);
        }
      }

      // プレイヤーが2人未満なら次ラウンド開始不可 → 待機状態に戻す
      if (this.engine.players.length < 2) {
        this.engine.phase = "waiting";
        this.broadcastRoomInfo();
        return;
      }

      this.engine.startNextRound();

      // 大貧民/貧民の自動交換を実行
      if (this.engine.phase === "card_exchange") {
        this.engine.executeAutoExchanges();
      }

      this.broadcastGameState();
      if (this.engine.phase === "playing") {
        this.broadcast("notification", { message: `ラウンド${this.engine.round} 開始！` });
      } else if (this.engine.phase === "card_exchange") {
        this.broadcast("notification", { message: "カード交換フェーズ" });
      }
    }, 3000);
  }

  /** ゲーム状態を各プレイヤーに送信（手札は本人のみ） */
  private broadcastGameState(): void {
    if (this.engine.players.length === 0) return;
    if (!this.engine.currentPlayer) return;
    for (const player of this.players) {
      const scores = this.engine.players.map((p) => ({ id: p.id, name: p.name, score: p.totalScore, avatar: p.avatar }));
      const state: ClientGameState = {
        phase: this.engine.phase,
        hand: this.engine.getHand(player.id),
        field: this.engine.field,
        players: this.engine.getPlayerInfo(player.id),
        currentTurn: this.engine.currentPlayer.id,
        isRevolution: this.engine.isRevolution,
        isElevenBack: this.engine.isElevenBack,
        round: this.engine.round,
        myRank: this.engine.players.find((p) => p.id === player.id)?.rank || "平民",
        nakiCount: this.engine.nakiCount,
        discardCount: this.engine.discardPile.length,
        history: this.engine.discardPile,
        scores,
        exchangeInfo: this.engine.getExchangeInfo(player.id),
      };
      player.socket.emit("game_state", state);
    }

    // 切断中プレイヤーのターンなら自動パスをスケジュール
    this.scheduleAutoPass();
  }

  /** ルーム情報を全員に送信 */
  private broadcastRoomInfo(): void {
    const info: RoomInfo = {
      roomId: this.id,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        avatar: p.avatar,
      })),
      maxPlayers: this.maxPlayers,
      isStarted: this.engine.phase !== "waiting",
    };
    this.io.to(this.id).emit("room_info", info);
  }

  /** ルーム全体にイベント送信 */
  private broadcast<E extends keyof ServerToClientEvents>(
    event: E,
    data: Parameters<ServerToClientEvents[E]>[0]
  ): void {
    this.io.to(this.id).emit(event, data as never);
  }

  get isEmpty(): boolean {
    return this.players.length === 0;
  }

  get playerCount(): number {
    return this.players.length;
  }
}
