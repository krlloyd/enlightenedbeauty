import { unlockStudioSession } from "./studio-lock";
import { useSalon } from "./store";

const EXTRA_KEYS = ["eb-stripe-pending", "eb-stripe-done"];

export function clearBrowserSiteData() {
  try {
    useSalon.persist.clearStorage();
  } catch {
    /* storage blocked */
  }
  try {
    useSalon.getState().setProduction(false);
    useSalon.getState().resetDemo();
  } catch {
    /* store not ready */
  }
  try {
    localStorage.removeItem("enlightened-beauty-v1");
    localStorage.removeItem("enlightened-beauty-v2");
    localStorage.removeItem("enlightened-beauty-v3");
    for (const key of EXTRA_KEYS) localStorage.removeItem(key);
    sessionStorage.removeItem("eb-stripe-pending");
    sessionStorage.removeItem("eb-stripe-done");
  } catch {
    /* storage blocked */
  }
  unlockStudioSession();
}
