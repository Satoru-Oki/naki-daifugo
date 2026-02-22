---
name: component
description: Reactコンポーネントの新規作成・修正時に使用。UI実装、ページ、レイアウトの作成時に自動で参照する。
---

# コンポーネント作成ガイド

## 技術スタック
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- @letele/playing-cards（トランプカード描画）

## ルール
1. すべてのコンポーネントは `src/components/` に配置
2. ファイル先頭に `"use client";` を付ける（インタラクティブなもの）
3. Props は interface で型定義する
4. ゲームの型は `@/lib/types` からインポート（shared/ の再エクスポート）

## カード描画
```tsx
import * as deck from "@letele/playing-cards";
// キー例: S7(♠7), Hq(♥Q), Ca(♣A), J1(Joker), B1(裏面)
const CardSvg = cardComponents["S7"];
<CardSvg style={{ width: "100%", height: "100%" }} />
```

## 既存コンポーネント一覧
- PlayingCard.tsx: カード描画ラッパー
- Hand.tsx: 手札表示（タップ選択）
- Field.tsx: 場のカード
- NakiPopup.tsx: 鳴きチャンスUI
- OpponentBar.tsx: 対戦相手
- GameHeader.tsx: ヘッダー
- GameUI.tsx: ボイス・チャット・アクションボタン
- HistoryPanel.tsx: カード履歴
- Notification.tsx: 通知トースト
