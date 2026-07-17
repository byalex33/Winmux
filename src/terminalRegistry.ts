export interface TerminalHandle {
  focus: () => void;
  hasForegroundProcess: () => Promise<boolean>;
  openSearch: () => void;
  reload: () => void;
}

const terminals = new Map<string, TerminalHandle>();

export const registerTerminal = (
  paneId: string,
  handle: TerminalHandle,
): (() => void) => {
  terminals.set(paneId, handle);
  return () => {
    terminals.delete(paneId);
  };
};

export const terminalHandle = (paneId?: string): TerminalHandle | undefined =>
  paneId ? terminals.get(paneId) : undefined;

export const restoreTerminalFocus = (paneId?: string): void => {
  if (paneId) requestAnimationFrame(() => terminalHandle(paneId)?.focus());
};
