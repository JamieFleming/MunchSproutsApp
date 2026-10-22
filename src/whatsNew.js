import AsyncStorage from "@react-native-async-storage/async-storage";

export const WHATS_NEW_VERSION = "1.6.2";
const releaseStarted = Date.parse("2026-10-22T20:17:50Z");
const key = (uid) => `whatsNew:${WHATS_NEW_VERSION}:${uid}`;
const dismissed = new Set();

// Per account on this device; a storage failure must never block app access.
export async function dismissWhatsNew(uid) {
  if (!uid) return;
  dismissed.add(uid);
  try {
    await AsyncStorage.setItem(key(uid), "seen");
  } catch {
    // In-memory dismissal still prevents repeats during this session.
  }
}

export async function shouldShowWhatsNew(user, version) {
  if (!user?.uid || version !== WHATS_NEW_VERSION || dismissed.has(user.uid))
    return false;
  if (Date.parse(user.metadata?.creationTime) >= releaseStarted) return false;
  try {
    const seen = await AsyncStorage.getItem(key(user.uid));
    return !seen && !dismissed.has(user.uid);
  } catch {
    return false;
  }
}
