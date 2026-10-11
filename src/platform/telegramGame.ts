/** Official Telegram Games bridge, intentionally not Telegram WebApp/Mini App.
 * Only invoke shareScore() on an explicit player click.
 */
type GameProxy = {
  initParams?: Record<string, unknown>;
  shareScore?: () => void;
};

function currentGameProxy(): GameProxy | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { TelegramGameProxy?: GameProxy }).TelegramGameProxy;
}

export function isTelegramGame(): boolean {
  const proxy = currentGameProxy();
  // Ordinary browser visitors must keep the existing Web Share/clipboard flow.
  return (
    typeof proxy?.shareScore === 'function' &&
    typeof proxy.initParams?.tgShareScoreUrl === 'string'
  );
}

/** Open Telegram's native Game sharing dialog; does NOT post or verify scores. */
export function shareTelegramGame(): boolean {
  if (!isTelegramGame()) return false;
  try {
    currentGameProxy()?.shareScore?.();
    return true;
  } catch {
    return false;
  }
}
