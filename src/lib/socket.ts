import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/events";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// 接続先URLを決定: ブラウザのホスト名を使い、バックエンドのポートに接続
function getServerUrl(): string {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL;
  if (typeof window !== "undefined" && window.location.protocol === "https:") return "";
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3001`;
  }
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

// --- 最後のルーム情報（再参加用） ---
// sessionStorage（タブ独立）に保存し、別タブ同時プレイでの上書きを防止
// localStorage にも保存し、タブを閉じても「ゲームに戻る」を可能にする

const LAST_ROOM_SESSION_KEY = "naki-daifugo-lastRoom";
const LAST_ROOM_LOCAL_KEY = "naki-daifugo-lastRoom-persist";

export interface LastRoomInfo {
  roomId: string;
  playerName: string;
  avatar?: string;
  gameType?: "daifugo" | "poker";
}

/** 現タブのlastRoomを取得（sessionStorage優先 → localStorage fallback） */
export function getLastRoom(): LastRoomInfo | null {
  if (typeof window === "undefined") return null;
  // sessionStorage（同一タブ）を優先
  const sessionRaw = sessionStorage.getItem(LAST_ROOM_SESSION_KEY);
  if (sessionRaw) {
    try { return JSON.parse(sessionRaw); } catch {}
  }
  // fallback: localStorage（タブ復帰・再起動後のゲームに戻る用）
  const localRaw = localStorage.getItem(LAST_ROOM_LOCAL_KEY);
  if (localRaw) {
    try { return JSON.parse(localRaw); } catch {}
  }
  return null;
}

export function storeLastRoom(roomId: string, playerName: string, avatar?: string, gameType?: "daifugo" | "poker"): void {
  if (typeof window === "undefined") return;
  const data = JSON.stringify({ roomId, playerName, avatar, gameType });
  sessionStorage.setItem(LAST_ROOM_SESSION_KEY, data);
  localStorage.setItem(LAST_ROOM_LOCAL_KEY, data);
}

export function clearLastRoom(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LAST_ROOM_SESSION_KEY);
  localStorage.removeItem(LAST_ROOM_LOCAL_KEY);
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
let keepAliveConnectHandler: (() => void) | null = null;
let keepAliveDisconnectHandler: (() => void) | null = null;
let keepAliveSocket: GameSocket | null = null;

export function startKeepAlive(s: GameSocket): void {
  stopKeepAlive();

  keepAliveSocket = s;

  // Web Worker起動
  try {
    keepAliveWorker = new Worker("/keepalive-worker.js");
    keepAliveWorker.onmessage = () => {
      if (s.connected) s.volatile.emit("heartbeat");
    };
  } catch { /* Worker非対応環境は無視 */ }

  // HTTP keepalive: Renderのスピンダウン防止（2分間隔でヘルスチェック）
  httpKeepAliveTimer = setInterval(() => {
    fetch(`${SERVER_URL}/api/health`).catch(() => {});
  }, 2 * 60_000);

  // visibilitychange: タブ復帰時に接続チェック
  document.addEventListener("visibilitychange", handleVisibility);

  // socket接続/切断でWorker制御（参照を保持してクリーンアップ可能に）
  keepAliveConnectHandler = () => keepAliveWorker?.postMessage("start");
  keepAliveDisconnectHandler = () => keepAliveWorker?.postMessage("stop");
  s.on("connect", keepAliveConnectHandler);
  s.on("disconnect", keepAliveDisconnectHandler);

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
  // socketリスナーをクリーンアップ（蓄積を防止）
  if (keepAliveSocket) {
    if (keepAliveConnectHandler) keepAliveSocket.off("connect", keepAliveConnectHandler);
    if (keepAliveDisconnectHandler) keepAliveSocket.off("disconnect", keepAliveDisconnectHandler);
    keepAliveSocket = null;
  }
  keepAliveConnectHandler = null;
  keepAliveDisconnectHandler = null;

  keepAliveWorker?.postMessage("stop");
  keepAliveWorker?.terminate();
  keepAliveWorker = null;
  if (httpKeepAliveTimer) {
    clearInterval(httpKeepAliveTimer);
    httpKeepAliveTimer = null;
  }
  document.removeEventListener("visibilitychange", handleVisibility);
}
