"use client";
import { useCallback, useSyncExternalStore } from "react";
import { isMatureEnabledClient } from "@/lib/user/local-profile";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("cineverse-settings-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("cineverse-settings-changed", callback);
  };
}
export function useDeviceMature(uid?: string) {
  return useSyncExternalStore(subscribe, useCallback(() => isMatureEnabledClient(uid), [uid]), () => false);
}
