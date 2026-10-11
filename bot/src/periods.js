/** Asia/Tehran calendar boundaries. Week starts at Saturday 00:00 Tehran. */
export const TIME_ZONE = 'Asia/Tehran';
const DAY_MS = 86400000;
const MAX_WEEK_OFFSET = 12;
const civilFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'shortOffset' });
const persianParts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
});
const persianLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: TIME_ZONE, year: 'numeric', month: 'long', day: 'numeric',
});

function parts(format, time) {
  const entries = format.formatToParts(new Date(time));
  return Object.fromEntries(entries.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

function offsetMinutes(at) {
  const raw = parts(offsetFormat, at).timeZoneName;
  if (raw === 'GMT' || raw === 'UTC') return 0;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('UNKNOWN_TEHRAN_OFFSET');
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0));
}

function localDayNumber(at) {
  const d = parts(civilFormat, at);
  return Date.UTC(Number(d.year), Number(d.month) - 1, Number(d.day));
}

function midnightFromDayNumber(dayNumber) {
  const utc = new Date(dayNumber);
  const nominal = Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  let guess = nominal - offsetMinutes(nominal) * 60000;
  // Re-evaluate after adjusting for historical offset changes near midnight.
  guess = nominal - offsetMinutes(guess) * 60000;
  return guess;
}

export function periodBounds(now = Date.now(), period = 'week', offset = 0) {
  if (!['day', 'week', 'month', 'all'].includes(period) ||
      !Number.isInteger(offset) || offset < 0 ||
      (period === 'week' ? offset > MAX_WEEK_OFFSET : offset !== 0)) {
    throw new Error('INVALID_PERIOD');
  }
  if (period === 'all') {
    return { period, offset, timeZone: TIME_ZONE, start: null, end: null,
      startLabel: 'All time', endLabel: null, remainingSeconds: null };
  }

  const today = localDayNumber(now);
  let first, after;
  if (period === 'day') {
    first = today;
    after = first + DAY_MS;
  } else if (period === 'week') {
    // JS getUTCDay: Sat=6, Sun=0, ... Fri=5.
    const daysSinceSaturday = (new Date(today).getUTCDay() + 1) % 7;
    first = today - (daysSinceSaturday + offset * 7) * DAY_MS;
    after = first + DAY_MS * 7;
  } else {
    // The monthly contest uses the Persian (Solar Hijri) month in Tehran.
    const persian = parts(persianParts, now);
    first = today - (Number(persian.day) - 1) * DAY_MS;
    after = null;
    for (let days = 28; days <= 32; days++) {
      const candidate = first + days * DAY_MS;
      const p = parts(persianParts, midnightFromDayNumber(candidate) + 12 * 3600000);
      if (Number(p.day) === 1) {
        after = candidate;
        break;
      }
    }
    if (after === null) throw new Error('PERSIAN_MONTH_BOUNDARY_NOT_FOUND');
  }

  const start = midnightFromDayNumber(first);
  const end = midnightFromDayNumber(after);
  const label = persianLabel.format(new Date(start + 12 * 3600000)) + ' — ' +
    persianLabel.format(new Date(end - 1000));
  return { period, offset, timeZone: TIME_ZONE, start, end,
    startLabel: label, endLabel: persianLabel.format(new Date(end)),
    remainingSeconds: Math.max(0, Math.ceil((end - now) / 1000)) };
}

export function tehranWeekStart(now = Date.now()) {
  return periodBounds(now, 'week').start;
}
