import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { GameRoom } from "./GameRoom";
import { SessionManager } from "./SessionManager";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/events";

// Next.js アプリ初期化
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, dir: process.cwd() });
const handle = nextApp.getRequestHandler();

async function main() {
  await nextApp.prepare();

  const app = express();
  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? true
        : process.env.CLIENT_URL || [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://192.168.40.136:3000",
            "http://192.168.40.136:3001",
            "https://localhost:3443",
            "https://192.168.40.136:3443",
          ],
      methods: ["GET", "POST"],
    },
    pingInterval: 10_000,
    pingTimeout: 20_000,
  });

  // ルーム管理
  const rooms = new Map<string, GameRoom>();

  // セッション管理
  const sessionManager = new SessionManager();

  // socketId → sessionId のマッピング
  const socketToSession = new Map<string, string>();

  // ヘルスチェック
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", rooms: rooms.size });
  });

  // ルーム一覧API
  app.get("/api/rooms", (_req, res) => {
    const roomList = Array.from(rooms.values())
      .filter((r) => !r.isEmpty)
      .map((r) => ({
        id: r.id,
        playerCount: r.playerCount,
        maxPlayers: r.maxPlayers,
        isStarted: r.engine.phase !== "waiting",
      }));
    res.json(roomList);
  });

  io.on("connection", (socket) => {
    console.log(`[接続] ${socket.id}`);

    let currentRoom: GameRoom | null = null;
    let currentSessionId: string | null = null;

    // 再接続チェック: auth.sessionId があればセッション復帰を試みる
    const authSessionId = socket.handshake.auth?.sessionId as string | undefined;
    if (authSessionId) {
      const session = sessionManager.getSession(authSessionId);
      if (session) {
        const room = rooms.get(session.roomId);
        if (room && room.findPlayer(session.playerId)) {
          // sessionStorage由来 → 同タブリロード → 再接続許可
          sessionManager.markReconnected(authSessionId);

          // 旧ソケットのdisconnectハンドラを無効化
          for (const [sockId, sessId] of socketToSession.entries()) {
            if (sessId === authSessionId && sockId !== socket.id) {
              socketToSession.delete(sockId);
            }
          }

          socketToSession.set(socket.id, authSessionId);
          currentSessionId = authSessionId;
          currentRoom = room;

          socket.emit("session", { sessionId: session.sessionId, playerId: session.playerId });
          room.reconnect(socket, session.playerId);
          socket.emit("reconnected", { roomId: session.roomId, playerName: session.playerName });

          console.log(`[再接続] ${session.playerName} → ${session.roomId}`);
          room.notifyAll(`${session.playerName}が再接続しました`);
        } else {
          // ルームが消えている（サーバー再起動等）
          console.log(`[セッション切れ] sessionId=${authSessionId} ルーム/プレイヤー不在`);
          sessionManager.removeSession(authSessionId);
          socket.emit("session_expired");
        }
      } else {
        // セッション自体が存在しない（サーバー再起動でインメモリ消失）
        console.log(`[セッション切れ] sessionId=${authSessionId} セッション不在`);
        socket.emit("session_expired");
      }
    }

    socket.on("join_room", ({ roomId, playerName, avatar }) => {
      // 既にルームにいる場合は退出
      if (currentRoom && currentSessionId) {
        const session = sessionManager.getSession(currentSessionId);
        if (session) {
          currentRoom.leave(session.playerId);
          if (currentRoom.isEmpty) rooms.delete(currentRoom.id);
        }
        sessionManager.removeSession(currentSessionId);
        socketToSession.delete(socket.id);
        currentRoom = null;
        currentSessionId = null;
      }

      // ルーム取得 or 新規作成
      let room = rooms.get(roomId);
      if (!room) {
        room = new GameRoom(io, roomId);
        rooms.set(roomId, room);
        console.log(`[ルーム作成] ${roomId}`);
      }

      // 名前マッチ再接続: 同名プレイヤーがいれば復帰（全フェーズ対応）
      const existingPlayer = room.players.find((p) => p.name === playerName);
      if (existingPlayer) {
        console.log(`[名前マッチ発見] ${playerName} (socket.connected=${existingPlayer.socket.connected}, phase=${room.engine.phase})`);

        // 既存セッションのgrace periodをキャンセル + セッション削除
        const oldSessionId = sessionManager.findSessionByPlayerId(existingPlayer.id);
        if (oldSessionId) {
          sessionManager.markReconnected(oldSessionId);
          sessionManager.removeSession(oldSessionId);
        }

        // 旧ソケットのdisconnectハンドラがleave/markDisconnectedしないよう、
        // socketToSessionから旧socketIdを削除して無効化
        for (const [sockId, sessId] of socketToSession.entries()) {
          if (oldSessionId && sessId === oldSessionId) {
            socketToSession.delete(sockId);
          }
        }

        // 旧ソケットがまだ接続中なら強制切断（ハンドラは無効化済みなので安全）
        if (existingPlayer.socket.connected) {
          existingPlayer.socket.disconnect(true);
        }

        // 既存playerIdで新セッション作成
        const session = sessionManager.createSessionForPlayer(existingPlayer.id, roomId, playerName);
        socketToSession.set(socket.id, session.sessionId);
        currentSessionId = session.sessionId;
        currentRoom = room;

        socket.emit("session", { sessionId: session.sessionId, playerId: session.playerId });
        room.reconnect(socket, existingPlayer.id);
        socket.emit("reconnected", { roomId, playerName });

        console.log(`[名前マッチ再接続] ${playerName} → ${roomId}`);
        room.notifyAll(`${playerName}が再接続しました`);
        return;
      }

      // 通常の新規参加フロー
      const session = sessionManager.createSession(roomId, playerName);
      socketToSession.set(socket.id, session.sessionId);
      currentSessionId = session.sessionId;

      // セッション情報をクライアントに通知
      socket.emit("session", { sessionId: session.sessionId, playerId: session.playerId });

      // ゲーム中かつ満員でない場合は参加要請
      if (room.engine.phase !== "waiting" && room.playerCount < room.maxPlayers) {
        room.requestJoin(socket, session.playerId, playerName, avatar, () => {
          currentRoom = room;
          console.log(`[参加承認] ${playerName} → ${roomId} (${room!.playerCount}人)`);
        });
        console.log(`[参加要請] ${playerName} → ${roomId}`);
        return;
      }

      const joined = room.join(socket, session.playerId, playerName, avatar);
      if (joined) {
        currentRoom = room;
        console.log(`[入室] ${playerName} → ${roomId} (${room.playerCount}人)`);
      } else {
        socket.emit("game_error", { message: "ルームに参加できません（満員）" });
        sessionManager.removeSession(session.sessionId);
        socketToSession.delete(socket.id);
        currentSessionId = null;
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[切断] ${socket.id} reason=${reason}`);

      // socketToSessionに無い場合は既に名前マッチ再接続で無効化済み
      if (!socketToSession.has(socket.id)) {
        console.log(`[切断無視] ${socket.id}: 既に無効化済み`);
        currentRoom = null;
        currentSessionId = null;
        return;
      }

      if (!currentRoom || !currentSessionId) return;

      const session = sessionManager.getSession(currentSessionId);
      if (!session) {
        currentRoom = null;
        currentSessionId = null;
        return;
      }

      const isInGame = currentRoom.engine.phase !== "waiting";

      if (isInGame) {
        // ゲーム中: 5秒の猶予後にエンジンから除外（リロード復帰に対応）
        currentRoom.scheduleEngineRemoval(session.playerId);
        const roomRef = currentRoom;
        sessionManager.markDisconnected(currentSessionId, () => {
          // 5分経過 → ルームからも完全退出
          console.log(`[grace period切れ] ${session.playerName} → ${session.roomId}`);
          roomRef.cancelEngineRemoval(session.playerId);
          roomRef.removePlayerFromGame(session.playerId);
          roomRef.leave(session.playerId);
          if (roomRef.isEmpty) {
            rooms.delete(roomRef.id);
            console.log(`[ルーム削除] ${roomRef.id}`);
          }
        });
      } else {
        // 待機中: 即退出
        currentRoom.leave(session.playerId);
        if (currentRoom.isEmpty) {
          rooms.delete(currentRoom.id);
          console.log(`[ルーム削除] ${currentRoom.id}`);
        }
        sessionManager.removeSession(currentSessionId);
      }

      socketToSession.delete(socket.id);
      currentRoom = null;
      currentSessionId = null;
    });
  });

  // Next.js キャッチオール（Express ルートより後に配置）
  app.all("/{*path}", (req, res) => handle(req, res));

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`🀄 鳴き大富豪サーバー起動: http://localhost:${PORT}`);
  });
}

main().catch(console.error);
