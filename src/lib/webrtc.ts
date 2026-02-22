import type { GameSocket } from "./socket";

/** ボイスチャット参加者情報 */
export interface VoiceUser {
  id: string;
  name: string;
}

/** UI更新コールバック */
export interface VoiceCallbacks {
  onUsersChanged: (users: VoiceUser[]) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * WebRTCボイスチャット管理クラス
 * Socket.ioをシグナリングに使い、P2Pで音声をやり取りする
 */
export class VoiceChat {
  private socket: GameSocket | null = null;
  private myId = "";
  private peers = new Map<string, RTCPeerConnection>();
  private remoteAudios = new Map<string, HTMLAudioElement>();
  private localStream: MediaStream | null = null;
  private voiceUsers: VoiceUser[] = [];
  private callbacks: VoiceCallbacks | null = null;
  private micEnabled = true;
  private speakerEnabled = true;

  /** コールバック設定 */
  setCallbacks(cb: VoiceCallbacks): void {
    this.callbacks = cb;
  }

  /** ボイスチャットに参加 */
  async join(socket: GameSocket, myId: string): Promise<void> {
    this.socket = socket;
    this.myId = myId;

    // マイク取得
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // シグナリングリスナー登録
    this.registerListeners();

    // サーバーに参加通知
    socket.emit("voice_join");
  }

  /** ボイスチャットから退出 */
  leave(): void {
    // 全ピア接続を切断
    for (const [id, pc] of this.peers) {
      pc.close();
      const audio = this.remoteAudios.get(id);
      if (audio) {
        audio.srcObject = null;
        audio.remove();
      }
    }
    this.peers.clear();
    this.remoteAudios.clear();

    // マイク停止
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    // サーバーに退出通知
    this.socket?.emit("voice_leave");

    // リスナー解除
    this.removeListeners();

    this.voiceUsers = [];
    this.callbacks?.onUsersChanged([]);
    this.socket = null;
  }

  /** マイクのON/OFF */
  setMicEnabled(on: boolean): void {
    this.micEnabled = on;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = on;
      }
    }
  }

  /** スピーカーのON/OFF */
  setSpeakerEnabled(on: boolean): void {
    this.speakerEnabled = on;
    for (const audio of this.remoteAudios.values()) {
      audio.muted = !on;
    }
  }

  get isMicEnabled(): boolean {
    return this.micEnabled;
  }

  get isSpeakerEnabled(): boolean {
    return this.speakerEnabled;
  }

  /** シグナリングリスナー登録 */
  private registerListeners(): void {
    const socket = this.socket;
    if (!socket) return;

    socket.on("voice_users", this.handleVoiceUsers);
    socket.on("voice_user_joined", this.handleUserJoined);
    socket.on("voice_user_left", this.handleUserLeft);
    socket.on("voice_signal", this.handleSignal);
  }

  /** シグナリングリスナー解除 */
  private removeListeners(): void {
    const socket = this.socket;
    if (!socket) return;

    socket.off("voice_users", this.handleVoiceUsers);
    socket.off("voice_user_joined", this.handleUserJoined);
    socket.off("voice_user_left", this.handleUserLeft);
    socket.off("voice_signal", this.handleSignal);
  }

  /** 既存ボイスユーザー一覧を受信 → 各ユーザーにofferを送信 */
  private handleVoiceUsers = (data: { users: VoiceUser[] }): void => {
    this.voiceUsers = data.users;
    this.callbacks?.onUsersChanged([...this.voiceUsers]);

    // 既存ユーザーにofferを送信
    for (const user of data.users) {
      this.createPeerAndOffer(user.id);
    }
  };

  /** 新規ユーザー参加 → 自分ではない場合はユーザーリスト更新（offer待ち） */
  private handleUserJoined = (data: { userId: string; userName: string }): void => {
    if (data.userId === this.myId) return;
    const existing = this.voiceUsers.find((u) => u.id === data.userId);
    if (!existing) {
      this.voiceUsers.push({ id: data.userId, name: data.userName });
      this.callbacks?.onUsersChanged([...this.voiceUsers]);
    }
  };

  /** ユーザー退出 → 接続クリーンアップ */
  private handleUserLeft = (data: { userId: string }): void => {
    this.voiceUsers = this.voiceUsers.filter((u) => u.id !== data.userId);
    this.callbacks?.onUsersChanged([...this.voiceUsers]);

    const pc = this.peers.get(data.userId);
    if (pc) {
      pc.close();
      this.peers.delete(data.userId);
    }
    const audio = this.remoteAudios.get(data.userId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      this.remoteAudios.delete(data.userId);
    }
  };

  /** シグナル受信: offer/answer/ICE candidate */
  private handleSignal = (data: { fromId: string; signal: unknown }): void => {
    const signal = data.signal as RTCSessionDescriptionInit | RTCIceCandidateInit;

    if ("type" in signal) {
      if (signal.type === "offer") {
        this.handleOffer(data.fromId, signal as RTCSessionDescriptionInit);
      } else if (signal.type === "answer") {
        this.handleAnswer(data.fromId, signal as RTCSessionDescriptionInit);
      }
    } else if ("candidate" in signal) {
      this.handleIceCandidate(data.fromId, signal as RTCIceCandidateInit);
    }
  };

  /** ピア接続を作成しofferを送信（発信側） */
  private async createPeerAndOffer(targetId: string): Promise<void> {
    const pc = this.createPeerConnection(targetId);
    await this.createAndSendOffer(targetId, pc);
  }

  /** 既存のピア接続でofferを作成し送信（ICE restart用） */
  private async createAndSendOffer(targetId: string, pc: RTCPeerConnection): Promise<void> {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.socket?.emit("voice_signal", {
        targetId,
        signal: pc.localDescription,
      });
    } catch {
      // offer作成失敗（接続が既にclosedなど）→ 無視
    }
  }

  /** offer受信 → answer返信 */
  private async handleOffer(fromId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    // 既存のピア接続があれば閉じる
    const existing = this.peers.get(fromId);
    if (existing) {
      existing.close();
    }

    const pc = this.createPeerConnection(fromId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket?.emit("voice_signal", {
      targetId: fromId,
      signal: pc.localDescription,
    });
  }

  /** answer受信 → リモート設定 */
  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(fromId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  /** ICE candidate受信 → 追加 */
  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peers.get(fromId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  /** RTCPeerConnectionを作成し、トラック追加・イベント設定 */
  private createPeerConnection(targetId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(targetId, pc);

    // ローカル音声トラックを追加
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    // ICE candidate → シグナリングサーバー経由でリレー
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket?.emit("voice_signal", {
          targetId,
          signal: event.candidate.toJSON(),
        });
      }
    };

    // リモート音声トラック受信 → audio要素で再生
    pc.ontrack = (event) => {
      let audio = this.remoteAudios.get(targetId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.muted = !this.speakerEnabled;
        this.remoteAudios.set(targetId, audio);
      }
      audio.srcObject = event.streams[0] || null;
    };

    // ICE接続断 → 自動再接続を試みる
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        // ICE restart で再接続
        pc.restartIce();
        this.createAndSendOffer(targetId, pc);
      } else if (pc.iceConnectionState === "disconnected") {
        // 短時間で復旧しなければ再接続
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            pc.restartIce();
            this.createAndSendOffer(targetId, pc);
          }
        }, 3000);
      }
    };

    return pc;
  }
}
