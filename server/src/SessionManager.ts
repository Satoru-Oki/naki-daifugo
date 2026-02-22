import { randomUUID } from "crypto";

export interface SessionData {
  sessionId: string;
  playerId: string;
  roomId: string;
  playerName: string;
}

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private playerToSession = new Map<string, string>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** 新規セッション作成 */
  createSession(roomId: string, playerName: string): SessionData {
    const sessionId = randomUUID();
    const playerId = randomUUID();
    const data: SessionData = { sessionId, playerId, roomId, playerName };
    this.sessions.set(sessionId, data);
    this.playerToSession.set(playerId, sessionId);
    return data;
  }

  /** 既存playerIdでセッション作成（名前マッチ再接続用） */
  createSessionForPlayer(playerId: string, roomId: string, playerName: string): SessionData {
    // 既存セッションがあれば削除
    const oldSessionId = this.playerToSession.get(playerId);
    if (oldSessionId) {
      this.removeSession(oldSessionId);
    }
    const sessionId = randomUUID();
    const data: SessionData = { sessionId, playerId, roomId, playerName };
    this.sessions.set(sessionId, data);
    this.playerToSession.set(playerId, sessionId);
    return data;
  }

  /** playerIdからセッションIDを検索 */
  findSessionByPlayerId(playerId: string): string | undefined {
    return this.playerToSession.get(playerId);
  }

  /** セッション取得 */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /** 切断マーク → grace period開始（30秒後にonExpire実行） */
  markDisconnected(sessionId: string, onExpire: () => void): void {
    // 既存タイマーがあればクリア
    this.clearTimer(sessionId);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(sessionId);
      onExpire();
      this.removeSession(sessionId);
    }, 5 * 60_000);

    this.disconnectTimers.set(sessionId, timer);
  }

  /** 再接続マーク → タイマーキャンセル */
  markReconnected(sessionId: string): void {
    this.clearTimer(sessionId);
  }

  /** セッション削除 */
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.playerToSession.delete(session.playerId);
    }
    this.clearTimer(sessionId);
    this.sessions.delete(sessionId);
  }

  /** grace period中かどうか */
  isDisconnected(sessionId: string): boolean {
    return this.disconnectTimers.has(sessionId);
  }

  private clearTimer(sessionId: string): void {
    const timer = this.disconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(sessionId);
    }
  }
}
