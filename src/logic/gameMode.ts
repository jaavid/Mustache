/** One-page-session mode selection. The server authorizes Gold Rush at round start. */
export type GameMode = 'classic' | 'goldRush';
let selectedMode: GameMode = 'classic';
export function getSelectedGameMode(): GameMode {
  return selectedMode;
}
export function setSelectedGameMode(mode: GameMode): void {
  selectedMode = mode;
}
