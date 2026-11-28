// Turn the API's upload response ({ message, discord: { posted, updated, skipped, error } }) into a short status line.
export function discordStatusText(json) {
  const d = json?.discord;
  const stored = json?.publicUrl ? "Saved" : `⚠️ Not saved (${json?.message || "unknown error"})`;
  if (!d) return json?.message || "Done";
  if (d.posted) return `${stored} · ✅ ${d.updated ? "Discord message updated" : "Posted on Discord"}`;
  if (d.skipped) return `${stored} · Not posted: ${d.skipped}`;
  return `${stored} · ❌ Discord: ${d.error || "failed"}`;
}
