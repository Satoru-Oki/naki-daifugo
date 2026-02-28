import type { Rank, Suit } from "./types";

/** 通常時の強さ順（弱→強） */
export const RANK_ORDER: Rank[] = [
  "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2",
];

/** 革命時の強さ順（弱→強） */
export const RANK_ORDER_REVOLUTION: Rank[] = [
  "2", "A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3",
];

/** 連番判定用の数値順（鳴き・革命判定共通） */
export const RANK_SEQUENCE: Rank[] = [
  "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2",
];

/** 鳴き可能なランク（6～Q） */
export const NAKI_RANKS: Rank[] = ["6", "7", "8", "9", "10", "J", "Q"];

/** スート一覧 */
export const SUITS: Suit[] = ["S", "H", "D", "C"];

/** スート表示用シンボル */
export const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠", H: "♥", D: "♦", C: "♣",
};

/** スート日本語名 */
export const SUIT_NAME: Record<Suit, string> = {
  S: "スペード", H: "ハート", D: "ダイヤ", C: "クラブ",
};

/** 利用可能アバター一覧 */
export const AVATARS: { file: string; label: string }[] = [
  { file: "dave.jpg", label: "Dave" },
  { file: "iwahara.JPG", label: "Iwahara" },
  { file: "morizono.JPG", label: "Morizono" },
  { file: "oki.jpg", label: "Oki" },
  { file: "sakai.JPG", label: "Sakai" },
  { file: "suzuki1.jpg", label: "Suzuki" },
  { file: "syuji.jpg", label: "Syuji" },
  { file: "syujihome.jpg", label: "SyujiHome" },
];

/** クイックメッセージ */
export const QUICK_MESSAGES = [
  "オレはアホや・・・",
  "ウソチュー！",
  "早くしろ！",
  "マジか！！",
  "飯ぐらいおごってくれ",
];

/** ボイススタンプ定義 */
export const VOICE_STAMPS = [
  { id: "bakayaro", file: "/audio/bakayaro.m4a", label: "バカヤロー" },
  { id: "daredemokakattekoi", file: "/audio/daredemokakattekoi.m4a", label: "かかってこい" },
  { id: "douttekotoneyo", file: "/audio/douttekotoneyo.m4a", label: "どうってことねーよ" },
  { id: "genkidesuka", file: "/audio/genkidesuka.m4a", label: "元気ですか" },
  { id: "sorehasoredeii", file: "/audio/sorehasoredeii.m4a", label: "それはそれでいい" },
  { id: "yarerunokaoi", file: "/audio/yarerunokaoi.m4a", label: "やれるのかおい" },
];

/** @letele/playing-cards のコンポーネント名マッピング */
export function getCardComponentName(suit: Suit, rank: Rank): string {
  const rankMap: Record<string, string> = {
    A: "a", J: "j", Q: "q", K: "k",
  };
  const r = rankMap[rank] || rank;
  return `${suit}${r}`;
}
