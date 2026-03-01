/** ブラインド額 */
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

/** 初期チップ */
export const INITIAL_CHIPS = 1000;

/** 人数制限 */
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

/** ポーカー用ランク値（2=0, 3=1, ..., A=12） */
export const POKER_RANK_VALUE: Record<string, number> = {
  "2": 0,
  "3": 1,
  "4": 2,
  "5": 3,
  "6": 4,
  "7": 5,
  "8": 6,
  "9": 7,
  "10": 8,
  "J": 9,
  "Q": 10,
  "K": 11,
  "A": 12,
};
