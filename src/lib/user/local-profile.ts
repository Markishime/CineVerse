/**
 * Client-side persistence for profile + settings.
 * Server user-store is in-memory per Cloud Function instance — localStorage
 * is the reliable source of truth for the signed-in member's preferences.
 */
import type { UserProfile, UserSettings } from "@/types/content";
import type { User } from "firebase/auth";

export function profileKey(uid: string) {
  return `cineverse_profile_${uid}`;
}
export function settingsKey(uid: string) {
  return `cineverse_settings_${uid}`;
}

export function readLocalProfile(uid: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(profileKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function readLocalSettings(uid: string): UserSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(settingsKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as UserSettings;
  } catch {
    return null;
  }
}

export function writeLocalProfile(uid: string, profile: UserProfile) {
  try {
    window.localStorage.setItem(profileKey(uid), JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function writeLocalSettings(uid: string, settings: UserSettings) {
  try {
    window.localStorage.setItem(settingsKey(uid), JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function defaultProfileFromUser(user: User): UserProfile {
  const username =
    user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) ||
    `user_${user.uid.slice(0, 6)}`;
  const ts = new Date().toISOString();
  return {
    uid: user.uid,
    username,
    displayName: user.displayName || username,
    bio: "",
    avatarUrl: user.photoURL,
    isPublic: true,
    stats: {
      watched: 0,
      watching: 0,
      planToWatch: 0,
      favorites: 0,
      reviews: 0,
    },
    createdAt: ts,
    updatedAt: ts,
  };
}

export function defaultSettings(uid: string): UserSettings {
  return {
    uid,
    /** Locked US market */
    region: "US",
    language: "en",
    preferredProviders: [],
    preferredContentTypes: [],
    animeTitlePreference: "english",
    animeAudioLanguage: "ja",
    kdramaAudioLanguage: "ko",
    generalAudioLanguage: "en",
    matureContent: false,
    performanceMode: "cinematic",
    notificationPrefs: {
      airing: true,
      recommendations: true,
      social: true,
      product: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Prefer newer local prefs (e.g. matureContent) over cold-start server defaults */
export function mergeProfile(
  server: UserProfile | null,
  local: UserProfile | null,
  user: User,
): UserProfile {
  const base = server ?? local ?? defaultProfileFromUser(user);
  if (!local) return base;
  const serverTs = Date.parse(server?.updatedAt ?? "") || 0;
  const localTs = Date.parse(local.updatedAt ?? "") || 0;
  if (localTs >= serverTs) {
    return { ...base, ...local, uid: user.uid };
  }
  return base;
}

export function mergeSettings(
  server: UserSettings | null,
  local: UserSettings | null,
  uid: string,
): UserSettings {
  const base = server ?? local ?? defaultSettings(uid);
  if (!local) return base;
  const serverTs = Date.parse(server?.updatedAt ?? "") || 0;
  const localTs = Date.parse(local.updatedAt ?? "") || 0;
  if (localTs >= serverTs) {
    return { ...base, ...local, uid };
  }
  // Always preserve matureContent from local if user turned it on this device
  if (local.matureContent && !base.matureContent) {
    return { ...base, matureContent: true, uid };
  }
  return base;
}

export function isMatureEnabledClient(uid?: string | null): boolean {
  if (typeof window === "undefined") return false;
  if (uid) {
    const s = readLocalSettings(uid);
    if (s?.matureContent) return true;
  }
  try {
    return window.localStorage.getItem("cineverse_mature_flag") === "1";
  } catch {
    return false;
  }
}

export function setMatureFlagClient(on: boolean) {
  try {
    if (on) window.localStorage.setItem("cineverse_mature_flag", "1");
    else window.localStorage.removeItem("cineverse_mature_flag");
  } catch {
    /* ignore */
  }
}
