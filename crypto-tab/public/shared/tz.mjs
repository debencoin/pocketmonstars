// Time-zone helpers (work in the browser and in Node). Phoenix = America/Phoenix = Mountain
// Standard Time all year (Arizona does not use daylight saving).
const fmts = new Map();
function parts(ms, tz) {
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }); fmts.set(tz, f); }
  const o = {}; for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function hourIn(ms, tz) { return Number(parts(ms, tz).hour) % 24; }
export function weekdayIn(ms, tz) { return WD[parts(ms, tz).weekday]; }

// tz offset in minutes at an instant (local - UTC)
export function offsetMin(ms, tz) {
  const p = parts(ms, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, Number(p.hour) % 24, +p.minute);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

// instant of a wall-clock time in a zone
export function zonedToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo, d, h, mi);
  const t = guess - offsetMin(guess, tz) * 60000;
  return guess - offsetMin(t, tz) * 60000; // second pass settles daylight-saving edges
}

export function label(tz) {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value;
    const city = tz.split('/').pop().replace(/_/g, ' ');
    return `${city} · ${name}`;
  } catch { return tz; }
}

const h12 = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
export const hourLabel = (h) => h12(h);

// When the world's trading sessions open, expressed in the chosen zone (for today's date).
export function sessions(tz, ref = Date.now()) {
  const list = [
    ['Asia open (Tokyo)', 'Asia/Tokyo', 9, 0],
    ['Hong Kong / China open', 'Asia/Hong_Kong', 9, 30],
    ['Europe open (London)', 'Europe/London', 8, 0],
    ['US stocks open (New York)', 'America/New_York', 9, 30],
    ['US stocks close', 'America/New_York', 16, 0],
    ['Daily candle close (UTC 00:00)', 'UTC', 0, 0],
    ['CME futures reopen (Sun)', 'America/Chicago', 17, 0],
  ];
  const d = new Date(ref);
  return list.map(([name, zone, h, m]) => {
    const p = parts(ref, zone);
    const at = zonedToUtc(+p.year, +p.month - 1, +p.day, h, m, zone);
    const q = parts(at, tz);
    return { name, hour: Number(q.hour) % 24, minute: +q.minute, text: `${h12(Number(q.hour) % 24).replace(' ', `:${q.minute} `)}` };
  }).sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

export function fmtTime(ms, tz, opts = { hour: 'numeric', minute: '2-digit' }) {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(ms)); } catch { return new Date(ms).toLocaleString(); }
}

export const COMMON_ZONES = [
  ['America/Phoenix', 'Phoenix · Mountain Standard (no DST)'], ['America/Denver', 'Denver · Mountain'], ['America/Los_Angeles', 'Los Angeles · Pacific'],
  ['America/Chicago', 'Chicago · Central'], ['America/New_York', 'New York · Eastern'], ['UTC', 'UTC'], ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin / Paris'],
  ['Asia/Dubai', 'Dubai'], ['Asia/Kolkata', 'India'], ['Asia/Singapore', 'Singapore'], ['Asia/Hong_Kong', 'Hong Kong'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney'],
];
