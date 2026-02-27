let logTarget: HTMLPreElement | null = null;

export function initLogger(target: HTMLPreElement | null) {
  logTarget = target;
}

export function logMessage(message: string) {
  if (!logTarget) {
    return;
  }
  const timestamp = new Date().toLocaleTimeString();
  logTarget.textContent = `[${timestamp}] ${message}\n${logTarget.textContent}`;
}
