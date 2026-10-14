import Phaser from 'phaser';
import { getPlayerProfile, type PlayerProfile } from '../platform/competitiveScores';

const FONT = '"Courier New", monospace';
function caption(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = '#fff1bf',
) {
  return scene.add
    .text(x, y, value, {
      fontFamily: FONT,
      fontStyle: 'bold',
      fontSize: size + 'px',
      color,
      align: 'center',
      stroke: '#12182b',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(151);
}
function surface(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  click: () => void,
) {
  const bg = scene.add
    .rectangle(x, y, w, h, 0x3c3554, 0.98)
    .setStrokeStyle(3, 0xe0b95f)
    .setDepth(150)
    .setInteractive({ useHandCursor: true });
  const t = caption(scene, x, y, text, h > 45 ? 19 : 16);
  bg.on(
    'pointerdown',
    (_: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      click();
    },
  );
  return (value: string) => t.setText(value);
}

/** Profile is backed only by verified Telegram rounds. Web practice cannot fake unlocks. */
export function addProgressionMenu(
  scene: Phaser.Scene,
  portrait: boolean,
  playGold: () => void,
): void {
  const center = portrait ? 270 : 305;
  const goldY = portrait ? 870 : 455;
  let profile: PlayerProfile | null = null;
  let ready = false;
  const status = surface(
    scene,
    center,
    goldY,
    portrait ? 380 : 290,
    portrait ? 54 : 47,
    '🔒 GOLD RUSH · LOADING',
    () => {
      if (ready && profile?.goldRushAvailable) playGold();
      else if (ready) showProfile(scene, portrait, profile);
    },
  );
  const profileText = surface(
    scene,
    portrait ? 148 : 717,
    portrait ? 934 : 490,
    portrait ? 228 : 193,
    portrait ? 36 : 38,
    'PROFILE',
    () => showProfile(scene, portrait, profile),
  );
  surface(
    scene,
    portrait ? 397 : 894,
    portrait ? 934 : 490,
    portrait ? 228 : 130,
    portrait ? 36 : 38,
    'INVITE 〰️',
    () => {
      if (profile) void copyInvite(scene, portrait, profile.inviteUrl);
      else void copyInvite(scene, portrait, 'https://t.me/RJTtobot?start=invite');
    },
  );
  void getPlayerProfile().then((result) => {
    if (!scene.sys.isActive()) return;
    ready = true;
    profile = result;
    status(
      !result
        ? 'GOLD RUSH · TELEGRAM ONLY'
        : result.goldRushAvailable
          ? result.goldUnlocked
            ? '★ GOLD RUSH · OPEN'
            : '★ GOLDEN TICKET · TODAY'
          : '🔒 GOLD RUSH · ' + result.roundsPlayed + '/12',
    );
    profileText(result ? 'LV ' + result.level + ' · PROFILE' : 'TG PROFILE');
  });
}

async function copyInvite(scene: Phaser.Scene, portrait: boolean, url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    if (scene.sys.isActive())
      caption(scene, scene.scale.width / 2, portrait ? 707 : 345, 'INVITE LINK COPIED!', 19);
  } catch {
    window.prompt('Copy your invite link:', url);
  }
}

export function showProfile(
  scene: Phaser.Scene,
  portrait: boolean,
  profile: PlayerProfile | null,
): void {
  const w = scene.scale.width,
    h = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(180);
  const shade = scene.add.rectangle(w / 2, h / 2, w, h, 0x080e1d, 0.96).setInteractive();
  shade.on(
    'pointerdown',
    (_: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) =>
      event.stopPropagation(),
  );
  root.add(shade);
  root.add(
    scene.add
      .rectangle(w / 2, h / 2, w - 36, portrait ? 680 : 485, 0x1f2f43)
      .setStrokeStyle(4, 0xe6bc69),
  );
  const add = (y: number, value: string, color = '#f5e8ce', size = portrait ? 21 : 18) => {
    const t = scene.add
      .text(w / 2, y, value, {
        fontFamily: FONT,
        fontSize: size + 'px',
        fontStyle: 'bold',
        align: 'center',
        color,
        wordWrap: { width: w - 88 },
        stroke: '#16172b',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    root.add(t);
  };
  const base = portrait ? 242 : 84;
  add(base, '〰️  MUSTACHE PROFILE', '#ffda82', portrait ? 29 : 26);
  if (profile) {
    add(base + 57, profile.name + '   ·   LEVEL ' + profile.level, '#ffffff');
    add(base + 97, 'XP ' + profile.xp + ' / ' + profile.nextLevelXp);
    add(base + 137, 'ROUNDS ' + profile.roundsPlayed + '   ·   ACTIVE DAYS ' + profile.activeDays);
    add(
      base + 177,
      'BEST ' + profile.bestScore + '   ·   GOLDEN PERFECT ' + profile.goldenPerfects,
    );
    add(
      base + 217,
      'DAILY INVITES ' + profile.dailyInvites + '/3   ·   RANK #' + (profile.rank ?? '?'),
    );
    const gold = profile.goldUnlocked
      ? 'GOLD RUSH UNLOCKED'
      : profile.goldTicketEligible
        ? 'GOLDEN TICKET AVAILABLE TODAY'
        : 'GOLD RUSH: ' + profile.roundsPlayed + '/12 ROUNDS · 2 DAYS';
    add(base + 265, gold, '#ffdd88');
    add(
      base + 309,
      profile.rival
        ? 'RIVAL #' +
            profile.rival.rank +
            ' · ' +
            Math.max(0, profile.rival.score - (profile.weeklyScore || 0) + 1) +
            ' PTS TO PASS'
        : 'COMPETE TO FIND YOUR NEAREST RIVAL',
      '#bbe6d7',
      17,
    );
    const finished = profile.missions.filter((mission) => mission.done).length;
    add(base + 345, 'DAILY MISSIONS ' + finished + '/3', '#ffe5a4', 17);
    add(base + 390, profile.missions.map((mission) =>
      (mission.done ? '✓ ' : '• ') + mission.title + ' ' + mission.current + '/' + mission.target
    ).join('\n'), '#d5f2e0', portrait ? 15 : 14);
  } else {
    add(base + 125, 'PLAY THROUGH @RJTtobot TO SAVE XP');
    add(base + 184, 'BROWSER PRACTICE IS LOCAL ONLY');
  }
  const close = scene.add
    .rectangle(w / 2, portrait ? 820 : 500, 205, 45, 0x62518b)
    .setStrokeStyle(3, 0xe6d3ad)
    .setInteractive({ useHandCursor: true });
  root.add(close);
  const closeText = scene.add
    .text(w / 2, portrait ? 820 : 500, '✕ CLOSE', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#ffffff',
    })
    .setOrigin(0.5);
  root.add(closeText);
  close.on(
    'pointerdown',
    (_: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      root.destroy();
    },
  );
}
