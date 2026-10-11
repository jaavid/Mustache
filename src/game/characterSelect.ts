import Phaser from 'phaser';
import {
  CHARACTER_IDS,
  CHARACTER_PICK_SECONDS,
  characterName,
  getSelectedCharacter,
  setSelectedCharacter,
  type CharacterId,
} from './characterChoice';
import { makeCharacter } from './ramin';
import { playSfx } from './sound';

/**
 * A short, skippable character draft before every round.
 * Ramin remains the default and a timeout never changes the score contract.
 * Phaser coordinates handle both FIT-scaled 960x540 and 540x960 screens.
 */
export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const portrait = h > w;
    const cx = w / 2;
    const cy = portrait ? 461 : 280;
    const cardW = portrait ? 230 : 274;
    const cardH = portrait ? 444 : 322;
    const centers = portrait ? [137, 403] : [318, 642];
    const scale = portrait ? 0.77 : 0.66;
    const heroY = cy - (portrait ? 13 : 11);
    const nameY = cy + cardH / 2 - (portrait ? 36 : 28);

    this.add
      .image(cx, h / 2, 'forest')
      .setDisplaySize(portrait ? 1500 : w, portrait ? 970 : h)
      .setDepth(-20);
    this.add.rectangle(cx, h / 2, w, h, 0x0a1421, 0.58).setDepth(-10);

    const uiText = (x: number, y: number, caption: string, size: number, color = '#ffffff') =>
      this.add
        .text(x, y, caption, {
          fontFamily: '"Courier New", monospace',
          fontSize: `${size}px`,
          fontStyle: 'bold',
          color,
          align: 'center',
          stroke: '#171423',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(60);

    uiText(cx, portrait ? 77 : 45, 'CHOOSE YOUR HERO', portrait ? 36 : 40, '#ffdb80');
    uiText(cx, portrait ? 137 : 91, '6 SECONDS TO PICK  •  1 OR 2', portrait ? 18 : 19, '#c9f4df');

    const borders: Phaser.GameObjects.Rectangle[] = [];
    const names: Phaser.GameObjects.Text[] = [];
    const choose = (character: CharacterId) => {
      setSelectedCharacter(character);
      CHARACTER_IDS.forEach((id, index) => {
        const active = id === character;
        borders[index].setStrokeStyle(active ? 7 : 4, active ? 0xffd171 : 0x566978);
        borders[index].setFillStyle(active ? 0x203d38 : 0x111e2c, active ? 0.97 : 0.89);
        names[index].setColor(active ? '#ffdf8e' : '#dfddea');
      });
    };

    CHARACTER_IDS.forEach((id, index) => {
      const x = centers[index];
      this.add.rectangle(x + 5, cy + 8, cardW, cardH, 0x060e17, 0.82).setDepth(7);
      const card = this.add
        .rectangle(x, cy, cardW, cardH, 0x111e2c, 0.9)
        .setStrokeStyle(4, 0x566978)
        .setInteractive({ useHandCursor: true })
        .setDepth(8);
      borders.push(card);
      const hero = makeCharacter(this, id, x, heroY, scale, 'blink').setDepth(20);
      this.tweens.add({
        targets: hero,
        y: heroY - 7,
        duration: 920 + index * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      uiText(x, cy - cardH / 2 + 26, `0${index + 1}`, 18, '#91b8ad');
      names.push(uiText(x, nameY, characterName(id), portrait ? 24 : 27));
      card.on('pointerdown', () => {
        playSfx('start');
        choose(id);
      });
    });

    choose(getSelectedCharacter());

    let remaining = CHARACTER_PICK_SECONDS;
    let started = false;
    const counter = uiText(
      cx,
      portrait ? 748 : 478,
      `STARTING IN ${remaining}`,
      portrait ? 24 : 21,
      '#c4f8d7',
    );
    const launch = () => {
      if (started) return;
      started = true;
      playSfx('start');
      this.scene.start('Play');
    };
    const timer = this.time.addEvent({
      delay: 1000,
      repeat: CHARACTER_PICK_SECONDS - 1,
      callback: () => {
        if (started) return;
        remaining -= 1;
        counter.setText(remaining > 0 ? `STARTING IN ${remaining}` : 'GO!');
        if (remaining === 0) launch();
      },
    });
    const readyY = portrait ? 851 : 520;
    const buttonWidth = portrait ? 342 : 235;
    const ready = this.add
      .rectangle(cx, readyY, buttonWidth, portrait ? 75 : 40, 0xb084ec)
      .setStrokeStyle(4, 0x49315b)
      .setInteractive({ useHandCursor: true })
      .setDepth(45);
    uiText(cx, readyY, 'READY  ▶', portrait ? 27 : 20);
    ready.on('pointerdown', launch);

    this.input.keyboard?.on('keydown-ONE', () => choose('ramin'));
    this.input.keyboard?.on('keydown-TWO', () => choose('borhan'));
    this.input.keyboard?.on('keydown-NUMPAD_ONE', () => choose('ramin'));
    this.input.keyboard?.on('keydown-NUMPAD_TWO', () => choose('borhan'));
    this.input.keyboard?.once('keydown-ENTER', launch);
    this.input.keyboard?.once('keydown-SPACE', launch);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove(false));
  }
}
