import { describe, expect, it } from 'vitest';
import { rotatedOffsetPoint } from '../rotatedOffsetPoint';

describe('rotation-aware facial attachment', () => {
  it('preserves an upper-lip offset without rotation', () => {
    expect(rotatedOffsetPoint(270, 382, 0, -60, 0)).toEqual({ x: 270, y: 322 });
  });

  it('moves the lip to the right when the head tilts clockwise', () => {
    const point = rotatedOffsetPoint(270, 382, 0, -60, Math.PI / 2);
    expect(point.x).toBeCloseTo(330);
    expect(point.y).toBeCloseTo(382);
  });

  it('moves the lip to the left when the head tilts counter-clockwise', () => {
    const point = rotatedOffsetPoint(270, 382, 0, -60, -Math.PI / 2);
    expect(point.x).toBeCloseTo(210);
    expect(point.y).toBeCloseTo(382);
  });

  it('honors offsets on both local axes', () => {
    const point = rotatedOffsetPoint(100, 100, 20, -10, Math.PI);
    expect(point.x).toBeCloseTo(80);
    expect(point.y).toBeCloseTo(110);
  });
});
