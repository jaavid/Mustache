/** Cosmetic character choice, isolated from scoring and competitive trace formats. */
export type CharacterId = 'ramin' | 'borhan';
export const CHARACTER_IDS: readonly CharacterId[] = ['ramin', 'borhan'];
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
  return character === 'borhan' ? 'BORHAN' : 'RAMIN';
}
