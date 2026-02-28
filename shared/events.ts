import type { GameCard, GameState, ChatMessage, PlayerRank } from "./types";

/** クライアント → サーバー */
export interface ClientToServerEvents {
  join_room: (data: { roomId: string; playerName: string; avatar?: string }) => void;
  leave_room: () => void;
  play_card: (data: { cardIds: string[] }) => void;
  pass: () => void;
  intercept: () => void;
  skip_intercept: () => void;
  card_exchange: (data: { cardIds: string[] }) => void;
  chat_message: (data: { text: string }) => void;
  quick_message: (data: { text: string }) => void;
  voice_stamp: (data: { stampId: string }) => void;
  heartbeat: () => void;
  start_game: () => void;
  join_request_response: (data: { accept: boolean }) => void;
  voice_join: () => void;
  voice_leave: () => void;
  voice_signal: (data: { targetId: string; signal: unknown }) => void;
}

/** サーバー → クライアント */
export interface ServerToClientEvents {
  game_state: (state: ClientGameState) => void;
  intercept_window: (data: { card: GameCard }) => void;
  intercept_result: (data: { playerId: string; playerName: string; cards: GameCard[] }) => void;
  round_end: (data: { rankings: { playerId: string; rank: PlayerRank; prevRank: PlayerRank }[] }) => void;
  chat_message: (data: ChatMessage) => void;
  session: (data: { sessionId: string; playerId: string }) => void;
  reconnected: (data: { roomId: string; playerName: string }) => void;
  game_error: (data: { message: string }) => void;
  room_info: (data: RoomInfo) => void;
  player_joined: (data: { playerId: string; playerName: string }) => void;
  player_left: (data: { playerId: string }) => void;
  notification: (data: { message: string; cards?: GameCard[] }) => void;
  session_expired: () => void;
  replaced: () => void;
  join_request: (data: { playerName: string }) => void;
  join_request_result: (data: { accepted: boolean; message: string }) => void;
  voice_stamp: (data: { fromId: string; fromName: string; stampId: string }) => void;
  voice_user_joined: (data: { userId: string; userName: string }) => void;
  voice_user_left: (data: { userId: string }) => void;
  voice_signal: (data: { fromId: string; signal: unknown }) => void;
  voice_users: (data: { users: { id: string; name: string }[] }) => void;
}

/** クライアントに送信するゲーム状態（手札は自分のもののみ） */
export interface ClientGameState {
  phase: GameState["phase"];
  hand: GameCard[];
  field: GameCard[];
  players: {
    id: string;
    name: string;
    cardCount: number;
    rank: PlayerRank;
    passed: boolean;
    isCurrentTurn: boolean;
    finished: boolean;
    totalScore: number;
    avatar?: string;
  }[];
  scores: { id: string; name: string; score: number; avatar?: string }[];
  currentTurn: string;
  isRevolution: boolean;
  isElevenBack: boolean;
  round: number;
  myRank: PlayerRank;
  nakiCount: number;
  discardCount: number;
  history: GameCard[];
  exchangeInfo?: {
    needToGive: number;        // 自分が渡す必要がある枚数 (0/1/2)
    receivedCards: GameCard[];  // 受け取ったカード（自動交換分）
    waitingFor: string[];       // まだ交換を完了していないプレイヤー名
  };
}

/** ルーム情報 */
export interface RoomInfo {
  roomId: string;
  players: { id: string; name: string; isHost: boolean; avatar?: string }[];
  maxPlayers: number;
  isStarted: boolean;
}
