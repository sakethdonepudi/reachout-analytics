/** Cross-tab sign-out signal. The idle provider listens on the same channel. */
export const SESSION_CHANNEL = "ro-idle";

export function broadcastLogout() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    channel.postMessage({ type: "logout" });
    window.setTimeout(() => channel.close(), 50);
  } catch {
    // Private modes can block BroadcastChannel. The local sign-out still runs.
  }
}
