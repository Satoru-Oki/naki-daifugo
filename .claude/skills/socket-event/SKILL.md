---
name: socket-event
description: Socket.ioイベントの追加・修正時、リアルタイム通信の実装時に自動で参照する。
---

# Socket.io イベント実装ガイド

## 型定義
イベントの型は `shared/events.ts` で一元管理。
フロント・バック両方がこの型を参照する。

## 実装箇所
- サーバー: `server/src/GameRoom.ts` でハンドラ登録
- クライアント: `socket.io-client` で接続

## 既存イベント
| イベント | 方向 | 用途 |
|---|---|---|
| join_room | C→S | ルーム参加 |
| game_state | S→C | 状態同期（手札は本人のみ） |
| play_card | C→S | カードを出す |
| pass | C→S | パス |
| intercept | C→S | 鳴き宣言 |
| intercept_window | S→C | 鳴きチャンス通知（5秒タイマー） |
| round_end | S→C | ラウンド終了 |
| chat_message | C↔S | チャット |

## 新規イベント追加手順
1. `shared/events.ts` の ClientToServerEvents or ServerToClientEvents に型追加
2. `server/src/GameRoom.ts` にハンドラ追加
3. フロント側で emit / on を実装
