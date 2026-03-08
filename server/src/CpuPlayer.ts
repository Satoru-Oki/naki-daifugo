import type { GameCard, Card, Rank } from "../../shared/types";
import {
  isJoker, compareCards, isValidSequence, canNaki,
  isRevolutionPlay, getSequenceMinIndex, canBeatJoker,
} from "../../shared/gameLogic";
import { RANK_ORDER, RANK_ORDER_REVOLUTION, RANK_SEQUENCE, NAKI_RANKS } from "../../shared/constants";

type FieldType = "single" | "pair" | "triple" | "quad" | "sequence";

interface PlayResult {
  action: "play";
  cardIds: string[];
}

interface PassResult {
  action: "pass";
}

type Decision = PlayResult | PassResult;

interface CpuContext {
  hand: GameCard[];
  field: GameCard[];
  fieldType: FieldType;
  isRevolution: boolean;
  isElevenBack: boolean;
  discardPile: GameCard[];
}

// 実効革命状態
function effectiveRevolution(ctx: CpuContext): boolean {
  return ctx.isRevolution !== ctx.isElevenBack;
}

// ランクの強さインデックス（高い=強い）
function rankStrength(rank: Rank, revolution: boolean): number {
  const order = revolution ? RANK_ORDER_REVOLUTION : RANK_ORDER;
  return order.indexOf(rank);
}

// カードの強さ（Joker=最大値+1）
function cardStrength(card: GameCard, revolution: boolean): number {
  if (isJoker(card)) return revolution ? -1 : 14;
  return rankStrength((card as Card).rank, revolution);
}

// --- 合法手列挙 ---

/** 同ランクのグループを取得 */
function getRankGroups(hand: GameCard[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>();
  for (const c of hand) {
    if (isJoker(c)) continue;
    const card = c as Card;
    const existing = groups.get(card.rank) || [];
    existing.push(card);
    groups.set(card.rank, existing);
  }
  return groups;
}

/** 単体出しの候補 */
function getSinglePlays(hand: GameCard[]): GameCard[][] {
  return hand.map((c) => [c]);
}

/** 同ランク複数枚（ペア/トリプル/4枚）の候補。Jokerワイルド含む */
function getSameRankPlays(hand: GameCard[], count: number): GameCard[][] {
  const results: GameCard[][] = [];
  const groups = getRankGroups(hand);
  const jokers = hand.filter(isJoker);

  for (const [, cards] of groups) {
    if (cards.length >= count) {
      // Jokerなしの組み合わせ
      const combos = combinations(cards, count);
      results.push(...combos);
    }
    // Jokerで補完
    if (jokers.length > 0 && cards.length >= count - jokers.length && cards.length < count) {
      const needed = count - cards.length;
      if (needed <= jokers.length) {
        results.push([...cards, ...jokers.slice(0, needed)]);
      }
    }
  }
  return results;
}

/** 連番の候補（3枚以上） */
function getSequencePlays(hand: GameCard[], minLen: number): GameCard[][] {
  const results: GameCard[][] = [];
  const normalCards = hand.filter((c) => !isJoker(c)) as Card[];
  const jokers = hand.filter(isJoker);
  const suits = new Set(normalCards.map((c) => c.suit));

  for (const suit of suits) {
    const suitCards = normalCards.filter((c) => c.suit === suit);
    const indices = suitCards.map((c) => ({
      card: c,
      idx: RANK_SEQUENCE.indexOf(c.rank),
    })).sort((a, b) => a.idx - b.idx);

    // スライディングウィンドウで連番を探す
    for (let start = 0; start < indices.length; start++) {
      for (let end = start + 1; end <= indices.length; end++) {
        const subset = indices.slice(start, end);
        const span = subset[subset.length - 1].idx - subset[0].idx + 1;
        const gaps = span - subset.length;

        for (let extraJokers = 0; extraJokers <= jokers.length - gaps; extraJokers++) {
          const totalLen = span + extraJokers;
          if (totalLen < minLen) continue;
          if (gaps > jokers.length) continue;

          const cards: GameCard[] = subset.map((s) => s.card);
          const jokersNeeded = gaps + extraJokers;
          if (jokersNeeded <= jokers.length) {
            cards.push(...jokers.slice(0, jokersNeeded));
          }
          if (isValidSequence(cards) && cards.length >= minLen) {
            results.push(cards);
          }
        }
      }
    }
  }
  return results;
}

/** 場に出せる合法手をすべて列挙 */
function enumerateLegalPlays(ctx: CpuContext): GameCard[][] {
  const { hand, field, fieldType } = ctx;
  const rev = effectiveRevolution(ctx);

  // 場が空 → 何でも出せる（自由出し）
  if (field.length === 0) {
    return enumerateFreePlay(hand);
  }

  const fieldCount = field.length;
  let candidates: GameCard[][] = [];

  // Joker単体 → ♠3のみ
  if (fieldCount === 1 && isJoker(field[0])) {
    const spade3 = hand.find((c) => !isJoker(c) && (c as Card).suit === "S" && (c as Card).rank === "3");
    if (spade3) candidates.push([spade3]);
    return candidates;
  }

  if (fieldType === "sequence") {
    // 連番: 同枚数の連番で強いもの
    const seqs = getSequencePlays(hand, fieldCount);
    const fieldMin = getSequenceMinIndex(field);
    candidates = seqs.filter((seq) => {
      if (seq.length !== fieldCount) return false;
      const playedMin = getSequenceMinIndex(seq);
      return rev ? playedMin < fieldMin : playedMin > fieldMin;
    });
  } else {
    // 同ランク: 同枚数で強いもの
    const plays = getSameRankPlays(hand, fieldCount);
    const fieldRep = field.find((c) => !isJoker(c)) || field[0];
    candidates = plays.filter((cards) => {
      if (cards.length !== fieldCount) return false;
      const playedRep = cards.find((c) => !isJoker(c)) || cards[0];
      return compareCards(playedRep, fieldRep, rev) > 0;
    });

    // 単体出しの場合、手札の単体カードも候補に
    if (fieldCount === 1) {
      for (const c of hand) {
        const cmp = compareCards(c, fieldRep, rev);
        if (cmp > 0 && !candidates.some((cs) => cs.length === 1 && cs[0].id === c.id)) {
          candidates.push([c]);
        }
      }
    }
  }

  return candidates;
}

/** 自由出し（場が空）の候補を列挙 */
function enumerateFreePlay(hand: GameCard[]): GameCard[][] {
  const results: GameCard[][] = [];

  // 単体
  results.push(...getSinglePlays(hand));
  // ペア
  results.push(...getSameRankPlays(hand, 2));
  // トリプル
  results.push(...getSameRankPlays(hand, 3));
  // 4枚
  results.push(...getSameRankPlays(hand, 4));
  // 連番（3枚以上）
  results.push(...getSequencePlays(hand, 3));

  return results;
}

// --- 戦略評価 ---

/** 鳴きリスクがあるか（単体6〜Qで前後カードが捨て札に出ていない） */
function hasNakiRisk(cards: GameCard[], discardPile: GameCard[]): boolean {
  if (cards.length !== 1) return false;
  const card = cards[0];
  if (isJoker(card)) return false;
  const c = card as Card;
  if (!NAKI_RANKS.includes(c.rank)) return false;

  const seqIdx = RANK_SEQUENCE.indexOf(c.rank);
  if (seqIdx <= 0 || seqIdx >= RANK_SEQUENCE.length - 1) return false;

  const prevRank = RANK_SEQUENCE[seqIdx - 1];
  const nextRank = RANK_SEQUENCE[seqIdx + 1];

  // 同スートの前後カードが両方とも捨て札にあれば鳴かれない
  const prevInDiscard = discardPile.some(
    (d) => !isJoker(d) && (d as Card).suit === c.suit && (d as Card).rank === prevRank
  );
  const nextInDiscard = discardPile.some(
    (d) => !isJoker(d) && (d as Card).suit === c.suit && (d as Card).rank === nextRank
  );

  // 前後のどちらかが捨て札にあれば鳴かれない
  return !prevInDiscard && !nextInDiscard;
}

/** カードの価値スコア（高い=温存したい） */
function cardValue(card: GameCard, revolution: boolean): number {
  if (isJoker(card)) return revolution ? 0 : 100;
  const c = card as Card;
  if (c.rank === "2") return revolution ? 1 : 90;
  if (c.rank === "8") return 50; // 8切り用に中程度の温存価値
  return cardStrength(card, revolution);
}

/** 合法手をスコアリングして最善手を選ぶ */
function scorePlays(candidates: GameCard[][], ctx: CpuContext): GameCard[][] {
  const rev = effectiveRevolution(ctx);

  return candidates.sort((a, b) => {
    // 8切りを含む手は優先（場を制御できる）
    const a8 = a.some((c) => !isJoker(c) && (c as Card).rank === "8");
    const b8 = b.some((c) => !isJoker(c) && (c as Card).rank === "8");

    // 多枚数出しを優先（手札効率）
    if (a.length !== b.length) return b.length - a.length;

    // 鳴きリスクのあるカードは避ける
    const aRisk = hasNakiRisk(a, ctx.discardPile) ? 1 : 0;
    const bRisk = hasNakiRisk(b, ctx.discardPile) ? 1 : 0;
    if (aRisk !== bRisk) return aRisk - bRisk;

    // 8切り優先
    if (a8 && !b8) return -1;
    if (!a8 && b8) return 1;

    // 弱いカードから出す（価値の低い方を優先）
    const aVal = Math.max(...a.map((c) => cardValue(c, rev)));
    const bVal = Math.max(...b.map((c) => cardValue(c, rev)));
    return aVal - bVal;
  });
}

// --- メイン意思決定関数 ---

/** CPUのプレイ判断 */
export function decidePlay(ctx: CpuContext): Decision {
  const candidates = enumerateLegalPlays(ctx);
  if (candidates.length === 0) return { action: "pass" };

  const rev = effectiveRevolution(ctx);
  const remaining = ctx.hand.length;

  // 残り少ない: 出せるなら出す（勝ち筋優先）
  if (remaining <= 3) {
    // 場が空の場合は最も枚数が多い手を選ぶ
    if (ctx.field.length === 0) {
      const sorted = [...candidates].sort((a, b) => b.length - a.length);
      return { action: "play", cardIds: sorted[0].map((c) => c.id) };
    }
    // 場にカードがある場合は最小限の強さで返す
    const sorted = scorePlays(candidates, ctx);
    return { action: "play", cardIds: sorted[0].map((c) => c.id) };
  }

  // 場が空: 自由出し戦略
  if (ctx.field.length === 0) {
    return chooseFreePlay(ctx, candidates);
  }

  // 場にカードあり: 最小限の強さで勝つ
  const sorted = scorePlays(candidates, ctx);

  // Joker/2は温存（残り4枚以上かつ他に候補がある時）
  if (remaining > 4 && sorted.length > 1) {
    const nonStrongCards = sorted.filter(
      (cards) => !cards.some((c) => isJoker(c) || (!isJoker(c) && (c as Card).rank === "2"))
    );
    if (nonStrongCards.length > 0) {
      return { action: "play", cardIds: nonStrongCards[0].map((c) => c.id) };
    }
  }

  return { action: "play", cardIds: sorted[0].map((c) => c.id) };
}

/** カードが孤立しているか（ペアにも連番にも属さない単体カード） */
function isIsolatedCard(card: GameCard, hand: GameCard[]): boolean {
  if (isJoker(card)) return false;
  const c = card as Card;

  // 同ランクが他にあればペア候補 → 孤立でない
  const sameRank = hand.filter((h) => !isJoker(h) && (h as Card).rank === c.rank);
  if (sameRank.length >= 2) return false;

  // 同スートで前後にカードがあれば連番候補 → 孤立でない
  const seqIdx = RANK_SEQUENCE.indexOf(c.rank);
  const suitCards = hand.filter((h) => !isJoker(h) && (h as Card).suit === c.suit && h.id !== card.id);
  for (const sc of suitCards) {
    const scIdx = RANK_SEQUENCE.indexOf((sc as Card).rank);
    // 隣接（差1〜2でJokerギャップ埋め可能）なら連番候補
    if (Math.abs(scIdx - seqIdx) <= 2) return false;
  }

  return true;
}

/** 自由出し（場が空）の戦略 */
function chooseFreePlay(ctx: CpuContext, candidates: GameCard[][]): Decision {
  const rev = effectiveRevolution(ctx);
  const remaining = ctx.hand.length;

  // 革命可能なら評価
  const revolutionPlays = candidates.filter((cards) => isRevolutionPlay(cards));
  if (revolutionPlays.length > 0 && remaining > 4) {
    // 革命後に有利になるかチェック（弱いカードが多いなら革命）
    const weakCards = ctx.hand.filter((c) => {
      if (isJoker(c)) return false;
      return cardStrength(c, rev) <= 5;
    });
    if (weakCards.length > ctx.hand.length / 2) {
      return { action: "play", cardIds: revolutionPlays[0].map((c) => c.id) };
    }
  }

  // 孤立した単体カードを最優先（ペアや連番を崩さず手札を減らせる）
  const isolatedSingles = candidates.filter(
    (cards) => cards.length === 1 && isIsolatedCard(cards[0], ctx.hand)
  );
  if (isolatedSingles.length > 0) {
    // 鳴きリスクを避けつつ弱いカードから
    const safe = isolatedSingles.filter((cards) => !hasNakiRisk(cards, ctx.discardPile));
    const pool = safe.length > 0 ? safe : isolatedSingles;
    const sorted = pool.sort((a, b) => cardValue(a[0], rev) - cardValue(b[0], rev));

    // Joker/2温存
    if (remaining > 4 && sorted.length > 1) {
      const nonStrong = sorted.filter(
        (cards) => !isJoker(cards[0]) && (cards[0] as Card).rank !== "2"
      );
      if (nonStrong.length > 0) {
        return { action: "play", cardIds: nonStrong[0].map((c) => c.id) };
      }
    }
    return { action: "play", cardIds: sorted[0].map((c) => c.id) };
  }

  // 連番（3枚以上で手札を効率的に減らす）
  const sequences = candidates.filter((cards) => cards.length >= 3 && isValidSequence(cards));
  if (sequences.length > 0) {
    // 最弱の連番を選ぶ
    const sorted = sequences.sort((a, b) => {
      const aVal = Math.max(...a.map((c) => cardValue(c, rev)));
      const bVal = Math.max(...b.map((c) => cardValue(c, rev)));
      // 長い連番を優先
      if (a.length !== b.length) return b.length - a.length;
      return aVal - bVal;
    });
    return { action: "play", cardIds: sorted[0].map((c) => c.id) };
  }

  // ペア以上
  const multiPlays = candidates.filter((cards) => cards.length >= 2);
  if (multiPlays.length > 0) {
    const sorted = multiPlays.sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length;
      const aVal = Math.max(...a.map((c) => cardValue(c, rev)));
      const bVal = Math.max(...b.map((c) => cardValue(c, rev)));
      return aVal - bVal;
    });

    // Joker/2を含まないペアがあればそちらを優先
    const nonStrong = sorted.filter(
      (cards) => !cards.some((c) => isJoker(c) || (!isJoker(c) && (c as Card).rank === "2"))
    );
    if (nonStrong.length > 0) {
      return { action: "play", cardIds: nonStrong[0].map((c) => c.id) };
    }
    return { action: "play", cardIds: sorted[0].map((c) => c.id) };
  }

  // 残りの単体（孤立でないもの）: 鳴きリスクを避けつつ弱いカードから
  const singles = candidates.filter((cards) => cards.length === 1);
  const safeSingles = singles.filter((cards) => !hasNakiRisk(cards, ctx.discardPile));

  const pool = safeSingles.length > 0 ? safeSingles : singles;
  const sorted = pool.sort((a, b) => {
    const aVal = cardValue(a[0], rev);
    const bVal = cardValue(b[0], rev);
    return aVal - bVal;
  });

  // Joker/2温存
  if (remaining > 4 && sorted.length > 1) {
    const nonStrong = sorted.filter(
      (cards) => !isJoker(cards[0]) && (cards[0] as Card).rank !== "2"
    );
    if (nonStrong.length > 0) {
      return { action: "play", cardIds: nonStrong[0].map((c) => c.id) };
    }
  }

  return { action: "play", cardIds: sorted[0].map((c) => c.id) };
}

/** 鳴き判定 */
export function shouldNaki(
  hand: GameCard[],
  _targetCard: GameCard,
): boolean {
  // 手札4枚以下 → 常に鳴く
  if (hand.length <= 4) return true;

  // 鳴き上がり（残り2枚で鳴くと0枚になる）→ 常に鳴く
  if (hand.length === 2) return true;

  // 手札が多い時は基本的に鳴く（手札を減らせるため）
  // ただし高価値カード（2/Joker）を失う場合は慎重に
  // → canNakiの結果prev/nextが2やJokerでないことをGameRoom側で確認
  return true;
}

/** カード交換（大富豪/富豪が最弱カードを渡す） */
export function chooseExchangeCards(hand: GameCard[], count: number, isRevolution: boolean): string[] {
  const rev = isRevolution;

  // ペア/連番を崩さない孤立カードを優先
  const groups = getRankGroups(hand);
  const pairedRanks = new Set<Rank>();
  for (const [rank, cards] of groups) {
    if (cards.length >= 2) pairedRanks.add(rank);
  }

  // 弱い順にソート
  const sorted = [...hand].sort((a, b) => cardValue(a, rev) - cardValue(b, rev));

  // 孤立カード（ペアに属さない）を先に候補にする
  const isolated = sorted.filter((c) => {
    if (isJoker(c)) return false;
    return !pairedRanks.has((c as Card).rank);
  });

  const result: string[] = [];

  // まず孤立カードから
  for (const c of isolated) {
    if (result.length >= count) break;
    result.push(c.id);
  }

  // 足りなければ残りから
  if (result.length < count) {
    for (const c of sorted) {
      if (result.length >= count) break;
      if (result.includes(c.id)) continue;
      result.push(c.id);
    }
  }

  return result.slice(0, count);
}

// --- ユーティリティ ---

/** 配列から n 個を選ぶ組み合わせ */
function combinations<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]];
  if (n > arr.length) return [];
  if (n === arr.length) return [arr.slice()];

  const results: T[][] = [];
  for (let i = 0; i <= arr.length - n; i++) {
    const rest = combinations(arr.slice(i + 1), n - 1);
    for (const combo of rest) {
      results.push([arr[i], ...combo]);
    }
  }
  return results;
}
