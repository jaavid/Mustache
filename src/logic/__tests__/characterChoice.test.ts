import { afterEach, describe, expect, it } from 'vitest';
import {
  CHARACTER_IDS,
  CHARACTER_PICK_SECONDS,
  characterName,
  BORHAN_MUSTACHE_NAMES,
  mustacheTexture,
  getSelectedCharacter,
  setSelectedCharacter,
} from '../../game/characterChoice';

afterEach(() => setSelectedCharacter('ramin'));

describe('pre-round hero selection', () => {
  it('keeps the old game default and valid countdown', () => {
    expect(CHARACTER_IDS).toEqual(['ramin', 'borhan', 'mammad']);
    expect(CHARACTER_PICK_SECONDS).toBe(6);
    expect(characterName('ramin')).toBe('RAMIN');
    expect(characterName('mammad')).toBe('MAMMAD');
  });
  it('switches the cosmetic hero without modifying scores', () => {
    setSelectedCharacter('borhan');
    expect(getSelectedCharacter()).toBe('borhan');
    expect(characterName()).toBe('BORHAN');
    setSelectedCharacter('mammad');
    expect(getSelectedCharacter()).toBe('mammad');
    expect(characterName()).toBe('MAMMAD');
    setSelectedCharacter('ramin');
    expect(getSelectedCharacter()).toBe('ramin');
  });
  it('maps three distinct Borhan visual styles without changing scoring indices', () => {
    setSelectedCharacter('borhan');
    expect(BORHAN_MUSTACHE_NAMES).toEqual([
      'SHORT HORSESHOE',
      'CLASSIC HORSESHOE',
      'HEAVY HORSESHOE',
    ]);
    expect([0, 1, 2].map((index) => mustacheTexture(index))).toEqual([
      'borhan-stache-0',
      'borhan-stache-1',
      'borhan-stache-2',
    ]);
    expect(mustacheTexture(1, true)).toBe('borhan-stache-gold');
    setSelectedCharacter('ramin');
    expect(mustacheTexture(2)).toBe('stache-2');
    expect(mustacheTexture(1, true)).toBe('stache-gold');
    setSelectedCharacter('mammad');
    expect([0, 1, 2].map((index) => mustacheTexture(index))).toEqual([
      'stache-0',
      'stache-1',
      'stache-2',
    ]);
    expect(mustacheTexture(1, true)).toBe('stache-gold');
    expect(() => mustacheTexture(3)).toThrow(RangeError);
  });
  it('rejects unknown character IDs', () => {
    expect(() => setSelectedCharacter('hacker' as never)).toThrow('Unsupported character');
  });
});
