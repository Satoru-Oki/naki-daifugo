---
name: debug-game
description: ゲームのバグ調査・デバッグ時に使用。エラー解析、状態不整合の調査時に自動で参照する。
disable-model-invocation: true
---

# デバッグ手順

## よくある問題と確認ポイント

### カードが出せない
1. `GameEngine.playCards()` のバリデーションを確認
2. 場のカードと同枚数か？より強いカードか？
3. 革命中は強さ順が逆になっているか？

### 鳴きが発動しない
1. 対象カードのランクが 6〜Q か？（NAKI_RANKS）
2. 同スートの前後カードを両方持っているか？
3. 単体出しか？（ペア出しには鳴けない）

### 状態の不整合
1. shared/ の型とサーバーの状態が一致しているか
2. Socket.ioで送信するClientGameStateに手札が正しく含まれているか
3. 革命フラグが正しくトグルされているか

## デバッグコマンド
```bash
# サーバーログ確認
npm run dev:server

# TypeScript型チェック
npx tsc -p server/tsconfig.json --noEmit

# フロントビルドチェック
npx next build
```
