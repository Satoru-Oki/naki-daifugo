import type { PokerCard, EvaluatedHand } from "./types";
import { HandRank, HAND_RANK_LABEL } from "./types";
import { POKER_RANK_VALUE } from "./constants";

/** カードのランク値を取得 */
function rankVal(card: PokerCard): number {
  return POKER_RANK_VALUE[card.rank] ?? 0;
}

/** C(7,5)=21通りの組み合わせを生成 */
function combinations5(cards: PokerCard[]): PokerCard[][] {
  const result: PokerCard[][] = [];
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            result.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }
  return result;
}

/** 5枚のハンドを評価 */
function evaluate5(cards: PokerCard[]): { rank: HandRank; value: number } {
  const values = cards.map(rankVal).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // ストレート判定（A-2-3-4-5 のホイールも含む）
  let isStraight = false;
  let straightHigh = values[0];

  const unique = [...new Set(values)];
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    }
    // A-2-3-4-5（ホイール）
    if (unique[0] === 12 && unique[1] === 3 && unique[2] === 2 && unique[3] === 1 && unique[4] === 0) {
      isStraight = true;
      straightHigh = 3; // 5がハイ
    }
  }

  // ランクごとのカウント
  const countMap = new Map<number, number>();
  for (const v of values) {
    countMap.set(v, (countMap.get(v) || 0) + 1);
  }
  const counts = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  // ストレートフラッシュ / ロイヤルフラッシュ
  if (isFlush && isStraight) {
    if (straightHigh === 12) {
      return { rank: HandRank.ROYAL_FLUSH, value: 12 };
    }
    return { rank: HandRank.STRAIGHT_FLUSH, value: straightHigh };
  }

  // フォーカード
  if (counts[0][1] === 4) {
    const quadVal = counts[0][0];
    const kicker = counts[1][0];
    return { rank: HandRank.FOUR_OF_A_KIND, value: quadVal * 13 + kicker };
  }

  // フルハウス
  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return { rank: HandRank.FULL_HOUSE, value: counts[0][0] * 13 + counts[1][0] };
  }

  // フラッシュ
  if (isFlush) {
    const val = values[0] * 13 ** 4 + values[1] * 13 ** 3 + values[2] * 13 ** 2 + values[3] * 13 + values[4];
    return { rank: HandRank.FLUSH, value: val };
  }

  // ストレート
  if (isStraight) {
    return { rank: HandRank.STRAIGHT, value: straightHigh };
  }

  // スリーカード
  if (counts[0][1] === 3) {
    const tripVal = counts[0][0];
    const kickers = counts.slice(1).map((c) => c[0]);
    return { rank: HandRank.THREE_OF_A_KIND, value: tripVal * 13 * 13 + kickers[0] * 13 + kickers[1] };
  }

  // ツーペア
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const high = Math.max(counts[0][0], counts[1][0]);
    const low = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2][0];
    return { rank: HandRank.TWO_PAIR, value: high * 13 * 13 + low * 13 + kicker };
  }

  // ワンペア
  if (counts[0][1] === 2) {
    const pairVal = counts[0][0];
    const kickers = counts.slice(1).map((c) => c[0]);
    return { rank: HandRank.ONE_PAIR, value: pairVal * 13 ** 3 + kickers[0] * 13 ** 2 + kickers[1] * 13 + kickers[2] };
  }

  // ハイカード
  const val = values[0] * 13 ** 4 + values[1] * 13 ** 3 + values[2] * 13 ** 2 + values[3] * 13 + values[4];
  return { rank: HandRank.HIGH_CARD, value: val };
}

/** 7枚（ホールカード2枚 + コミュニティカード5枚）から最強ハンドを判定 */
export function evaluateHand(cards: PokerCard[]): EvaluatedHand {
  if (cards.length < 5) {
    // 5枚未満の場合（フロップ時など）→ そのまま評価
    const padded = [...cards];
    while (padded.length < 5) {
      // ダミーカードは使わない。5枚未満なら直接評価
      break;
    }
    if (padded.length === 5) {
      const result = evaluate5(padded);
      return {
        ...result,
        bestCards: padded,
        label: HAND_RANK_LABEL[result.rank],
      };
    }
    // 5枚未満は暫定ハイカード
    return {
      rank: HandRank.HIGH_CARD,
      value: 0,
      bestCards: cards,
      label: HAND_RANK_LABEL[HandRank.HIGH_CARD],
    };
  }

  const combos = cards.length === 5 ? [cards] : combinations5(cards);
  let best: { rank: HandRank; value: number; cards: PokerCard[] } | null = null;

  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || result.rank > best.rank || (result.rank === best.rank && result.value > best.value)) {
      best = { rank: result.rank, value: result.value, cards: combo };
    }
  }

  return {
    rank: best!.rank,
    value: best!.value,
    bestCards: best!.cards,
    label: HAND_RANK_LABEL[best!.rank],
  };
}

/** 2つのハンドを比較（正: aが強い、負: bが強い、0: 同じ） */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.value - b.value;
}
