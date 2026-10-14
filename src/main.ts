import Phaser from 'phaser';
import './style.css';
import { BootScene, MenuScene, PlayScene, ResultsScene } from './game/scenes';
import { MobileMenuScene, MobilePlayScene, MobileResultsScene } from './game/mobile';
import { GuideScene, PauseOverlayScene } from './game/overlays';
import { stopMusic } from './game/sound';
import { CharacterSelectScene } from './game/characterSelect';

const portraitMedia = window.matchMedia('(max-width: 700px) and (orientation: portrait)');
let game: Phaser.Game | undefined;

function mountGame(): void {
  const isPortrait = portraitMedia.matches;
  stopMusic();
  game?.destroy(true);
  document.documentElement.classList.toggle('portrait-game', isPortrait);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0e1a31',
    width: isPortrait ? 540 : 960,
    height: isPortrait ? 960 : 540,
    pixelArt: true,
    roundPixels: true,
    render: { antialias: false, pixelArt: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: isPortrait
      ? [
          BootScene,
          MobileMenuScene,
          CharacterSelectScene,
          MobilePlayScene,
          MobileResultsScene,
          GuideScene,
          PauseOverlayScene,
        ]
      : [
          BootScene,
          MenuScene,
          CharacterSelectScene,
          PlayScene,
          ResultsScene,
          GuideScene,
          PauseOverlayScene,
        ],
  });
}

// Rebuilding a running scene discards its server-issued round and may burn a
// one-shot Golden Ticket. Preserve the current logical canvas until the round
// and its overlays finish; layout changes are applied outside active gameplay.
portraitMedia.addEventListener('change', () => {
  if (
    game?.scene.isActive('Play') ||
    game?.scene.isPaused('Play') ||
    game?.scene.isActive('CharacterSelect') ||
    game?.scene.isActive('Guide') ||
    game?.scene.isActive('PauseOverlay')
  ) {
    return;
  }
  mountGame();
});
mountGame();
