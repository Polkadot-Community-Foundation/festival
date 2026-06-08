/**
 * Fesival Announcements — Polkadot chat extension (Worker entry).
 *
 * The worker modality of web3summit.dot. On a timer it reads the Festival
 * contract's on-chain `channelMetadataCid`, resolves the channel doc + any new
 * announcement bodies from Bulletin (all reads host-routed — see chain.ts), and
 * posts them into the host chat as plain Text. Posted body CIDs persist in
 * hostLocalStorage so each body posts exactly once.
 *
 * Slash commands (delivered by the host as first-class Command actions):
 *   /announcements — list the whole channel on demand
 *   /agenda        — today's festival sessions
 *   /help          — list the commands
 *
 * Chat APIs work only from the Worker (never the App webview) — this is the
 * Worker. v1 is Text-only; rich custom-rendered cards are a later styling pass.
 */

import {
  createProductChatManager,
  hostLocalStorage,
} from "@novasamatech/host-api-wrapper";
import {
  type AnnouncementBody,
  BOT_ID,
  BOT_NAME,
  type ChannelMetadata,
  type FestivalMetadata,
  POLL_INTERVAL_MS,
  ROOM_ID,
  type ScheduleEntry,
  SEEN_CIDS_KEY,
} from "./config";
import {
  bytes32ToCid,
  isZeroCid,
  readChannelMetadataCid,
  readMetadataCid,
  retrieveJson,
} from "./chain";

const TAG = "[w3s-announcements]";
console.log(TAG, "worker loaded");

const HELP_TEXT = [
  "Festival Announcements",
  "",
  "/announcements — list every announcement so far",
  "/agenda — today's sessions",
  "/help — show this message",
  "",
  "New announcements post here automatically as they go out.",
].join("\n");

const chat = createProductChatManager();

// 1. Register bot (fire-and-forget; idempotent).
chat
  .registerBot({ botId: BOT_ID, name: BOT_NAME, icon: "" })
  .then((status) => console.log(TAG, "registerBot", status))
  .catch((err) => console.error(TAG, "registerBot failed", err));

// 2. Register room + welcome once, then start polling.
chat
  .registerRoom({ roomId: ROOM_ID, name: BOT_NAME, icon: "" })
  .then(async (status) => {
    console.log(TAG, "registerRoom", status);
    if (status === "New") {
      await safeSend(
        "Welcome to the Festival! Here you'll find key information about the event.\n\n" +
          "Type /help for help, /announcements to stay informed, and /agenda to see what's coming up next.",
      );
    }
    startPollLoop();
  })
  .catch((err) => console.error(TAG, "registerRoom failed", err));

// 3. Slash commands. This host (Polkadot Desktop @ 19ea0a13) does NOT emit a
// `Command` chat action for product workers — it only delivers `MessagePosted`
// (user text) and `ActionTriggered`, and it does NOT intercept "/". So a typed
// "/announcements" arrives as plain Text, and we parse the command out of it.
// Both "/" and "!" prefixes are accepted ("/" is the one we advertise).
// (Bot replies never start with "/" or "!", so this can't react to its own
// output even if the host echoed it — which it doesn't at this rev.)
chat.subscribeAction((action) => {
  if (action.payload.tag !== "MessagePosted") return;
  if (action.roomId !== ROOM_ID) return;
  if (action.payload.value.tag !== "Text") return;
  const text = action.payload.value.value.trim();
  if (!text.startsWith("/") && !text.startsWith("!")) return;
  const command =
    text.slice(1).trimStart().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (command === "" || command === "help") {
    void sendHelp();
  } else if (command.startsWith("annou")) {
    void listAllAnnouncements();
  } else if (command === "agenda") {
    void sendAgenda();
  } else {
    void safeSend("Unknown command. Send /help to see what I can do.");
  }
});

let isProcessing = false;

function startPollLoop(): void {
  void tick(); // immediate first tick
  setInterval(() => void tick(), POLL_INTERVAL_MS);
}

async function tick(): Promise<void> {
  if (isProcessing) return; // guard against overlapping ticks
  isProcessing = true;
  try {
    const channel = await loadChannel();
    if (!channel) return;
    const announcements = channel.announcements ?? [];
    const seen = await readSeen();

    // First run (no persisted state): adopt the current history as the baseline
    // and don't backfill — only announcements posted after install will notify.
    if (seen === null) {
      await writeSeen(announcements);
      console.log(
        TAG,
        `baseline set: ${announcements.length} existing announcement(s)`,
      );
      return;
    }

    const seenSet = new Set(seen);
    const fresh = announcements.filter((cid) => !seenSet.has(cid));
    if (fresh.length === 0) return;

    console.log(TAG, `${fresh.length} new announcement(s)`);
    for (const cid of fresh) {
      try {
        await safeSend(
          formatAnnouncement(await retrieveJson<AnnouncementBody>(cid)),
        );
      } catch (err) {
        console.warn(TAG, "failed to fetch/post announcement", cid, err);
      }
      // Mark seen regardless: a permanently-missing body must not wedge the loop
      // into re-posting everything after it on every tick.
      seenSet.add(cid);
    }
    await writeSeen([...seenSet]);
  } catch (err) {
    console.error(TAG, "tick failed", err);
  } finally {
    isProcessing = false;
  }
}

/** Read the on-chain pointer → channel doc (both host-routed). null if unset. */
async function loadChannel(): Promise<ChannelMetadata | null> {
  const pointer = await readChannelMetadataCid();
  if (isZeroCid(pointer)) {
    console.log(TAG, "channel CID unset — nothing to post yet");
    return null;
  }
  return retrieveJson<ChannelMetadata>(bytes32ToCid(pointer));
}

function formatAnnouncement(body: AnnouncementBody): string {
  const who = body.senderName?.trim() || "Festival";
  const when = Number.isFinite(body.timestamp)
    ? new Date(body.timestamp).toLocaleString()
    : "";
  const header = when ? `📢 ${who} · ${when}` : `📢 ${who}`;
  return `${header}\n\n${body.content}`;
}

function sendHelp(): Promise<void> {
  return safeSend(HELP_TEXT);
}

/** Post every announcement currently in the channel, on demand (/announcements). */
async function listAllAnnouncements(): Promise<void> {
  try {
    const channel = await loadChannel();
    const cids = channel?.announcements ?? [];
    if (cids.length === 0) {
      await safeSend("📭 No announcements have been posted yet.");
      return;
    }
    await safeSend(
      `📋 ${cids.length} announcement${cids.length === 1 ? "" : "s"}:`,
    );
    for (const cid of cids) {
      try {
        await safeSend(
          formatAnnouncement(await retrieveJson<AnnouncementBody>(cid)),
        );
      } catch (err) {
        console.warn(TAG, "list: fetch failed", cid, err);
        await safeSend(
          `⚠️ Couldn't load one announcement (${cid.slice(0, 14)}…).`,
        );
      }
    }
  } catch (err) {
    console.error(TAG, "/announcements failed", err);
    await safeSend(
      `⚠️ Couldn't read the channel: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Read the festival schedule (host-routed) and post today's sessions (/agenda). */
async function sendAgenda(): Promise<void> {
  try {
    const pointer = await readMetadataCid();
    if (isZeroCid(pointer)) {
      await safeSend("📭 No festival schedule has been published yet.");
      return;
    }
    const meta = await retrieveJson<FestivalMetadata>(bytes32ToCid(pointer));
    // "Today" is the user's local calendar day — attendees are on-site, so the
    // device clock matches the festival's day.
    const today = (meta.schedule ?? [])
      .filter((e) => isToday(e.start))
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
    if (today.length === 0) {
      await safeSend("📅 Nothing on the agenda for today.");
      return;
    }
    const lines = today.map(formatScheduleEntry).join("\n\n");
    await safeSend(
      `Today's agenda (${today.length} session${today.length === 1 ? "" : "s"}):\n\n${lines}`,
    );
  } catch (err) {
    console.error(TAG, "/agenda failed", err);
    await safeSend(
      `Couldn't read the schedule: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** True if an ISO-8601 timestamp falls on the user's local calendar day. */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

function formatScheduleEntry(e: ScheduleEntry): string {
  const d = new Date(e.start);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const who = e.speakers?.length ? `\n  ${e.speakers.join(", ")}` : "";
  return `${hhmm} — ${e.title}${who}`;
}

async function readSeen(): Promise<string[] | null> {
  try {
    const value = await hostLocalStorage.readJSON(SEEN_CIDS_KEY);
    return Array.isArray(value) ? (value as string[]) : null;
  } catch {
    return null;
  }
}

async function writeSeen(cids: string[]): Promise<void> {
  try {
    await hostLocalStorage.writeJSON(SEEN_CIDS_KEY, cids);
  } catch (err) {
    console.warn(TAG, "persist seen-cids failed", err);
  }
}

async function safeSend(value: string): Promise<void> {
  try {
    await chat.sendMessage(ROOM_ID, { tag: "Text", value });
  } catch (err) {
    console.error(TAG, "sendMessage failed", err);
  }
}
