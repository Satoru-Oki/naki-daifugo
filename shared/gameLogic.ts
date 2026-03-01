import type { Card, GameCard, Rank, Suit } from "./types";
import { NAKI_RANKS, RANK_ORDER, RANK_ORDER_REVOLUTION, RANK_SEQUENCE } from "./constants";

/** ジョーカーかどうか */
export function isJoker(card: GameCard): boolean {
  return card.suit === "JOKER";
}

/** カードの強さを比較（正: aが強い、負: bが強い） */
export function compareCards(a: GameCard, b: GameCard, revolution: boolean): number {
  if (isJoker(a)) return 1;
  if (isJoker(b)) return -1;
  const order = revolution ? RANK_ORDER_REVOLUTION : RANK_ORDER;
  return order.indexOf((a as Card).rank) - order.indexOf((b as Card).rank);
}

/** 鳴き可能かチェック */
export function canNaki(
  playedCard: GameCard,
  hand: GameCard[]
): { possible: boolean; prev?: GameCard; next?: GameCard } {
  if (isJoker(playedCard)) return { possible: false };

  const card = playedCard as Card;
  if (!NAKI_RANKS.includes(card.rank)) return { possible: false };

  const seqIndex = RANK_SEQUENCE.indexOf(card.rank);
  if (seqIndex <= 0 || seqIndex >= RANK_SEQUENCE.length - 1) return { possible: false };

  const prevRank = RANK_SEQUENCE[seqIndex - 1];
  const nextRank = RANK_SEQUENCE[seqIndex + 1];

  const prevCard = hand.find(
    (c) => !isJoker(c) && (c as Card).suit === card.suit && (c as Card).rank === prevRank
  );
  const nextCard = hand.find(
    (c) => !isJoker(c) && (c as Card).suit === card.suit && (c as Card).rank === nextRank
  );

  if (prevCard && nextCard) {
    return { possible: true, prev: prevCard, next: nextCard };
  }
  return { possible: false };
}

/** 革命判定: 同ランク4枚以上 or 同スート連番4枚以上（ジョーカー含む） */
export function isRevolutionPlay(cards: GameCard[]): boolean {
  if (cards.length < 4) return false;

  const jokerCount = cards.filter(isJoker).length;
  const normalCards = cards.filter((c) => !isJoker(c)) as Card[];

  // 同ランク4枚以上チェック
  if (normalCards.length > 0) {
    const rank = normalCards[0].rank;
    const sameRank = normalCards.every((c) => c.rank === rank);
    if (sameRank && normalCards.length + jokerCount >= 4) return true;
  }

  // 同スート連番4枚以上チェック
  if (normalCards.length > 0) {
    const suit = normalCards[0].suit;
    const sameSuit = normalCards.every((c) => c.suit === suit);
    if (sameSuit) {
      const indices = normalCards.map((c) => RANK_SEQUENCE.indexOf(c.rank)).sort((a, b) => a - b);
      let gaps = 0;
      for (let i = 1; i < indices.length; i++) {
        gaps += indices[i] - indices[i - 1] - 1;
      }
      if (gaps <= jokerCount && normalCards.length + jokerCount >= 4) return true;
    }
  }

  return false;
}

/** 連番（階段）バリデーション: 同スート連番3枚以上（ジョーカーでギャップ可）
 * Jokerの端延長ルール:
 *  - J含まない: 強い方（高インデックス=A,2方向）にのみ延長可
 *  - J含む: イレブンバック後に強い方（低インデックス=3,4方向）にのみ延長可
 */
export function isValidSequence(cards: GameCard[]): boolean {
  if (cards.length < 3) return false;

  const jokerCount = cards.filter(isJoker).length;
  const normalCards = cards.filter((c) => !isJoker(c)) as Card[];

  if (normalCards.length === 0) return false;

  // 全non-jokerカードが同スート
  const suit = normalCards[0].suit;
  if (!normalCards.every((c) => c.suit === suit)) return false;

  // RANK_SEQUENCE上のインデックスを取得し重複チェック
  const indices = normalCards.map((c) => RANK_SEQUENCE.indexOf(c.rank));
  const uniqueIndices = new Set(indices);
  if (uniqueIndices.size !== indices.length) return false;

  // 連続判定: ソートしてギャップをジョーカーで埋められるか
  indices.sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < indices.length; i++) {
    gaps += indices[i] - indices[i - 1] - 1;
  }

  if (gaps > jokerCount) return false;

  const totalSpan = indices[indices.length - 1] - indices[0] + 1;
  const remainingJokers = jokerCount - gaps;

  if (totalSpan + remainingJokers !== cards.length) return false;

  // Jokerの端延長方向チェック
  if (remainingJokers > 0) {
    const hasJack = normalCards.some((c) => c.rank === "J");
    if (hasJack) {
      // J含む → イレブンバック後に強い低インデックス方向へ延長
      if (indices[0] - remainingJokers < 0) return false;
    } else {
      // J含まない → 強い高インデックス方向へ延長
      if (indices[indices.length - 1] + remainingJokers > RANK_SEQUENCE.length - 1) return false;
    }
  }

  return true;
}

/** 連番の最小インデックスを返す（強さ比較用）
 * Joker端延長方向を考慮: J含む場合は低い方に延長するためminが下がる
 */
export function getSequenceMinIndex(cards: GameCard[]): number {
  const normalCards = cards.filter((c) => !isJoker(c)) as Card[];
  if (normalCards.length === 0) return 0;

  const jokerCount = cards.filter(isJoker).length;
  const indices = normalCards.map((c) => RANK_SEQUENCE.indexOf(c.rank)).sort((a, b) => a - b);

  let gaps = 0;
  for (let i = 1; i < indices.length; i++) {
    gaps += indices[i] - indices[i - 1] - 1;
  }
  const remainingJokers = jokerCount - gaps;

  const hasJack = normalCards.some((c) => c.rank === "J");
  if (hasJack && remainingJokers > 0) {
    // J含む → 低い方に延長 → minが下がる
    return indices[0] - remainingJokers;
  }
  // J含まない or 延長なし → minは通常カードの最小値
  return indices[0];
}

/** ジョーカーを切れるか: ♠3単体 */
export function canBeatJoker(cards: GameCard[]): boolean {
  return cards.length === 1 && !isJoker(cards[0])
    && (cards[0] as Card).suit === "S" && (cards[0] as Card).rank === "3";
}

/** ポーカー用デッキ生成（52枚、Jokerなし） */
export function createPokerDeck(): Card[] {
  const suits: Suit[] = ["S", "H", "D", "C"];
  const ranks: Rank[] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return deck;
}

/** デッキ生成（54枚） */
export function createDeck(): GameCard[] {
  const suits: Suit[] = ["S", "H", "D", "C"];
  const ranks: Rank[] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
  const deck: GameCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  deck.push({ suit: "JOKER", rank: "JOKER", id: "JOKER-1" });
  deck.push({ suit: "JOKER", rank: "JOKER", id: "JOKER-2" });

  return deck;
}

/** シャッフル */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 手札をソート（通常時/革命時） */
export function sortHand(hand: GameCard[], revolution: boolean): GameCard[] {
  return [...hand].sort((a, b) => compareCards(a, b, revolution));
}
