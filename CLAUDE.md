`# 鳴き大富豪 (NAKI DAIFUGO)

## プロジェクト概要
大富豪 × 麻雀の「鳴き（チー）」を組み合わせた新感覚カードゲーム。
スマホ対応Webアプリとしてオンライン対戦を実現する。

## 技術スタック
- **フロントエンド**: Next.js (TypeScript) + Tailwind CSS
- **バックエンド**: Node.js + Express + TypeScript
- **リアルタイム通信**: Socket.io
- **ボイスチャット**: WebRTC (Phase 2)
- **カード描画**: @letele/playing-cards (SVG)

## ディレクトリ構成
```
naki-daifugo/
├── src/                    # Next.js フロントエンド
│   ├── app/                # App Router ページ
│   ├── components/         # Reactコンポーネント
│   └── lib/                # フロント用ユーティリティ
├── shared/                 # フロント・バック共有コード
│   ├── types.ts            # 共有型定義
│   ├── constants.ts        # 共有定数
│   └── gameLogic.ts        # ゲームロジック（鳴き判定・革命等）
├── server/                 # バックエンド
│   └── src/
│       ├── index.ts        # Expressサーバー + Socket.io
│       ├── GameRoom.ts     # ゲームルーム管理
│       └── GameEngine.ts   # サーバーサイドゲームエンジン
├── CLAUDE.md               # このファイル
├── naki_daifugo_rules.md   # このアプリで実現するゲームのルール 
└── package.json
```

## 開発コマンド
```bash
npm run dev          # フロント (Next.js dev server)
npm run dev:server   # バックエンド (ts-node-dev)
npm run dev:all      # 両方同時起動 (concurrently)
npm run build        # プロダクションビルド
```

## ゲームルール要点
- 54枚（52+ジョーカー2枚）、3〜5人
- 強さ: 3<4<...<A<2<Joker （革命時は逆）
- **鳴き**: 単体出し時、対象ランク6〜Qに対し同スートの前後カードで3枚セット完成
- **革命**: 同ランク4枚以上 or 同スート連番4枚以上（Joker含む可）
- Jokerは♠3でのみ切れる
- 初回♥7持ちが先攻
- **得点**: 人数別ランク基本点（5人: 大富豪7/富豪4/平民2/貧民1/大貧民0、4人: 5/3/-/1/0、3人: 4/2/-/-/0）
- **下剋上ボーナス**: 前ラウンド大貧民→大富豪+10点、→富豪+7点
- **ノー強カードボーナス**: Joker/2なし手札で大富豪or富豪 → +3点

## Socket.ioイベント
- socket.ioに関する開発を行う場合は@.claude/skills/websocket-engineerを使用すること
- イベントに関しては@.claude/skills/socket-event参照のこと
| イベント | 方向 | 用途 |
|---|---|---|
| join_room | C→S | ルーム参加 |
| game_state | S→C | 状態同期 |
| play_card | C→S | カードを出す |
| pass | C→S | パス |
| intercept | C→S | 鳴き宣言 |
| intercept_window | S→C | 鳴きチャンス通知 |
| round_end | S→C | ラウンド終了 |
| chat_message | C↔S | チャット |

## コーディング規約
- TypeScript strict mode
- 日本語コメント可、変数名・関数名は英語
- shared/ の変更はフロント・バック両方に影響するため注意
- ゲームの正式ルールは naki_daifugo_rules.md を参照
