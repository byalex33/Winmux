export interface WaitingSignal {
  kind: "bell" | "attention";
  foreground: boolean;
  lastOutputAt?: number;
  signaledAt: number;
}

export interface WaitingDetector {
  shouldWait(signal: WaitingSignal, now: number, silenceMs: number): boolean;
}

export const conservativeWaitingDetector: WaitingDetector = {
  shouldWait: (signal, now, silenceMs) =>
    signal.foreground &&
    now - signal.signaledAt >= silenceMs &&
    now - (signal.lastOutputAt ?? signal.signaledAt) >= silenceMs,
};
