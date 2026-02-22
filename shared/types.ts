export type Suit = "S" | "H" | "D" | "C";
export type Rank = "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "2";

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // e.g. "S-7", "H-Q"
}

export interface JokerCard {
  suit: "JOKER";
  rank: "JOKER";
  id: "JOKER-1" | "JOKER-2";
}

export type GameCard = Card | JokerCard;

export type PlayerRank = "大富豪" | "富豪" | "平民" | "貧民" | "大貧民";

export interface Player {
  id: string;
  name: string;
  cardCount: number;
  rank: PlayerRank;
  passed: boolean;
  speaking: boolean;
  isCurrentTurn: boolean;
  avatar?: string;
}

export interface ChatMessage {
  from: string;
  fromId: string;
  text: string;
  timestamp: number;
}

export type GamePhase = "waiting" | "playing" | "naki_chance" | "round_end" | "card_exchange";

export interface GameState {
  phase: GamePhase;
  hand: GameCard[];
  field: GameCard[];
  history: GameCard[];
  players: Player[];
  currentTurn: string;
  isRevolution: boolean;
  isElevenBack: boolean;
  round: number;
  myRank: PlayerRank;
  nakiCount: number;
}
