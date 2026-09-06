const KEY = "eb-studio-lock";
const EVENT = "eb-studio-lock";

function readCookie(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.cookie.split(";").some((part) => part.trim() === `${KEY}=1`);
  } catch {
    return false;
  }
}

function writeCookie(on: boolean) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = on
      ? `${KEY}=1; Path=/; SameSite=Lax`
      : `${KEY}=; Path=/; SameSite=Lax; Max-Age=0`;
  } catch {
    /* cookie blocked */
  }
}

export function isStudioLocked(): boolean {
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(KEY) === "1") return true;
  } catch {
    /* storage blocked */
  }
  return readCookie();
}

export function lockStudioSession() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked */
  }
  writeCookie(true);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function unlockStudioSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
  writeCookie(false);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function subscribeStudioLock(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
