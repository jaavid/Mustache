export type GoldenPoint = Readonly<{ x: number; y: number }>;
export declare const GOLDEN_SPAWN_MS: readonly number[];
export declare const GOLDEN_FLIGHT_MS: number;
export declare const GOLDEN_REQUIRED: number;
export declare const GOLDEN_PERFECT_BONUS: number;
export declare function goldenPosition(index: number, elapsedMs: number, portrait: boolean): GoldenPoint | null;
export declare function goldenHit(index: number, elapsedMs: number, aim: GoldenPoint, portrait: boolean): boolean;
