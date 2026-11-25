// Telegram alerts + commands (feature carried over from the ZORA Zcash agent).
// Set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID on the server, or save them in Settings (encrypted).
// Only the configured chat is answered; /start in any chat replies with its chat id for setup.
import { load, save, encrypt, decrypt } from './store.mjs';

let cfg = null, offset = 0, polling = false;
const handlers = {};
export const onCommand = (name, fn) => { handlers[name] = fn; };

function config() {
  if (process.env.TELEGRAM_BOT_TOKEN) return { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID || null, source: 'env' };
  if (cfg) return cfg;
  const box = load('telegram', null);
  if (box?.box) { try { cfg = { ...decrypt(box.box), source: 'settings' }; } catch { cfg = null; } }
  return cfg;
}

export function status() { const c = config(); return { configured: !!c?.token, chat: c?.chatId ? `…${String(c.chatId).slice(-4)}` : null, source: c?.source || null }; }

export function configure({ token, chatId }) {
  if (!token) { save('telegram', null); cfg = null; return status(); }
  cfg = { token: String(token).trim(), chatId: chatId ? String(chatId).trim() : null, source: 'settings' };
  save('telegram', { box: encrypt({ token: cfg.token, chatId: cfg.chatId }) });
  startPolling();
  return status();
}

async function call(method, body) {
  const c = config(); if (!c?.token) throw new Error('Telegram is not set up');
  const r = await fetch(`https://api.telegram.org/bot${c.token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(35000) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || 'Telegram error');
  return j.result;
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export async function send(text, chatId) {
  const c = config(); if (!c?.token || !(chatId || c.chatId)) return false;
  await call('sendMessage', { chat_id: chatId || c.chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
  return true;
}

// Notifications from the app (alarms, profits, bots, news, herd) as Telegram messages.
export function notify(n) {
  if (!config()?.chatId) return;
  if (n.kind === 'alarm' && n.ring > 1 && n.ring % 4 !== 1) return; // ringing alarms: repeat every ~2 minutes, not every 30 s
  const icon = { alarm: '⏰', profit: '💰', bot: '🤖', news: '📰', herd: '🔗', fill: '✅', test: '✅' }[n.kind] || '🔔';
  send(`${icon} <b>${esc(n.title)}</b>\n${esc(n.body || '')}${n.kind === 'alarm' ? '\n\nReply /stop to silence the alarm.' : ''}`).catch(() => {});
}

async function poll() {
  const c = config(); if (!c?.token) { polling = false; return; }
  try {
    const ups = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
    for (const u of ups) {
      offset = u.update_id + 1;
      const m = u.message; if (!m?.text) continue;
      const chat = String(m.chat.id);
      const [cmd, ...args] = m.text.trim().split(/\s+/);
      const name = cmd.replace(/^\//, '').replace(/@.*/, '').toLowerCase();
      if (name === 'start' || name === 'id') { await send(`Crypto Tab here. This chat id is <code>${chat}</code>. Put it in Settings → Telegram${c.chatId ? '' : ' to receive alerts'}.`, chat); continue; }
      if (!c.chatId || chat !== String(c.chatId)) continue; // only the owner's chat
      const h = handlers[name];
      try { await send(h ? await h(args) : 'Commands: /price ZEC · /bots · /pause all · /resume all · /stop · /news ZEC · /herd · /alerts', chat); }
      catch (e) { await send(`⚠️ ${esc(e.message)}`, chat); }
    }
  } catch { await new Promise((r) => setTimeout(r, 10000)); }
  setImmediate(poll);
}

export function startPolling() { if (polling || !config()?.token) return; polling = true; poll(); }
export { esc };
