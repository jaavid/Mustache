/** Cosmetic character choice, isolated from scoring and competitive trace formats. */
export type CharacterId = 'ramin' | 'borhan' | 'mammad';
export const CHARACTER_IDS: readonly CharacterId[] = ['ramin', 'borhan', 'mammad'];
export const CHARACTER_PICK_SECONDS = 6;

let currentCharacter: CharacterId = 'ramin';

export function getSelectedCharacter(): CharacterId {
  return currentCharacter;
}

export function setSelectedCharacter(character: CharacterId): void {
  if (!CHARACTER_IDS.includes(character)) {
    throw new Error('Unsupported character: ' + String(character));
  }
  currentCharacter = character;
}

export function characterName(character: CharacterId = currentCharacter): string {
  return character === 'borhan' ? 'BORHAN' : character === 'mammad' ? 'MAMMAD' : 'RAMIN';
}

/** Visual-only projectile mapping; scoring keeps the same three style indices. */
export const BORHAN_MUSTACHE_NAMES = [
  'SHORT HORSESHOE',
  'CLASSIC HORSESHOE',
  'HEAVY HORSESHOE',
] as const;
export function mustacheTexture(style: number, gold = false): string {
  if (!Number.isInteger(style) || style < 0 || style > 2) {
    throw new RangeError('Unknown mustache style');
  }
  // Mammad uses the standard three styles; the scoring indices stay unchanged.
  const prefix = currentCharacter === 'borhan' ? 'borhan-stache-' : 'stache-';
  return prefix + (gold ? 'gold' : String(style));
}
