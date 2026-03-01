import type { Card, Rank, Suit } from "../../shared/types";
import type {
  PokerCard, PokerPhase, PokerAction, PokerPlayerState, PokerPlayerInfo, PokerClientState,
} from "../../shared/poker/types";
import { SMALL_BLIND, BIG_BLIND, INITIAL_CHIPS } from "../../shared/poker/constants";
import { evaluateHand, compareHands } from "../../shared/poker/handEvaluator";
import { shuffle, createPokerDeck } from "../../shared/gameLogic";

export class PokerEngine {
  players: PokerPlayerState[] = [];
  communityCards: PokerCard[] = [];
  deck: PokerCard[] = [];
  pot = 0;
  currentBet = 0;
  minRaise = BIG_BLIND;
  dealerIndex = 0;
  currentTurnIndex = 0;
  phase: PokerPhase = "waiting";
  round = 0;
  /** ショーダウン結果 */
  winners: { playerId: string; playerName: string; amount: number; handLabel: string }[] = [];

  /** プレイヤー追加 */
  addPlayer(id: string, name: string, avatar?: string): void {
    this.players.push({
      id,
      name,
      chips: INITIAL_CHIPS,
      holeCards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      folded: false,
      allIn: false,
      hasActed: false,
      seatIndex: this.players.length,
      avatar,
    });
  }

  /** プレイヤー削除 */
  removePlayer(id: string): void {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;

    this.players.splice(idx, 1);

    // インデックス補正
    if (this.players.length === 0) return;
    if (this.dealerIndex >= this.players.length) {
      this.dealerIndex = 0;
    }
    if (this.currentTurnIndex >= this.players.length) {
      this.currentTurnIndex = 0;
    }

    // ゲーム中かつアクティブプレイヤーが1人以下なら即終了
    if (this.phase !== "waiting" && this.phase !== "hand_end") {
      const active = this.players.filter((p) => !p.folded);
      if (active.length <= 1) {
        this.resolveHand();
      }
    }
  }

  /** 新しいハンドを開始 */
  startHand(): void {
    // チップ0のプレイヤーを除外
    this.players = this.players.filter((p) => p.chips > 0);
    if (this.players.length < 2) {
      this.phase = "waiting";
      return;
    }

    this.round++;
    this.deck = shuffle(createPokerDeck());
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.winners = [];

    // プレイヤーリセット
    this.players.forEach((p) => {
      p.holeCards = [];
      p.currentBet = 0;
      p.totalBetThisHand = 0;
      p.folded = false;
      p.allIn = false;
      p.hasActed = false;
    });

    // ディーラー移動（2ハンド目以降）
    if (this.round > 1) {
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    }

    // ブラインド投入
    const sbIdx = this.getNextActiveIndex(this.dealerIndex);
    const bbIdx = this.getNextActiveIndex(sbIdx);

    this.postBlind(sbIdx, SMALL_BLIND);
    this.postBlind(bbIdx, BIG_BLIND);

    this.currentBet = BIG_BLIND;

    // カード配布（各プレイヤーに2枚）
    for (let i = 0; i < 2; i++) {
      for (const p of this.players) {
        p.holeCards.push(this.deck.pop()!);
      }
    }

    // プリフロップ: BB の次のプレイヤーからアクション開始
    this.currentTurnIndex = this.getNextActiveIndex(bbIdx);
    this.phase = "pre_flop";
  }

  /** アクション実行 */
  doAction(playerId: string, action: PokerAction, amount?: number): { success: boolean; error?: string } {
    if (this.phase === "waiting" || this.phase === "hand_end" || this.phase === "showdown") {
      return { success: false, error: "現在アクションできません" };
    }

    const player = this.players[this.currentTurnIndex];
    if (!player || player.id !== playerId) {
      return { success: false, error: "あなたのターンではありません" };
    }
    if (player.folded || player.allIn) {
      return { success: false, error: "アクションできません" };
    }

    switch (action) {
      case "fold":
        player.folded = true;
        player.hasActed = true;
        break;

      case "check":
        if (player.currentBet < this.currentBet) {
          return { success: false, error: "チェックできません（ベットが必要です）" };
        }
        player.hasActed = true;
        break;

      case "call": {
        const callAmount = Math.min(this.currentBet - player.currentBet, player.chips);
        if (callAmount <= 0) {
          return { success: false, error: "コールする必要がありません" };
        }
        this.placeBet(player, callAmount);
        player.hasActed = true;
        break;
      }

      case "raise": {
        const raiseTotal = amount ?? (this.currentBet + this.minRaise);
        const needed = raiseTotal - player.currentBet;
        if (needed <= 0 || needed > player.chips) {
          return { success: false, error: "無効なレイズ額です" };
        }
        const raiseBy = raiseTotal - this.currentBet;
        if (raiseBy < this.minRaise && needed < player.chips) {
          // オールインでなければ最小レイズ以上必要
          return { success: false, error: `最低${this.minRaise}以上レイズしてください` };
        }
        this.minRaise = Math.max(this.minRaise, raiseBy);
        this.placeBet(player, needed);
        this.currentBet = raiseTotal;
        // レイズしたので他全員のhasActedをリセット
        this.players.forEach((p) => {
          if (p.id !== playerId && !p.folded && !p.allIn) {
            p.hasActed = false;
          }
        });
        player.hasActed = true;
        break;
      }

      case "all_in": {
        const allInAmount = player.chips;
        if (allInAmount <= 0) {
          return { success: false, error: "チップがありません" };
        }
        const newTotal = player.currentBet + allInAmount;
        if (newTotal > this.currentBet) {
          const raiseBy = newTotal - this.currentBet;
          if (raiseBy >= this.minRaise) {
            this.minRaise = raiseBy;
          }
          this.currentBet = newTotal;
          // レイズ相当なので他全員のhasActedをリセット
          this.players.forEach((p) => {
            if (p.id !== playerId && !p.folded && !p.allIn) {
              p.hasActed = false;
            }
          });
        }
        this.placeBet(player, allInAmount);
        player.hasActed = true;
        break;
      }
    }

    // フォールドでアクティブが1人だけになったら即終了
    const active = this.players.filter((p) => !p.folded);
    if (active.length <= 1) {
      this.resolveHand();
      return { success: true };
    }

    // 次のターンへ
    this.advanceTurn();
    return { success: true };
  }

  /** 次のターンプレイヤーへ。ベッティングラウンド終了ならフェーズ遷移 */
  private advanceTurn(): void {
    // ベッティングラウンドが終了したかチェック
    if (this.isBettingRoundComplete()) {
      this.nextPhase();
      return;
    }

    // 次のアクティブプレイヤーを探す
    let next = (this.currentTurnIndex + 1) % this.players.length;
    let attempts = 0;
    while (attempts < this.players.length) {
      const p = this.players[next];
      if (!p.folded && !p.allIn && !p.hasActed) {
        break;
      }
      next = (next + 1) % this.players.length;
      attempts++;
    }

    if (attempts >= this.players.length) {
      // 全員アクション済み → 次フェーズ
      this.nextPhase();
    } else {
      this.currentTurnIndex = next;
    }
  }

  /** ベッティングラウンドが完了したか */
  private isBettingRoundComplete(): boolean {
    const activePlayers = this.players.filter((p) => !p.folded && !p.allIn);
    // 全員フォールドorオールインなら終了
    if (activePlayers.length === 0) return true;
    // 全員がアクション済みかつベットが揃っているか
    return activePlayers.every((p) => p.hasActed && p.currentBet === this.currentBet);
  }

  /** 次のフェーズに進む */
  private nextPhase(): void {
    // ベットをポットに集約
    this.collectBets();

    // 全員オールインorフォールドの場合→残りのコミュニティカードを開いてショーダウン
    const canAct = this.players.filter((p) => !p.folded && !p.allIn);
    if (canAct.length <= 1 && this.players.filter((p) => !p.folded).length > 1) {
      // ランアウト（残りのカードを全部開く）
      while (this.communityCards.length < 5) {
        this.communityCards.push(this.deck.pop()!);
      }
      this.resolveHand();
      return;
    }

    switch (this.phase) {
      case "pre_flop":
        this.phase = "flop";
        this.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        break;
      case "flop":
        this.phase = "turn";
        this.communityCards.push(this.deck.pop()!);
        break;
      case "turn":
        this.phase = "river";
        this.communityCards.push(this.deck.pop()!);
        break;
      case "river":
        this.resolveHand();
        return;
    }

    // 新しいベッティングラウンドの準備
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.players.forEach((p) => {
      p.currentBet = 0;
      p.hasActed = false;
    });

    // ディーラーの次のアクティブプレイヤーから
    this.currentTurnIndex = this.getNextActiveNonAllInIndex(this.dealerIndex);
  }

  /** ハンド解決: 勝者判定とチップ配分 */
  private resolveHand(): void {
    this.collectBets();

    const active = this.players.filter((p) => !p.folded);

    if (active.length === 1) {
      // 全員フォールド→最後の1人が総取り
      const winner = active[0];
      winner.chips += this.pot;
      this.winners = [{
        playerId: winner.id,
        playerName: winner.name,
        amount: this.pot,
        handLabel: "",
      }];
    } else {
      // ショーダウン
      const hands = active.map((p) => ({
        player: p,
        hand: evaluateHand([...p.holeCards, ...this.communityCards]),
      }));

      // 最強ハンドを見つける
      hands.sort((a, b) => -compareHands(a.hand, b.hand));

      // 同着チェック
      const bestHand = hands[0].hand;
      const tiedWinners = hands.filter((h) => compareHands(h.hand, bestHand) === 0);

      const share = Math.floor(this.pot / tiedWinners.length);
      const remainder = this.pot - share * tiedWinners.length;

      this.winners = tiedWinners.map((h, idx) => {
        const amount = share + (idx === 0 ? remainder : 0);
        h.player.chips += amount;
        return {
          playerId: h.player.id,
          playerName: h.player.name,
          amount,
          handLabel: h.hand.label,
        };
      });
    }

    this.phase = "showdown";
    this.pot = 0;
  }

  /** ハンド終了を確定 */
  endHand(): void {
    this.phase = "hand_end";
  }

  /** ベットを集約してポットに */
  private collectBets(): void {
    for (const p of this.players) {
      this.pot += p.currentBet;
      p.currentBet = 0;
    }
  }

  /** ブラインド投入 */
  private postBlind(playerIndex: number, amount: number): void {
    const player = this.players[playerIndex];
    const actual = Math.min(amount, player.chips);
    this.placeBet(player, actual);
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  /** ベット処理 */
  private placeBet(player: PokerPlayerState, amount: number): void {
    player.chips -= amount;
    player.currentBet += amount;
    player.totalBetThisHand += amount;
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  /** 次のアクティブプレイヤーのインデックス */
  private getNextActiveIndex(fromIndex: number): number {
    let next = (fromIndex + 1) % this.players.length;
    let attempts = 0;
    while (this.players[next].folded && attempts < this.players.length) {
      next = (next + 1) % this.players.length;
      attempts++;
    }
    return next;
  }

  /** 次のアクティブ（フォールドもオールインもしてない）プレイヤーのインデックス */
  private getNextActiveNonAllInIndex(fromIndex: number): number {
    let next = (fromIndex + 1) % this.players.length;
    let attempts = 0;
    while ((this.players[next].folded || this.players[next].allIn) && attempts < this.players.length) {
      next = (next + 1) % this.players.length;
      attempts++;
    }
    return next;
  }

  /** 現在のターンプレイヤー */
  get currentPlayer(): PokerPlayerState | undefined {
    return this.players[this.currentTurnIndex];
  }

  /** SBインデックス */
  get sbIndex(): number {
    return this.getNextActiveIndex(this.dealerIndex);
  }

  /** BBインデックス */
  get bbIndex(): number {
    return this.getNextActiveIndex(this.sbIndex);
  }

  /** 特定プレイヤー向けのゲーム状態を生成 */
  getClientState(playerId: string): PokerClientState {
    const player = this.players.find((p) => p.id === playerId);
    const isShowdown = this.phase === "showdown";

    const players: PokerPlayerInfo[] = this.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      isDealer: idx === this.dealerIndex,
      isSB: idx === this.sbIndex,
      isBB: idx === this.bbIndex,
      isCurrentTurn: idx === this.currentTurnIndex && this.phase !== "showdown" && this.phase !== "hand_end",
      seatIndex: p.seatIndex,
      avatar: p.avatar,
      holeCards: isShowdown && !p.folded ? p.holeCards : undefined,
      handLabel: isShowdown && !p.folded
        ? evaluateHand([...p.holeCards, ...this.communityCards]).label
        : undefined,
    }));

    return {
      phase: this.phase,
      holeCards: player?.holeCards ?? [],
      communityCards: this.communityCards,
      players,
      pot: this.pot + this.players.reduce((sum, p) => sum + p.currentBet, 0),
      currentTurn: this.currentPlayer?.id ?? "",
      currentBet: this.currentBet,
      myChips: player?.chips ?? 0,
      myCurrentBet: player?.currentBet ?? 0,
      myTotalBetThisHand: player?.totalBetThisHand ?? 0,
      dealerIndex: this.dealerIndex,
      round: this.round,
      minRaise: this.minRaise,
      winners: isShowdown ? this.winners : undefined,
    };
  }
}
