import type { Card, Suit, Rank } from "../types";

/** ポーカーで使うカード（Jokerなし） */
export type PokerCard = Card;

/** ゲームフェーズ */
export type PokerPhase =
  | "waiting"
  | "pre_flop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "hand_end";

/** プレイヤーアクション */
export type PokerAction = "fold" | "check" | "call" | "raise" | "all_in";

/** ハンドランク（弱→強） */
export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

/** ハンドランク日本語表示 */
export const HAND_RANK_LABEL: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: "ハイカード",
  [HandRank.ONE_PAIR]: "ワンペア",
  [HandRank.TWO_PAIR]: "ツーペア",
  [HandRank.THREE_OF_A_KIND]: "スリーカード",
  [HandRank.STRAIGHT]: "ストレート",
  [HandRank.FLUSH]: "フラッシュ",
  [HandRank.FULL_HOUSE]: "フルハウス",
  [HandRank.FOUR_OF_A_KIND]: "フォーカード",
  [HandRank.STRAIGHT_FLUSH]: "ストレートフラッシュ",
  [HandRank.ROYAL_FLUSH]: "ロイヤルフラッシュ",
};

/** 評価されたハンド */
export interface EvaluatedHand {
  rank: HandRank;
  /** ランク内比較用の値（大きいほど強い） */
  value: number;
  /** 最強5枚 */
  bestCards: PokerCard[];
  label: string;
}

/** サーバー内部のプレイヤー状態 */
export interface PokerPlayerState {
  id: string;
  name: string;
  chips: number;
  holeCards: PokerCard[];
  currentBet: number;
  totalBetThisHand: number;
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
  seatIndex: number;
  avatar?: string;
}

/** クライアントに送る他プレイヤー情報 */
export interface PokerPlayerInfo {
  id: string;
  name: string;
  chips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isCurrentTurn: boolean;
  seatIndex: number;
  avatar?: string;
  /** ショーダウン時のみ */
  holeCards?: PokerCard[];
  handLabel?: string;
}

/** クライアントに送るゲーム状態 */
export interface PokerClientState {
  phase: PokerPhase;
  holeCards: PokerCard[];
  communityCards: PokerCard[];
  players: PokerPlayerInfo[];
  pot: number;
  currentTurn: string;
  currentBet: number;
  myChips: number;
  myCurrentBet: number;
  myTotalBetThisHand: number;
  dealerIndex: number;
  round: number;
  minRaise: number;
  /** ショーダウン結果 */
  winners?: { playerId: string; playerName: string; amount: number; handLabel: string }[];
}

export type { Card, Suit, Rank };
