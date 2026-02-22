"use client";

interface JoinRequestPopupProps {
  playerName: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function JoinRequestPopup({ playerName, onAccept, onReject }: JoinRequestPopupProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-[#1a2e1a] rounded-2xl px-6 py-5 border-2 border-emerald-500/50
        shadow-[0_0_24px_rgba(16,185,129,0.2)] flex flex-col items-center gap-4 min-w-[280px] max-w-[340px]">
        <span className="text-emerald-400 text-base font-black">参加要請</span>
        <p className="text-gray-300 text-sm text-center">
          <span className="text-white font-bold">{playerName}</span>
          から参加要請がきました。参加でよい？
        </p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onAccept}
            className="flex-1 bg-gradient-to-br from-emerald-700 to-emerald-500 text-white
              border-none rounded-lg px-4 py-2.5 text-sm font-black cursor-pointer
              hover:from-emerald-600 hover:to-emerald-400 transition-colors"
          >
            OK
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-white/5 text-gray-400 border border-white/10
              rounded-lg px-4 py-2.5 text-sm cursor-pointer hover:bg-white/10 transition-colors"
          >
            拒否
          </button>
        </div>
      </div>
    </div>
  );
}
