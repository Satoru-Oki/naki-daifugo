"use client";

import { useState } from "react";
import type { PokerAction } from "../../../shared/poker/types";

interface PokerActionButtonsProps {
  isMyTurn: boolean;
  currentBet: number;
  myCurrentBet: number;
  myChips: number;
  minRaise: number;
  onAction: (action: PokerAction, amount?: number) => void;
  chatOpen: boolean;
  onChatToggle: () => void;
}

export default function PokerActionButtons({
  isMyTurn,
  currentBet,
  myCurrentBet,
  myChips,
  minRaise,
  onAction,
  chatOpen,
  onChatToggle,
}: PokerActionButtonsProps) {
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseInput, setShowRaiseInput] = useState(false);

  const callAmount = Math.min(currentBet - myCurrentBet, myChips);
  const canCheck = myCurrentBet >= currentBet;
  const canCall = callAmount > 0;
  const minRaiseTotal = currentBet + minRaise;
  const canRaise = myChips > callAmount;

  const handleRaise = () => {
    if (!showRaiseInput) {
      setRaiseAmount(minRaiseTotal);
      setShowRaiseInput(true);
      return;
    }
    if (raiseAmount >= minRaiseTotal && raiseAmount <= myCurrentBet + myChips) {
      onAction("raise", raiseAmount);
      setShowRaiseInput(false);
    }
  };

  const handleAllIn = () => {
    onAction("all_in");
    setShowRaiseInput(false);
  };

  return (
    <div className="shrink-0 px-3 py-2" style={{ backgroundColor: "var(--bg-darker, #0a3a1a)" }}>
      {showRaiseInput && isMyTurn && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min={minRaiseTotal}
            max={myCurrentBet + myChips}
            step={10}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="flex-1 accent-yellow-400"
          />
          <span className="text-white text-sm font-mono w-16 text-right">{raiseAmount}</span>
          <button
            onClick={() => setShowRaiseInput(false)}
            className="text-white/50 text-xs px-2 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {/* Fold */}
        <button
          onClick={() => { onAction("fold"); setShowRaiseInput(false); }}
          disabled={!isMyTurn}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm
            bg-red-600/80 text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            active:scale-[0.97] transition-all"
        >
          Fold
        </button>

        {/* Check / Call */}
        {canCheck ? (
          <button
            onClick={() => { onAction("check"); setShowRaiseInput(false); }}
            disabled={!isMyTurn}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm
              bg-green-600/80 text-white
              disabled:opacity-30 disabled:cursor-not-allowed
              active:scale-[0.97] transition-all"
          >
            Check
          </button>
        ) : canCall ? (
          <button
            onClick={() => { onAction("call"); setShowRaiseInput(false); }}
            disabled={!isMyTurn}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm
              bg-blue-600/80 text-white
              disabled:opacity-30 disabled:cursor-not-allowed
              active:scale-[0.97] transition-all"
          >
            Call {callAmount}
          </button>
        ) : null}

        {/* Raise */}
        {canRaise && (
          <button
            onClick={handleRaise}
            disabled={!isMyTurn}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm
              bg-yellow-600/80 text-white
              disabled:opacity-30 disabled:cursor-not-allowed
              active:scale-[0.97] transition-all"
          >
            {showRaiseInput ? `Raise ${raiseAmount}` : "Raise"}
          </button>
        )}

        {/* All-in */}
        <button
          onClick={handleAllIn}
          disabled={!isMyTurn || myChips === 0}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm
            bg-purple-600/80 text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            active:scale-[0.97] transition-all"
        >
          All-in
        </button>

        {/* Chat toggle */}
        <button
          onClick={onChatToggle}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0
            ${chatOpen ? "bg-white/20 text-white" : "bg-white/10 text-white/60"}`}
        >
          💬
        </button>
      </div>
    </div>
  );
}
