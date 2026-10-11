import Phaser from 'phaser';
import { PHASE_PROFILES, type RoundPhase } from '../logic/arcadePhases';

export type SoundEffect =
  'start' | 'select' | 'shot' | 'perfect' | 'good' | 'miss' | 'finish' | 'phase';
const SFX_KEY = 'n5-mustache-sfx-enabled-v1';
const MUSIC_KEY = 'n5-mustache-music-enabled-v1';
function readBool(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}
function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode */
  }
}
let sfx = readBool(SFX_KEY, true);
let music = readBool(MUSIC_KEY, true);
let audio: AudioContext | null = null;
let active = false;
let paused = false;
let scheduler: ReturnType<typeof setInterval> | null = null;
let nextNote = 0;
let noteIndex = 0;

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
    return audio;
  } catch {
    return null;
  }
}
function beep(
  ctx: AudioContext,
  at: number,
  hz: number,
  length: number,
  shape: OscillatorType = 'triangle',
  volume = 0.046,
): void {
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(hz, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.018);
}
export function playSfx(effect: SoundEffect): void {
  if (!sfx) return;
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + 0.012;
  switch (effect) {
    case 'select':
      beep(ctx, t, 520, 0.07, 'square', 0.022);
      break;
    case 'start':
      beep(ctx, t, 392, 0.12);
      beep(ctx, t + 0.11, 587, 0.14);
      beep(ctx, t + 0.24, 784, 0.2);
      break;
    case 'shot':
      beep(ctx, t, 340, 0.07, 'sawtooth', 0.036);
      beep(ctx, t + 0.04, 220, 0.1, 'triangle', 0.038);
      break;
    case 'good':
      beep(ctx, t, 560, 0.09);
      beep(ctx, t + 0.1, 740, 0.16, 'sine');
      break;
    case 'perfect':
      beep(ctx, t, 660, 0.1);
      beep(ctx, t + 0.085, 880, 0.11);
      beep(ctx, t + 0.18, 1175, 0.21, 'sine');
      break;
    case 'miss':
      beep(ctx, t, 196, 0.12, 'sawtooth', 0.03);
      beep(ctx, t + 0.09, 140, 0.16, 'triangle', 0.025);
      break;
    case 'phase':
      beep(ctx, t, 587, 0.11, 'triangle', 0.035);
      beep(ctx, t + 0.13, 784, 0.12, 'sine', 0.032);
      beep(ctx, t + 0.28, 1175, 0.19, 'sine', 0.035);
      break;
    case 'finish':
      beep(ctx, t, 523, 0.13);
      beep(ctx, t + 0.14, 659, 0.14);
      beep(ctx, t + 0.29, 784, 0.14);
      beep(ctx, t + 0.46, 1047, 0.3, 'sine');
      break;
  }
}
const NOTES = [
  0, 7, 9, 7, 5, 7, 2, -1, 0, 5, 7, 12, 9, 7, 5, -1, 4, 7, 11, 7, 5, 4, 2, -1, 0, 2, 5, 7, 9, 5, 2,
  -1,
];
const ROOT = 220;
let beatInterval = 30 / PHASE_PROFILES.WARMUP.tempoBpm; // warm-up 112 bpm, rises to 160 bpm
function pitch(semitones: number): number {
  return ROOT * Math.pow(2, semitones / 12);
}
function pump(): void {
  if (!music || !active || paused || (typeof document !== 'undefined' && document.hidden)) return;
  const ctx = context();
  if (!ctx) return;
  // Discard elapsed time after tab suspension, never schedule a burst of catch-up notes.
  nextNote = Math.max(nextNote, ctx.currentTime + 0.025);
  while (nextNote < ctx.currentTime + 0.17) {
    const step = noteIndex % NOTES.length;
    const melody = NOTES[step];
    if (melody >= 0) beep(ctx, nextNote, pitch(melody + 12), beatInterval * 0.78, 'square', 0.012);
    if (step % 4 === 0)
      beep(
        ctx,
        nextNote,
        pitch([0, 5, 7, 3][Math.floor(step / 8) % 4] - 12),
        beatInterval * 3,
        'triangle',
        0.021,
      );
    if (step % 8 === 4) beep(ctx, nextNote, pitch(19), beatInterval * 0.4, 'sine', 0.008);
    nextNote += beatInterval;
    noteIndex++;
  }
}
function scheduleMusic(): void {
  if (!music || !active || paused) return;
  if (scheduler === null) scheduler = setInterval(pump, 90);
  pump();
}
function haltScheduler(): void {
  if (scheduler !== null) {
    clearInterval(scheduler);
    scheduler = null;
  }
}
export function setMusicPhase(phase: RoundPhase): void {
  const newInterval = 30 / PHASE_PROFILES[phase].tempoBpm;
  if (beatInterval === newInterval) return;
  beatInterval = newInterval;
  nextNote = 0;
  if (active && !paused && phase !== 'WARMUP') playSfx('phase');
}
export function startMusic(): void {
  active = true;
  paused = false;
  nextNote = 0;
  noteIndex = 0;
  scheduleMusic();
}
export function stopMusic(): void {
  active = false;
  paused = false;
  haltScheduler();
}
export function setMusicPaused(value: boolean): void {
  paused = value;
  if (value) haltScheduler();
  else {
    nextNote = 0;
    scheduleMusic();
  }
}
export function toggleMusic(): boolean {
  music = !music;
  writeBool(MUSIC_KEY, music);
  if (music) {
    nextNote = 0;
    scheduleMusic();
  } else haltScheduler();
  return music;
}
export function toggleSfx(): boolean {
  sfx = !sfx;
  writeBool(SFX_KEY, sfx);
  if (sfx) playSfx('select');
  return sfx;
}
export function musicEnabled(): boolean {
  return music;
}
export function sfxEnabled(): boolean {
  return sfx;
}
function toggleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  word: string,
  get: () => boolean,
  toggle: () => boolean,
): void {
  const hit = scene.add
    .rectangle(x, y, width, 37, 0x142338, 0.95)
    .setStrokeStyle(3, 0xc5a0fa)
    .setDepth(119)
    .setInteractive({ useHandCursor: true });
  const caption = scene.add
    .text(x, y, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#f3d7ff',
    })
    .setOrigin(0.5)
    .setDepth(120);
  const update = () => {
    caption.setText(word + ' ' + (get() ? 'ON' : 'OFF'));
    hit.setStrokeStyle(3, get() ? 0xc5a0fa : 0x617083);
  };
  hit.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      toggle();
      update();
    },
  );
  update();
}
/** Existing SFX control retained for every original scene. */
export function addSoundToggle(scene: Phaser.Scene, x: number, y: number, width = 106): void {
  toggleButton(scene, x, y, width, 'SFX', sfxEnabled, toggleSfx);
}
export function addMusicToggle(scene: Phaser.Scene, x: number, y: number, width = 104): void {
  toggleButton(scene, x, y, width, 'MUSIC', musicEnabled, toggleMusic);
}
