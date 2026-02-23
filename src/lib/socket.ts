import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/events";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// HTTPS プロキシ経由の場合は同一オリジン、それ以外は env の値を使用
function getServerUrl(): string {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL;
  if (typeof window !== "undefined" && window.location.protocol === "https:") return "";
  return "http://localhost:3001";
}
const SERVER_URL = getServerUrl();
const SESSION_KEY = "naki-daifugo-sessionId";

// --- sessionStorage ヘルパー ---

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

export function storeSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, sessionId);
}

export function clearSessionId(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

// --- localStorage: 最後のルーム情報（再参加用） ---

const LAST_ROOM_KEY = "naki-daifugo-lastRoom";

export interface LastRoomInfo {
  roomId: string;
  playerName: string;
  avatar?: string;
}

export function getLastRoom(): LastRoomInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_ROOM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeLastRoom(roomId: string, playerName: string, avatar?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ roomId, playerName, avatar }));
}

export function clearLastRoom(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_ROOM_KEY);
}

// --- Socket管理 ---

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // 再接続のたびに最新のsessionIdを送るよう関数にする
      auth: (cb) => {
        const sessionId = getStoredSessionId();
        cb(sessionId ? { sessionId } : {});
      },
    });
  }
  return socket;
}

export function connectSocket(): GameSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** 意図的離脱: sessionStorageもクリア */
export function disconnectAndClearSession(): void {
  clearSessionId();
  disconnectSocket();
}

// --- Web Worker keepalive ---

let keepAliveWorker: Worker | null = null;
let httpKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

export function startKeepAlive(s: GameSocket): void {
  stopKeepAlive();

  // Web Worker起動
  try {
    keepAliveWorker = new Worker("/keepalive-worker.js");
    keepAliveWorker.onmessage = () => {
      if (s.connected) s.volatile.emit("heartbeat");
    };
  } catch { /* Worker非対応環境は無視 */ }

  // HTTP keepalive: Renderのスピンダウン防止（2分間隔でヘルスチェック）
  httpKeepAliveTimer = setInterval(() => {
    fetch("/api/health").catch(() => {});
  }, 2 * 60_000);

  // visibilitychange: タブ復帰時に接続チェック
  document.addEventListener("visibilitychange", handleVisibility);

  // socket接続/切断でWorker制御
  s.on("connect", () => keepAliveWorker?.postMessage("start"));
  s.on("disconnect", () => keepAliveWorker?.postMessage("stop"));

  if (s.connected) keepAliveWorker?.postMessage("start");
}

// iOS対策: バックグラウンド経過時間の計測
let hiddenAt: number | null = null;
const BG_THRESHOLD_MS = 30_000; // iOSがWebSocketを切断する目安

function handleVisibility(): void {
  if (!socket) return;

  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }

  // --- visible に復帰 ---
  const bgDuration = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = null;

  if (!socket.connected) {
    // 切断済み → 再接続
    socket.connect();
  } else if (bgDuration > BG_THRESHOLD_MS) {
    // iOS: 30秒超のバックグラウンドではWebSocketが確実に死んでいる
    // connected=true のゴースト状態を解消するため即座に再接続
    console.log(`[keepalive] BG ${Math.round(bgDuration / 1000)}秒 → 強制再接続`);
    socket.disconnect();
    socket.connect();
  } else {
    // 短時間のバックグラウンド → heartbeatで死活確認
    socket.volatile.emit("heartbeat");
  }
}

export function stopKeepAlive(): void {
  keepAliveWorker?.postMessage("stop");
  keepAliveWorker?.terminate();
  keepAliveWorker = null;
  if (httpKeepAliveTimer) {
    clearInterval(httpKeepAliveTimer);
    httpKeepAliveTimer = null;
  }
  document.removeEventListener("visibilitychange", handleVisibility);
}
