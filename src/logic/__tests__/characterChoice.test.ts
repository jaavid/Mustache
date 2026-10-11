import { afterEach, describe, expect, it } from 'vitest';
import {
  CHARACTER_IDS,
  CHARACTER_PICK_SECONDS,
  characterName,
  getSelectedCharacter,
  setSelectedCharacter,
} from '../../game/characterChoice';

afterEach(() => setSelectedCharacter('ramin'));

describe('pre-round hero selection', () => {
  it('keeps the old game default and valid countdown', () => {
    expect(CHARACTER_IDS).toEqual(['ramin', 'borhan']);
    expect(CHARACTER_PICK_SECONDS).toBe(6);
    expect(characterName('ramin')).toBe('RAMIN');
  });
  it('switches the cosmetic hero without modifying scores', () => {
    setSelectedCharacter('borhan');
    expect(getSelectedCharacter()).toBe('borhan');
    expect(characterName()).toBe('BORHAN');
    setSelectedCharacter('ramin');
    expect(getSelectedCharacter()).toBe('ramin');
  });
  it('rejects unknown character IDs', () => {
    expect(() => setSelectedCharacter('hacker' as never)).toThrow('Unsupported character');
  });
});
