import Phaser from 'phaser';
import './style.css';
import { BootScene, MenuScene, PlayScene, ResultsScene } from './game/scenes';
import { MobileMenuScene, MobilePlayScene, MobileResultsScene } from './game/mobile';
import { GuideScene, PauseOverlayScene } from './game/overlays';
import { stopMusic } from './game/sound';

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
          MobilePlayScene,
          MobileResultsScene,
          GuideScene,
          PauseOverlayScene,
        ]
      : [BootScene, MenuScene, PlayScene, ResultsScene, GuideScene, PauseOverlayScene],
  });
}

// Orientation changes rebuild scenes to avoid carrying incompatible world coordinates.
// A live round restarts after rotating; best scores still persist in localStorage.
portraitMedia.addEventListener('change', mountGame);
mountGame();
