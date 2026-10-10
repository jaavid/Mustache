import Phaser from 'phaser';
import './style.css';
import { BootScene, MenuScene, PlayScene, ResultsScene } from './game/scenes';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e1a31',
  width: 960,
  height: 540,
  pixelArt: true,
  roundPixels: true,
  render: { antialias: false, pixelArt: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, PlayScene, ResultsScene],
});
