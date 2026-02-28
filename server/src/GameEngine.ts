import {
  GameCard, Card, Rank, Suit, PlayerRank, GamePhase,
} from "../../shared/types";
import {
  createDeck, shuffle, sortHand, canNaki, isJoker,
  isRevolutionPlay, compareCards, canBeatJoker,
  isValidSequence, getSequenceMinIndex,
} from "../../shared/gameLogic";
import { NAKI_RANKS, RANK_ORDER } from "../../shared/constants";

interface PlayerState {
  id: string;
  name: string;
  hand: GameCard[];
  rank: PlayerRank;
  prevRank: PlayerRank;
  passed: boolean;
  finished: boolean;
  finishOrder: number;
  totalScore: number;
  hadStrongCards: boolean;
  avatar?: string;
}

interface ExchangeEntry {
  toGive: number;       // 渡す枚数
  toPlayer: string;     // 渡す相手のID
  given: boolean;       // 渡し完了か
  received: GameCard[];  // 受け取ったカード
}

const RANK_SCORE: Record<number, Record<PlayerRank, number>> = {
  5: { "大富豪": 7, "富豪": 4, "平民": 2, "貧民": 1, "大貧民": 0 },
  4: { "大富豪": 5, "富豪": 3, "平民": 0, "貧民": 1, "大貧民": 0 },
  3: { "大富豪": 4, "富豪": 2, "平民": 2, "貧民": 0, "大貧民": 0 },
};

export class GameEngine {
  players: PlayerState[] = [];
  field: GameCard[] = [];
  fieldType: "single" | "pair" | "triple" | "quad" | "sequence" = "single";
  currentTurnIndex = 0;
  isRevolution = false;
  isElevenBack = false;
  round = 1;
  phase: GamePhase = "waiting";
  discardPile: GameCard[] = [];
  nakiCount = 0;
  pendingEightCut = false;
  pendingElevenBack = false;
  spade3CutPending = false;
  eightCutPending = false;
  finishCounter = 0;
  exchangeState: Map<string, ExchangeEntry> = new Map();
  prevDaifugoId: string | null = null;
  miyakoOchiResult: { playerId: string; playerName: string } | null = null;

  /** プレイヤー追加 */
  addPlayer(id: string, name: string, avatar?: string): void {
    this.players.push({
      id, name, hand: [], rank: "平民", prevRank: "平民",
      passed: false, finished: false, finishOrder: 0, totalScore: 0,
      hadStrongCards: false, avatar,
    });
  }

  /** プレイヤー削除（ゲーム中の退出にも対応） */
  removePlayer(id: string): void {
    const player = this.players.find((p) => p.id === id);
    if (!player) return;

    // waiting フェーズなら単純削除
    if (this.phase === "waiting") {
      this.players = this.players.filter((p) => p.id !== id);
      return;
    }

    // 退出者の手札を捨て札へ
    this.discardPile.push(...player.hand);
    player.hand = [];

    // 退出者がまだfinishしていなければ最下位扱い
    if (!player.finished) {
      this.finishCounter++;
      player.finished = true;
      player.finishOrder = this.finishCounter;
    }

    // 退出者のインデックスを記録
    const leavingIndex = this.players.indexOf(player);
    const isCurrent = leavingIndex === this.currentTurnIndex;

    // プレイヤー配列から削除
    this.players = this.players.filter((p) => p.id !== id);

    if (this.players.length === 0) return;

    // currentTurnIndex補正
    if (isCurrent) {
      this.currentTurnIndex = leavingIndex % this.players.length;
    } else if (leavingIndex < this.currentTurnIndex) {
      this.currentTurnIndex--;
    }

    // round_end中は追加のゲームロジック不要
    if (this.phase === "round_end") return;

    // 残りアクティブプレイヤーチェック
    const activePlayers = this.players.filter((p) => !p.finished);
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) {
        this.finishCounter++;
        activePlayers[0].finished = true;
        activePlayers[0].finishOrder = this.finishCounter;
        this.assignRankImmediate(activePlayers[0]);
      }
      this.phase = "round_end";
      this.assignRanks();
      return;
    }

    // naki_chance中ならplayingに戻す（ペンディング中の8切り・イレブンバックもクリア）
    if (this.phase === "naki_chance") {
      this.phase = "playing";
      this.pendingEightCut = false;
      this.pendingElevenBack = false;
      if (!isCurrent) {
        // カードを出したプレイヤーは残っているので通常のターン進行
        this.advanceTurn();
        return;
      }
      // isCurrent の場合は下のターン探索で処理
    }

    // card_exchange中なら退出者のexchangeStateを整理
    if (this.phase === "card_exchange") {
      this.exchangeState.delete(id);
      for (const [pid, entry] of this.exchangeState) {
        if (entry.toPlayer === id) {
          this.exchangeState.delete(pid);
        }
      }
      if (this.isAllExchangeDone() || this.exchangeState.size === 0) {
        this.startPlaying();
      }
      return;
    }

    // 現在ターンの人が退出した場合、次のアクティブプレイヤーを探す
    if (isCurrent && this.phase === "playing") {
      let attempts = 0;
      while (
        (this.players[this.currentTurnIndex].finished || this.players[this.currentTurnIndex].passed) &&
        attempts < this.players.length
      ) {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        attempts++;
      }
    }
  }

  /** ゲーム開始: カード配布 */
  startGame(): void {
    const deck = shuffle(createDeck());
    const numPlayers = this.players.length;

    // prevRank を退避（即時スコア計算用）+ 状態リセット
    this.players.forEach((p) => {
      p.prevRank = p.rank;
      p.hand = [];
      p.passed = false;
      p.finished = false;
      p.finishOrder = 0;
    });

    let idx = 0;
    for (const card of deck) {
      this.players[idx % numPlayers].hand.push(card);
      idx++;
    }

    // 手札ソート
    this.players.forEach((p) => {
      p.hand = sortHand(p.hand, this.isRevolution);
    });

    // 手札にJokerまたは2が含まれるかを記録
    this.players.forEach((p) => {
      p.hadStrongCards = p.hand.some(
        (c) => isJoker(c) || (!isJoker(c) && (c as Card).rank === "2")
      );
    });

    // ♥7を持つプレイヤーが先攻
    const starterIndex = this.players.findIndex((p) =>
      p.hand.some((c) => !isJoker(c) && (c as Card).suit === "H" && (c as Card).rank === "7")
    );
    this.currentTurnIndex = starterIndex >= 0 ? starterIndex : 0;

    this.field = [];
    this.discardPile = [];
    this.nakiCount = 0;
    this.pendingEightCut = false;
    this.pendingElevenBack = false;
    this.finishCounter = 0;
    this.phase = "playing";
  }

  /** 新ゲーム用リセット（プレイヤーリストは維持、状態をクリア） */
  resetForNewGame(): void {
    this.field = [];
    this.discardPile = [];
    this.nakiCount = 0;
    this.pendingEightCut = false;
    this.pendingElevenBack = false;
    this.eightCutPending = false;
    this.finishCounter = 0;
    this.currentTurnIndex = 0;
    this.isRevolution = false;
    this.isElevenBack = false;
    this.round = 1;
    this.phase = "waiting";
    this.exchangeState.clear();
    this.prevDaifugoId = null;
    this.miyakoOchiResult = null;
    this.players.forEach((p) => {
      p.hand = [];
      p.rank = "平民";
      p.prevRank = "平民";
      p.passed = false;
      p.finished = false;
      p.finishOrder = 0;
      p.hadStrongCards = false;
    });
  }

  /** 現在のターンプレイヤー */
  get currentPlayer(): PlayerState {
    return this.players[this.currentTurnIndex];
  }

  /** カードを出す */
  playCards(playerId: string, cardIds: string[]): {
    success: boolean;
    error?: string;
    nakiChance?: boolean;
    revolution?: boolean;
    eightCut?: boolean;
    eightCutCards?: GameCard[];
    elevenBack?: boolean;
    playerFinished?: boolean;
    miyakoOchi?: { playerId: string; playerName: string };
    spade3Cut?: boolean;
  } {
    if (this.phase !== "playing") return { success: false, error: "現在カードを出せません" };
    if (this.spade3CutPending) return { success: false, error: "♠3カット演出中です" };
    if (this.eightCutPending) return { success: false, error: "8切り演出中です" };
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: "プレイヤーが見つかりません" };
    if (this.currentPlayer.id !== playerId) return { success: false, error: "あなたのターンではありません" };
    if (player.finished) return { success: false, error: "すでに上がっています" };

    const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)).filter(Boolean) as GameCard[];
    if (cards.length !== cardIds.length) return { success: false, error: "無効なカードです" };

    // 複数枚出し: 同ランク or 連番（ジョーカーはワイルド）
    let isSequencePlay = false;
    if (cards.length > 1) {
      const normalCards = cards.filter((c) => !isJoker(c)) as Card[];
      if (normalCards.length > 0) {
        const rank = normalCards[0].rank;
        const sameRank = normalCards.every((c) => c.rank === rank);
        if (!sameRank) {
          // 同ランクでなければ連番チェック
          if (isValidSequence(cards)) {
            isSequencePlay = true;
          } else {
            return { success: false, error: "同じ数字のカード、または同スートの連番3枚以上を出してください" };
          }
        }
      }
    }

    // 実効的な革命状態（革命 XOR イレブンバック）
    const effectiveRevolution = this.isRevolution !== this.isElevenBack;

    // バリデーション: 場にカードがある場合、同枚数で強いカードのみ
    if (this.field.length > 0) {
      // ジョーカー単体は♠3でのみ切れる → 場を流して♠3プレイヤーのターンに
      if (this.field.length === 1 && isJoker(this.field[0])) {
        if (!canBeatJoker(cards)) {
          return { success: false, error: "ジョーカーには♠3でのみ切れます" };
        }
        // 手札から♠3を除去
        player.hand = player.hand.filter((c) => !cardIds.includes(c.id));
        // ジョーカーを捨て札へ、♠3を場に表示（3秒後にGameRoomが流す）
        this.discardPile.push(...this.field);
        this.field = cards;
        this.spade3CutPending = true;
        // 上がりチェック
        let playerFinished = false;
        let miyakoOchi: { playerId: string; playerName: string } | undefined;
        if (player.hand.length === 0) {
          this.finishCounter++;
          player.finished = true;
          player.finishOrder = this.finishCounter;
          this.assignRankImmediate(player);
          playerFinished = true;
          miyakoOchi = this.checkMiyakoOchi(playerId);
        }
        // ♠3カットは8切りと同様にそのプレイヤーのターン継続
        // ただしラウンド終了チェックは必要
        this.currentTurnIndex = this.players.indexOf(player);
        const activePlayers = this.players.filter((p) => !p.finished);
        if (activePlayers.length <= 1) {
          if (activePlayers.length === 1) {
            this.finishCounter++;
            activePlayers[0].finished = true;
            activePlayers[0].finishOrder = this.finishCounter;
            this.assignRankImmediate(activePlayers[0]);
          }
          this.phase = "round_end";
          this.assignRanks();
        }
        return { success: true, spade3Cut: true, playerFinished, miyakoOchi };
      } else {
        if (cards.length !== this.field.length) {
          return { success: false, error: "同じ枚数で出してください" };
        }

        // タイプチェック: 場が連番なら連番で返す必要あり、場が同ランクなら連番不可
        if (this.fieldType === "sequence" && !isSequencePlay) {
          return { success: false, error: "連番には連番で返してください" };
        }
        if (this.fieldType !== "sequence" && isSequencePlay) {
          return { success: false, error: "連番は連番の場にしか出せません" };
        }

        // 強さチェック
        if (isSequencePlay && this.fieldType === "sequence") {
          // 連番同士: 最小インデックスで比較
          const playedMin = getSequenceMinIndex(cards);
          const fieldMin = getSequenceMinIndex(this.field);
          if (effectiveRevolution) {
            if (playedMin >= fieldMin) {
              return { success: false, error: "より強い連番を出してください" };
            }
          } else {
            if (playedMin <= fieldMin) {
              return { success: false, error: "より強い連番を出してください" };
            }
          }
        } else {
          // 同ランク同士: 代表カードで比較
          const playedRep = cards.find((c) => !isJoker(c)) || cards[0];
          const fieldRep = this.field.find((c) => !isJoker(c)) || this.field[0];
          if (compareCards(playedRep, fieldRep, effectiveRevolution) <= 0) {
            return { success: false, error: "より強いカードを出してください" };
          }
        }
      }
    }

    // 手札からカードを除去
    player.hand = player.hand.filter((c) => !cardIds.includes(c.id));

    // 場に出す
    this.discardPile.push(...this.field);
    this.field = cards;

    // fieldType設定
    if (isSequencePlay) {
      this.fieldType = "sequence";
    } else if (cards.length === 1) {
      this.fieldType = "single";
    } else if (cards.length === 2) {
      this.fieldType = "pair";
    } else if (cards.length === 3) {
      this.fieldType = "triple";
    } else {
      this.fieldType = "quad";
    }

    // パス状態リセット
    this.players.forEach((p) => {
      if (!p.finished) p.passed = false;
    });

    // 革命チェック
    let revolution = false;
    if (isRevolutionPlay(cards)) {
      this.isRevolution = !this.isRevolution;
      revolution = true;
      // 全員の手札を再ソート
      this.players.forEach((p) => {
        p.hand = sortHand(p.hand, this.isRevolution);
      });
    }

    // イレブンバックチェック: Jを含むカードでカード強さ一時逆転
    let elevenBack = false;
    const normalCards = cards.filter((c) => !isJoker(c)) as Card[];
    const hasJack = normalCards.some((c) => c.rank === "J");

    // 8切りチェック: 8を含むカードで場が流れる
    let eightCut = false;
    const hasEight = normalCards.some((c) => c.rank === "8");
    if (hasEight) {
      eightCut = true;
    }

    // 上がりチェック
    let playerFinished = false;
    let miyakoOchi: { playerId: string; playerName: string } | undefined;
    if (player.hand.length === 0) {
      this.finishCounter++;
      player.finished = true;
      player.finishOrder = this.finishCounter;
      this.assignRankImmediate(player);
      playerFinished = true;
      miyakoOchi = this.checkMiyakoOchi(playerId);
    }

    // 鳴きチャンスチェック（8切り・イレブンバックより優先）
    let nakiChance = false;
    if (cards.length === 1 && !isJoker(cards[0])) {
      const card = cards[0] as Card;
      if (NAKI_RANKS.includes(card.rank)) {
        // 他のプレイヤーで鳴ける人がいるかチェック
        const canAnyone = this.players.some((p) =>
          p.id !== playerId && !p.finished && canNaki(cards[0], p.hand).possible
        );
        if (canAnyone) {
          nakiChance = true;
          this.phase = "naki_chance";
          // 8切り・イレブンバックは鳴きウィンドウ解決時に判定
          this.pendingEightCut = eightCut;
          this.pendingElevenBack = hasJack;
          return { success: true, nakiChance, eightCut: false, elevenBack: false, revolution, playerFinished, miyakoOchi };
        }
      }
    }

    // 鳴きウィンドウに入らなかった場合はイレブンバックを即時適用
    if (hasJack) {
      this.isElevenBack = !this.isElevenBack;
      elevenBack = true;
    }

    // 8切り: 場のクリアは GameRoom が broadcastGameState 後に行う（革命との併発時に場のカードを表示するため）
    if (eightCut) {
      this.eightCutPending = true;
      // 上がっていなければそのまま自分のターン、上がっていれば次へ
      if (playerFinished) {
        this.advanceTurn();
      }
      return { success: true, eightCut, eightCutCards: cards, elevenBack, revolution, playerFinished, miyakoOchi };
    }

    if (!nakiChance) {
      this.advanceTurn();
    }

    return { success: true, nakiChance, eightCut, elevenBack, revolution, playerFinished, miyakoOchi };
  }

  /** 鳴き実行 */
  doIntercept(playerId: string): {
    success: boolean;
    error?: string;
    cards?: GameCard[];
    playerFinished?: boolean;
    miyakoOchi?: { playerId: string; playerName: string };
  } {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: "プレイヤーが見つかりません" };
    if (this.field.length !== 1) return { success: false, error: "鳴き対象がありません" };

    const result = canNaki(this.field[0], player.hand);
    if (!result.possible || !result.prev || !result.next) {
      return { success: false, error: "鳴けません" };
    }

    // 手札から2枚除去
    player.hand = player.hand.filter(
      (c) => c.id !== result.prev!.id && c.id !== result.next!.id
    );

    const nakiCards = [result.prev, this.field[0], result.next];

    // 鳴き成立 → 8切り・イレブンバックのペンディングをキャンセル
    this.pendingEightCut = false;
    this.pendingElevenBack = false;

    // 全て捨て札へ、場をクリア
    this.discardPile.push(...nakiCards);
    this.field = [];
    this.fieldType = "single";
    this.isElevenBack = false;
    this.nakiCount++;

    // 鳴いたプレイヤーのターンに
    this.currentTurnIndex = this.players.indexOf(player);
    this.phase = "playing";

    // パスリセット
    this.players.forEach((p) => {
      if (!p.finished) p.passed = false;
    });

    // 上がりチェック（鳴き上がり）
    let playerFinished = false;
    let miyakoOchi: { playerId: string; playerName: string } | undefined;
    if (player.hand.length === 0) {
      this.finishCounter++;
      player.finished = true;
      player.finishOrder = this.finishCounter;
      this.assignRankImmediate(player);
      playerFinished = true;
      miyakoOchi = this.checkMiyakoOchi(playerId);
    }

    return { success: true, cards: nakiCards, playerFinished, miyakoOchi };
  }

  /** パス */
  doPass(playerId: string): { success: boolean; error?: string; fieldCleared?: boolean } {
    if (this.phase !== "playing") return { success: false, error: "現在パスできません" };
    if (this.spade3CutPending) return { success: false, error: "♠3カット演出中です" };
    if (this.eightCutPending) return { success: false, error: "8切り演出中です" };
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: "プレイヤーが見つかりません" };
    if (this.currentPlayer.id !== playerId) return { success: false, error: "あなたのターンではありません" };

    player.passed = true;

    // 出した人以外が全員パスしたか確認
    const activePlayers = this.players.filter((p) => !p.finished && !p.passed);
    if (activePlayers.length <= 1) {
      // 場を流す → 残った人（最後に出したプレイヤー）のターン
      this.discardPile.push(...this.field);
      this.field = [];
      this.fieldType = "single";
      this.isElevenBack = false;
      this.players.forEach((p) => {
        if (!p.finished) p.passed = false;
      });
      // 残った1人にターンを設定
      if (activePlayers.length === 1) {
        this.currentTurnIndex = this.players.indexOf(activePlayers[0]);
      }
      return { success: true, fieldCleared: true };
    }

    this.advanceTurn();
    return { success: true, fieldCleared: false };
  }

  /** 鳴きウィンドウ解決（スキップ or タイムアウト）→ 次ターンへ */
  resolveNakiWindow(): { eightCut: boolean; eightCutCards?: GameCard[]; elevenBack: boolean } {
    if (this.phase !== "naki_chance") return { eightCut: false, elevenBack: false };
    this.phase = "playing";

    // 鳴かれなかったイレブンバックを確定
    let elevenBack = false;
    if (this.pendingElevenBack) {
      this.pendingElevenBack = false;
      this.isElevenBack = !this.isElevenBack;
      elevenBack = true;
    }

    // 鳴かれなかった8 → 8切り発動
    if (this.pendingEightCut) {
      this.pendingEightCut = false;
      const eightCutCards = [...this.field];
      this.discardPile.push(...this.field);
      this.field = [];
      this.fieldType = "single";
      this.isElevenBack = false;
      this.players.forEach((p) => {
        if (!p.finished) p.passed = false;
      });
      // 出したプレイヤーが上がっていれば次へ
      const currentPlayer = this.players[this.currentTurnIndex];
      if (currentPlayer.finished) {
        this.advanceTurn();
      }
      return { eightCut: true, eightCutCards, elevenBack };
    }

    this.advanceTurn();
    return { eightCut: false, elevenBack };
  }

  /** ♠3カット演出解決: 場をクリアして次のターンへ */
  resolveSpade3Cut(): void {
    if (!this.spade3CutPending) return;
    this.spade3CutPending = false;
    this.discardPile.push(...this.field);
    this.field = [];
    this.fieldType = "single";
    this.isElevenBack = false;
    this.players.forEach((p) => {
      if (!p.finished) p.passed = false;
    });
  }

  /** 8切り演出解決: 場をクリアして次のターンへ */
  resolveEightCut(): void {
    if (!this.eightCutPending) return;
    this.eightCutPending = false;
    this.discardPile.push(...this.field);
    this.field = [];
    this.fieldType = "single";
    this.isElevenBack = false;
    this.players.forEach((p) => {
      if (!p.finished) p.passed = false;
    });
  }

  /** 都落ちチェック: 前ラウンド大富豪以外が最初に上がったら即時発動 */
  private checkMiyakoOchi(finishedPlayerId: string): { playerId: string; playerName: string } | undefined {
    // 最初の上がり（finishOrder === 1）でなければ対象外
    if (this.finishCounter !== 1) return undefined;
    // 前ラウンド大富豪がいなければ対象外
    if (!this.prevDaifugoId) return undefined;
    // 上がった人が前大富豪本人なら都落ちなし
    if (finishedPlayerId === this.prevDaifugoId) return undefined;

    const prevDaifugo = this.players.find((p) => p.id === this.prevDaifugoId);
    if (!prevDaifugo || prevDaifugo.finished) return undefined;

    // 前大富豪の手札を破棄して最下位確定・大貧民に降格
    // finishCounter はインクリメントしない（被害者は finishOrder/rank を直接設定）
    // これにより残りプレイヤーが 2,3,...,players.length-1 の順位を使い衝突しない
    this.discardPile.push(...prevDaifugo.hand);
    prevDaifugo.hand = [];
    prevDaifugo.finished = true;
    prevDaifugo.finishOrder = this.players.length; // 最下位
    prevDaifugo.rank = "大貧民";

    this.miyakoOchiResult = {
      playerId: prevDaifugo.id,
      playerName: prevDaifugo.name,
    };

    return this.miyakoOchiResult;
  }

  /** 次のターンへ */
  private advanceTurn(): void {
    let next = (this.currentTurnIndex + 1) % this.players.length;
    let attempts = 0;
    while ((this.players[next].finished || this.players[next].passed) && attempts < this.players.length) {
      next = (next + 1) % this.players.length;
      attempts++;
    }
    this.currentTurnIndex = next;

    // ラウンド終了チェック
    const activePlayers = this.players.filter((p) => !p.finished);
    if (activePlayers.length <= 1) {
      // 最後の1人も順位確定
      if (activePlayers.length === 1) {
        this.finishCounter++;
        activePlayers[0].finished = true;
        activePlayers[0].finishOrder = this.finishCounter;
        this.assignRankImmediate(activePlayers[0]);
      }
      this.phase = "round_end";
      this.assignRanks();
    }
  }

  /** finishOrder に対応するランクとスコアを即時割り当て */
  private assignRankImmediate(player: PlayerState): void {
    const n = this.players.length;
    const rankTable3: PlayerRank[] = ["大富豪", "平民", "大貧民"];
    const rankTable4: PlayerRank[] = ["大富豪", "富豪", "貧民", "大貧民"];
    const rankTable5: PlayerRank[] = ["大富豪", "富豪", "平民", "貧民", "大貧民"];
    const table = n === 3 ? rankTable3 : n === 4 ? rankTable4 : rankTable5;
    const idx = player.finishOrder - 1; // finishOrder は 1 始まり
    if (idx >= 0 && idx < table.length) {
      player.rank = table[idx];
    }

    // スコア即時加算
    const scoreTable = RANK_SCORE[n] || RANK_SCORE[5];
    let pts = scoreTable[player.rank] || 0;

    // 下剋上ボーナス: 前ラウンド大貧民 → 今ラウンド大富豪/富豪
    if (player.prevRank === "大貧民") {
      if (player.rank === "大富豪") pts += 10;
      else if (player.rank === "富豪") pts += 7;
    }

    // ノー強カードボーナス: Joker/2なし手札で大富豪 or 富豪
    if (!player.hadStrongCards && (player.rank === "大富豪" || player.rank === "富豪")) {
      pts += 3;
    }

    player.totalScore += pts;
  }

  /** 階級を最終確定（スコアは assignRankImmediate で即時加算済み） */
  private assignRanks(): void {
    // 今回の大富豪を記録
    const newDaifugo = this.players.find((p) => p.rank === "大富豪");
    this.prevDaifugoId = newDaifugo?.id || null;
  }

  /** 次のラウンド開始: カード配布 + 交換フェーズ */
  startNextRound(): void {
    if (this.players.length === 0) {
      this.phase = "waiting";
      return;
    }

    this.round++;
    this.field = [];
    this.discardPile = [];
    this.nakiCount = 0;
    this.pendingEightCut = false;
    this.pendingElevenBack = false;
    this.spade3CutPending = false;
    this.eightCutPending = false;
    this.finishCounter = 0;
    this.isRevolution = false;
    this.isElevenBack = false;
    this.miyakoOchiResult = null;

    const deck = shuffle(createDeck());
    const numPlayers = this.players.length;

    // prevRank を退避（即時スコア計算用）+ 状態リセット
    this.players.forEach((p) => {
      p.prevRank = p.rank;
      p.hand = [];
      p.passed = false;
      p.finished = false;
      p.finishOrder = 0;
    });

    let idx = 0;
    for (const card of deck) {
      this.players[idx % numPlayers].hand.push(card);
      idx++;
    }

    // 手札ソート
    this.players.forEach((p) => {
      p.hand = sortHand(p.hand, this.isRevolution);
    });

    this.setupExchange();
  }

  /** 階級に基づいて交換ペアを設定 */
  private setupExchange(): void {
    this.exchangeState.clear();
    const n = this.players.length;

    // 全員平民（ラウンド1直後等）なら交換なし
    const allCommoner = this.players.every((p) => p.rank === "平民");
    if (allCommoner) {
      this.startPlaying();
      return;
    }

    const daifu = this.players.find((p) => p.rank === "大富豪");
    const daihin = this.players.find((p) => p.rank === "大貧民");
    const fu = this.players.find((p) => p.rank === "富豪");
    const hin = this.players.find((p) => p.rank === "貧民");

    // 大富豪 ↔ 大貧民: 2枚交換
    if (daifu && daihin) {
      this.exchangeState.set(daihin.id, {
        toGive: 2, toPlayer: daifu.id, given: false, received: [],
      });
      this.exchangeState.set(daifu.id, {
        toGive: 2, toPlayer: daihin.id, given: false, received: [],
      });
    }

    // 富豪 ↔ 貧民: 1枚交換（4人以上の場合のみ）
    if (fu && hin) {
      this.exchangeState.set(hin.id, {
        toGive: 1, toPlayer: fu.id, given: false, received: [],
      });
      this.exchangeState.set(fu.id, {
        toGive: 1, toPlayer: hin.id, given: false, received: [],
      });
    }

    if (this.exchangeState.size === 0) {
      this.startPlaying();
      return;
    }

    this.phase = "card_exchange";
  }

  /** 大貧民/貧民の最強カードを自動で渡す */
  executeAutoExchanges(): void {
    // 大貧民 → 大富豪: 最強2枚自動
    const daihin = this.players.find((p) => p.rank === "大貧民");
    if (daihin) {
      this.autoGiveStrongest(daihin.id, 2);
    }

    // 貧民 → 富豪: 最強1枚自動
    const hin = this.players.find((p) => p.rank === "貧民");
    if (hin) {
      this.autoGiveStrongest(hin.id, 1);
    }

    // 全員完了チェック
    if (this.isAllExchangeDone()) {
      this.startPlaying();
    }
  }

  /** 最強カードをN枚自動選出し相手に渡す */
  private autoGiveStrongest(playerId: string, count: number): void {
    const entry = this.exchangeState.get(playerId);
    if (!entry || entry.given) return;

    const player = this.players.find((p) => p.id === playerId);
    const receiver = this.players.find((p) => p.id === entry.toPlayer);
    if (!player || !receiver) return;

    // sortHandは弱→強でソートされるので、末尾N枚が最強
    const sorted = sortHand(player.hand, this.isRevolution);
    const strongest = sorted.slice(-count);

    // 手札から除去
    const strongestIds = new Set(strongest.map((c) => c.id));
    player.hand = player.hand.filter((c) => !strongestIds.has(c.id));

    // 相手に渡す
    receiver.hand.push(...strongest);
    receiver.hand = sortHand(receiver.hand, this.isRevolution);

    // 受け取り記録（相手側のexchangeStateに記録）
    const receiverEntry = this.exchangeState.get(receiver.id);
    if (receiverEntry) {
      receiverEntry.received = strongest;
    }

    entry.given = true;
  }

  /** 手動カード交換（大富豪/富豪がカードを選んで渡す） */
  doCardExchange(playerId: string, cardIds: string[]): {
    success: boolean;
    error?: string;
    allDone?: boolean;
  } {
    const entry = this.exchangeState.get(playerId);
    if (!entry) return { success: false, error: "交換対象ではありません" };
    if (entry.given) return { success: false, error: "すでに交換済みです" };
    if (cardIds.length !== entry.toGive) {
      return { success: false, error: `${entry.toGive}枚選んでください` };
    }

    const player = this.players.find((p) => p.id === playerId);
    const receiver = this.players.find((p) => p.id === entry.toPlayer);
    if (!player || !receiver) return { success: false, error: "プレイヤーが見つかりません" };

    // カード検証
    const cards = cardIds.map((id) => player.hand.find((c) => c.id === id)).filter(Boolean) as GameCard[];
    if (cards.length !== cardIds.length) return { success: false, error: "無効なカードです" };

    // 手札から除去
    player.hand = player.hand.filter((c) => !cardIds.includes(c.id));

    // 相手に渡す
    receiver.hand.push(...cards);
    receiver.hand = sortHand(receiver.hand, this.isRevolution);

    // 受け取り記録（相手側のexchangeStateに記録）
    const receiverEntry = this.exchangeState.get(receiver.id);
    if (receiverEntry) {
      receiverEntry.received = cards;
    }

    entry.given = true;

    const allDone = this.isAllExchangeDone();
    if (allDone) {
      this.startPlaying();
    }

    return { success: true, allDone };
  }

  /** 全交換完了チェック */
  private isAllExchangeDone(): boolean {
    for (const [, entry] of this.exchangeState) {
      if (!entry.given) return false;
    }
    return true;
  }

  /** playing フェーズを開始（先攻は大貧民） */
  private startPlaying(): void {
    this.phase = "playing";

    // 交換後の手札にJokerまたは2が含まれるかを記録
    this.players.forEach((p) => {
      p.hadStrongCards = p.hand.some(
        (c) => isJoker(c) || (!isJoker(c) && (c as Card).rank === "2")
      );
    });

    // 先攻: 大貧民（最下位）→ 存在しなければ♥7持ち
    const daihin = this.players.find((p) => p.rank === "大貧民");
    if (daihin) {
      this.currentTurnIndex = this.players.indexOf(daihin);
    } else {
      // ラウンド1: ♥7持ちが先攻
      const starterIndex = this.players.findIndex((p) =>
        p.hand.some((c) => !isJoker(c) && (c as Card).suit === "H" && (c as Card).rank === "7")
      );
      this.currentTurnIndex = starterIndex >= 0 ? starterIndex : 0;
    }

    this.exchangeState.clear();
  }

  /** 交換フェーズの情報を特定プレイヤー向けに取得 */
  getExchangeInfo(playerId: string): {
    needToGive: number;
    receivedCards: GameCard[];
    waitingFor: string[];
  } | undefined {
    if (this.phase !== "card_exchange") return undefined;

    const entry = this.exchangeState.get(playerId);
    const needToGive = entry && !entry.given ? entry.toGive : 0;
    const receivedCards = entry?.received || [];

    // まだ交換を完了していないプレイヤー名
    const waitingFor: string[] = [];
    for (const [pid, e] of this.exchangeState) {
      if (!e.given) {
        const p = this.players.find((pl) => pl.id === pid);
        if (p) waitingFor.push(p.name);
      }
    }

    return { needToGive, receivedCards, waitingFor };
  }

  /** プレイヤーの公開情報を取得 */
  getPlayerInfo(forPlayerId: string) {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      rank: p.rank,
      passed: p.passed,
      isCurrentTurn: this.currentPlayer.id === p.id,
      finished: p.finished,
      totalScore: p.totalScore,
      avatar: p.avatar,
    }));
  }

  /** 特定プレイヤーの手札を取得 */
  getHand(playerId: string): GameCard[] {
    const player = this.players.find((p) => p.id === playerId);
    return player ? player.hand : [];
  }
}
