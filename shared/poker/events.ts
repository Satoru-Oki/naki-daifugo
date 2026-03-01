import type { PokerClientState, PokerCard, PokerAction } from "./types";
import type { ChatMessage } from "../types";

/** ポーカー: クライアント → サーバー */
export interface PokerClientToServerEvents {
  join_room: (data: { roomId: string; playerName: string; avatar?: string; gameType: "poker" }) => void;
  leave_room: () => void;
  poker_action: (data: { action: PokerAction; amount?: number }) => void;
  start_game: () => void;
  chat_message: (data: { text: string }) => void;
  quick_message: (data: { text: string }) => void;
  voice_stamp: (data: { stampId: string }) => void;
  heartbeat: () => void;
  join_request_response: (data: { accept: boolean }) => void;
  voice_join: () => void;
  voice_leave: () => void;
  voice_signal: (data: { targetId: string; signal: unknown }) => void;
}

/** ポーカー: サーバー → クライアント */
export interface PokerServerToClientEvents {
  poker_state: (state: PokerClientState) => void;
  chat_message: (data: ChatMessage) => void;
  session: (data: { sessionId: string; playerId: string }) => void;
  reconnected: (data: { roomId: string; playerName: string }) => void;
  game_error: (data: { message: string }) => void;
  room_info: (data: PokerRoomInfo) => void;
  player_joined: (data: { playerId: string; playerName: string }) => void;
  player_left: (data: { playerId: string }) => void;
  notification: (data: { message: string }) => void;
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

/** ポーカールーム情報 */
export interface PokerRoomInfo {
  roomId: string;
  players: { id: string; name: string; isHost: boolean; avatar?: string }[];
  maxPlayers: number;
  isStarted: boolean;
  gameType: "poker";
}
