# 鳴き大富豪 - アーキテクチャドキュメント

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router) + React 19 + TypeScript |
| スタイリング | Tailwind CSS 4 |
| バックエンド | Node.js + Express + TypeScript |
| リアルタイム通信 | Socket.io 4 |
| ボイスチャット | WebRTC (P2P) + Socket.io シグナリング |
| カード描画 | @letele/playing-cards (SVG) |
| サウンド | Web Audio API |
| ホスティング | Render.com |

---

## システム全体構成

```mermaid
graph TB
    subgraph Client["クライアント (Next.js)"]
        UI["React UI<br/>page.tsx + Components"]
        SocketClient["Socket.io Client<br/>src/lib/socket.ts"]
        WebRTCClient["WebRTC<br/>src/lib/webrtc.ts"]
        SFX["Sound Effects<br/>src/lib/sfx.ts"]
    end

    subgraph Server["サーバー (Express + Socket.io)"]
        Express["Express Server<br/>server/src/index.ts"]
        SessionMgr["SessionManager<br/>セッション管理"]
        subgraph Rooms["ゲームルーム群"]
            Room1["GameRoom"]
            Room2["GameRoom"]
            RoomN["GameRoom ..."]
        end
        subgraph Engines["ゲームエンジン群"]
            Engine1["GameEngine"]
            Engine2["GameEngine"]
            EngineN["GameEngine ..."]
        end
    end

    subgraph Shared["共有コード (shared/)"]
        Types["types.ts<br/>型定義"]
        Constants["constants.ts<br/>定数"]
        GameLogic["gameLogic.ts<br/>ゲームロジック"]
        Events["events.ts<br/>イベント定義"]
    end

    UI <-->|Socket.io| SocketClient
    SocketClient <-->|WebSocket| Express
    WebRTCClient <-.->|シグナリング| Express
    WebRTCClient <-.->|P2P 音声| WebRTCClient

    Express --> SessionMgr
    Express --> Rooms
    Room1 --> Engine1
    Room2 --> Engine2
    RoomN --> EngineN

    Client -.->|import| Shared
    Server -.->|import| Shared
```

---

## ディレクトリ構成

```mermaid
graph LR
    Root["naki-daifugo/"]
    Root --> Src["src/"]
    Root --> ServerDir["server/"]
    Root --> SharedDir["shared/"]

    Src --> App["app/<br/>App Router ページ"]
    Src --> Components["components/<br/>15 コンポーネント"]
    Src --> Lib["lib/<br/>ユーティリティ"]

    ServerDir --> ServerSrc["src/"]
    ServerSrc --> Index["index.ts<br/>Express + Socket.io"]
    ServerSrc --> GameRoom["GameRoom.ts<br/>ルーム管理"]
    ServerSrc --> GameEngine["GameEngine.ts<br/>ゲームエンジン"]
    ServerSrc --> SessionManager["SessionManager.ts<br/>セッション管理"]

    SharedDir --> TypesF["types.ts"]
    SharedDir --> ConstantsF["constants.ts"]
    SharedDir --> GameLogicF["gameLogic.ts"]
    SharedDir --> EventsF["events.ts"]
```

---

## フロントエンド コンポーネント階層

```mermaid
graph TD
    Page["page.tsx<br/>メインオーケストレーター<br/>画面遷移 + 全状態管理"]

    Page --> Lobby["Lobby<br/>ルーム作成・参加<br/>アバター選択"]
    Page --> WaitingRoom["WaitingRoom<br/>ゲーム開始待ち<br/>チャット・ボイス"]
    Page --> GameView["ゲーム画面"]
    Page --> JoinRequestPopup["JoinRequestPopup<br/>途中参加リクエスト"]
    Page --> Notification["Notification<br/>トースト通知<br/>ビッグアナウンス"]

    GameView --> GameHeader["GameHeader<br/>ターン情報・接続状態"]
    GameView --> OpponentBar["OpponentBar<br/>対戦相手ステータス"]
    GameView --> Field["Field<br/>場のカード表示"]
    GameView --> Hand["Hand<br/>手札管理・選択"]
    GameView --> NakiPopup["NakiPopup<br/>鳴きプロンプト"]
    GameView --> CardExchangeUI["CardExchangeUI<br/>カード交換 UI"]
    GameView --> ActionButtons["ActionButtons<br/>出す・パス"]
    GameView --> GameInfoBar["GameInfoBar<br/>ランク・ラウンド・革命"]
    GameView --> ChatPanel["ChatPanel<br/>テキスト + ボイススタンプ"]
    GameView --> Scoreboard["Scoreboard<br/>スコア + ルール表示"]
    GameView --> HistoryPanel["HistoryPanel<br/>プレイ履歴"]
    GameView --> VoicePanel["VoicePanel<br/>ボイスチャット操作"]

    Hand --> PlayingCard["PlayingCard<br/>SVGカード描画"]
    Field --> PlayingCard
```

---

## バックエンド モジュール構成

```mermaid
graph TD
    subgraph EntryPoint["エントリーポイント"]
        IndexTS["index.ts<br/>Express + Socket.io サーバー"]
    end

    subgraph Session["セッション管理"]
        SM["SessionManager"]
        SM --> Sessions["sessions Map<br/>sessionId → SessionData"]
        SM --> PlayerMap["playerToSession Map<br/>playerId → sessionId"]
        SM --> Timers["disconnectTimers Map<br/>切断猶予タイマー (5分)"]
    end

    subgraph RoomMgmt["ルーム管理"]
        GR["GameRoom"]
        GR --> Players["players[]<br/>RoomPlayer 配列"]
        GR --> EngineRef["engine<br/>GameEngine インスタンス"]
        GR --> Voice["voiceUsers Set<br/>ボイス参加者"]
        GR --> Handlers["registerHandlers()<br/>Socket イベントハンドラ"]
    end

    subgraph Engine["ゲームエンジン"]
        GE["GameEngine"]
        GE --> State["ゲーム状態<br/>phase / field / players"]
        GE --> Play["playCards()<br/>カード出し + 判定"]
        GE --> Naki["intercept()<br/>鳴き処理"]
        GE --> Exchange["submitExchange()<br/>カード交換"]
        GE --> Ranks["assignRanks()<br/>ランク算出"]
    end

    IndexTS --> SM
    IndexTS -->|"ルーム作成・参照"| GR
    GR -->|"ゲーム制御"| GE

    subgraph REST["REST API"]
        Health["GET /api/health<br/>ヘルスチェック"]
        RoomList["GET /api/rooms<br/>ルーム一覧"]
    end

    IndexTS --> REST
```

---

## ゲームフェーズ遷移（状態マシン）

```mermaid
stateDiagram-v2
    [*] --> waiting: ルーム作成

    waiting --> playing: start_game<br/>(3人以上)

    playing --> naki_chance: カード出し後<br/>鳴き可能な手札あり
    naki_chance --> playing: skip_intercept<br/>or タイムアウト
    naki_chance --> playing: intercept<br/>(鳴き成功)

    playing --> round_end: 全員上がり
    round_end --> card_exchange: ランク確定<br/>(4人以上)
    round_end --> playing: 次ラウンド開始<br/>(3人)

    card_exchange --> playing: 交換完了<br/>→ 次ラウンド開始
```

---

## Socket.io イベントフロー

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as サーバー
    participant GR as GameRoom
    participant GE as GameEngine

    Note over C,S: 接続・参加フロー
    C->>S: connect (auth: sessionId)
    S->>C: session (sessionId, playerId)
    C->>S: join_room (roomId, name, avatar)
    S->>GR: join(player)
    GR->>C: room_info (players, roomId)

    Note over C,S: ゲーム開始
    C->>S: start_game
    S->>GR: startGame()
    GR->>GE: startGame()
    GE-->>GR: 状態更新
    GR->>C: game_state (hand, field, players...)

    Note over C,S: カードプレイ
    C->>S: play_card (cardIds)
    S->>GR: handlePlayCard()
    GR->>GE: playCards(playerId, cardIds)
    GE-->>GR: 判定結果 (革命/8切り/鳴きチャンス)

    alt 鳴きチャンスあり
        GR->>C: intercept_window (card)
        alt 鳴き実行
            C->>S: intercept
            S->>GR: handleIntercept()
            GR->>GE: intercept()
            GR->>C: intercept_result + game_state
        else スキップ
            C->>S: skip_intercept
            GR->>C: game_state
        end
    end

    GR->>C: game_state (更新後)

    Note over C,S: パス
    C->>S: pass
    S->>GR: handlePass()
    GR->>GE: pass()
    GR->>C: game_state

    Note over C,S: ラウンド終了
    GE-->>GR: 全員上がり
    GR->>C: round_end (rankings)
    GR->>C: game_state (phase: card_exchange)
    C->>S: card_exchange (cardIds)
    GR->>GE: submitExchange()
    GE-->>GR: 交換完了 → 次ラウンド開始
    GR->>C: game_state (新ラウンド)
```

---

## 再接続フロー

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as サーバー
    participant SM as SessionManager

    Note over C: 切断発生
    S->>SM: markDisconnected(sessionId)
    SM-->>SM: 5分間の猶予タイマー開始

    Note over C: 再接続
    C->>S: connect (auth: sessionId)
    S->>SM: getSession(sessionId)
    SM-->>S: SessionData (playerId, roomId)
    S->>SM: markReconnected(sessionId)
    SM-->>SM: 猶予タイマー解除
    S->>C: reconnected (roomId, playerName)
    S->>C: game_state (現在の状態を復元)

    Note over C: 猶予期間超過の場合
    SM-->>SM: 5分経過
    SM->>S: セッション削除
    C->>S: connect (auth: expired sessionId)
    S->>C: session_expired
    C-->>C: localStorage の lastRoom から再参加を試行
```

---

## ボイスチャット (WebRTC) フロー

```mermaid
sequenceDiagram
    participant A as プレイヤーA
    participant S as サーバー (シグナリング)
    participant B as プレイヤーB

    A->>S: voice_join
    S->>A: voice_users (既存参加者リスト)
    S->>B: voice_user_joined (A)

    Note over A,B: WebRTC ハンドシェイク
    A->>A: RTCPeerConnection 作成
    A->>A: getUserMedia (音声取得)
    A->>S: voice_signal (offer SDP)
    S->>B: voice_signal (offer SDP)
    B->>B: RTCPeerConnection 作成
    B->>B: getUserMedia (音声取得)
    B->>S: voice_signal (answer SDP)
    S->>A: voice_signal (answer SDP)

    Note over A,B: ICE Candidate 交換
    A->>S: voice_signal (ICE candidate)
    S->>B: voice_signal (ICE candidate)
    B->>S: voice_signal (ICE candidate)
    S->>A: voice_signal (ICE candidate)

    Note over A,B: P2P 音声ストリーム確立
    A<-->B: 音声データ (P2P)
```

---

## データフロー

```mermaid
graph TD
    subgraph Frontend["フロントエンド状態"]
        PageState["page.tsx useState<br/>hand[] / field[] / players[]<br/>selected Set / screen / chatOpen"]
        SessionStorage["sessionStorage<br/>sessionId (タブ固有)"]
        LocalStorage["localStorage<br/>lastRoom (ブラウザ共有)"]
    end

    subgraph Backend["バックエンド状態 (インメモリ)"]
        RoomMap["rooms Map<br/>roomId → GameRoom"]
        SessionMap["sessions Map<br/>sessionId → SessionData"]
        EngineState["GameEngine 状態<br/>players[] / field[] / phase<br/>isRevolution / round"]
    end

    EngineState -->|"broadcastGameState()"| PageState
    PageState -->|"play_card / pass / intercept"| EngineState

    SessionStorage <-->|"接続時 auth"| SessionMap
    LocalStorage -->|"再接続時 roomId"| RoomMap

    style Frontend fill:#1a3a2a,stroke:#4ade80
    style Backend fill:#1a2a3a,stroke:#60a5fa
```

### 永続化について

現在のアーキテクチャでは**データベースを使用しておらず**、すべての状態はサーバーメモリ上に保持されます。
サーバー再起動時にはゲーム状態が失われますが、クライアント側の `sessionStorage` / `localStorage` を活用した再接続機構により、一時的な切断には対応しています。

---

## ゲームロジック（共有コード）

```mermaid
graph LR
    subgraph gameLogic["shared/gameLogic.ts"]
        createDeck["createDeck()<br/>54枚デッキ生成"]
        shuffle["shuffle()<br/>Fisher-Yates"]
        sortHand["sortHand()<br/>強さ順ソート"]
        compareCards["compareCards()<br/>カード強さ比較"]
        canNaki["canNaki()<br/>鳴き判定"]
        isRevolution["isRevolutionPlay()<br/>革命判定"]
        isValidSeq["isValidSequence()<br/>連番判定"]
        canBeatJoker["canBeatJoker()<br/>♠3 判定"]
    end

    subgraph rules["ゲームルール"]
        Strength["強さ: 3 < 4 < ... < A < 2 < Joker"]
        Revolution["革命: 同ランク4枚+ or 同スート連番4枚+"]
        Naki["鳴き: 6〜Q 単体出しに対し<br/>同スート前後カードで3枚セット"]
        EightCut["8切り: 8を出すと場がリセット"]
        JokerKill["Joker は ♠3 でのみ切れる"]
    end

    compareCards --> Strength
    isRevolution --> Revolution
    canNaki --> Naki
    canBeatJoker --> JokerKill
```

---

## デプロイ構成

```mermaid
graph LR
    subgraph Render["Render.com"]
        WebService["Web Service<br/>npm start"]
        WebService --> NextServer["Next.js (SSR)<br/>ポート 3000"]
        WebService --> SocketServer["Express + Socket.io<br/>ポート 3001"]
    end

    subgraph Client["ブラウザ"]
        Browser["スマホ / PC"]
    end

    Browser -->|"HTTPS"| NextServer
    Browser -->|"WSS (WebSocket)"| SocketServer
    Browser <-.->|"P2P (WebRTC)"| Browser

    subgraph Keepalive["キープアライブ"]
        Worker["Web Worker<br/>2分間隔で /api/health"]
    end

    Worker -->|"HTTP GET"| SocketServer

    Note1["※ Render 無料プランは<br/>5分間アイドルでスリープ<br/>→ Worker で防止"]

    style Note1 fill:#333,stroke:#666,color:#ccc
```

---

## 主要な設計判断

| 項目 | 決定 | 理由 |
|---|---|---|
| 状態管理 | useState (page.tsx 集中管理) | ゲーム状態はサーバーが正とするため、クライアントは薄く保つ |
| DB | なし (インメモリ) | リアルタイムゲームの特性上、永続化より低レイテンシを優先 |
| 共有コード | shared/ ディレクトリ | フロント・バック間のロジック重複を排除 |
| ボイスチャット | WebRTC P2P | サーバー負荷を避け、低レイテンシ音声通信を実現 |
| 再接続 | sessionStorage + 5分猶予 | モバイルブラウザのバックグラウンド移行に対応 |
| カード描画 | SVG (@letele/playing-cards) | 高解像度対応 + 軽量 |
| サウンド | Web Audio API (動的生成) | 音声ファイル不要で軽量 |
