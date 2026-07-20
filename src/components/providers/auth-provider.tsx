"use client";

import { useEffect, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useAuthStore } from "@/stores/auth-store";
import { useGuestLibraryStore } from "@/stores/guest-library-store";
import {
  getClientAuth,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { fetchMe } from "@/lib/api/user";
import { putFavorite, putLibrary } from "@/lib/api/user";
import {
  defaultProfileFromUser,
  defaultSettings,
  mergeProfile,
  mergeSettings,
  readLocalProfile,
  readLocalSettings,
  writeLocalProfile,
  writeLocalSettings,
  setMatureFlagClient,
} from "@/lib/user/local-profile";
import { clearMatureSessionUnlock } from "@/lib/user/mature-pin";

async function migrateGuestData(uid: string) {
  const guest = useGuestLibraryStore.getState();
  try {
    const { readLocalLibrary, upsertLocalLibrary, writeLocalLibrary } =
      await import("@/lib/user/local-library");
    // Pull guest local library into the signed-in user library
    const guestLib = readLocalLibrary(null);
    for (const item of guestLib) {
      upsertLocalLibrary(uid, {
        contentId: item.contentId,
        status: item.status,
        snapshot: item.snapshot,
        rating: item.rating,
      });
      try {
        await putLibrary(item.contentId, { status: item.status });
      } catch {
        /* keep local */
      }
    }
    for (const item of guest.library) {
      upsertLocalLibrary(uid, {
        contentId: item.contentId,
        status: item.status,
        snapshot: item.snapshot,
      });
      try {
        await putLibrary(item.contentId, { status: item.status });
      } catch {
        /* keep local */
      }
    }
    for (const id of guest.favorites) {
      try {
        await putFavorite(id);
      } catch {
        /* ignore */
      }
    }
    writeLocalLibrary(null, []);
    guest.clear();
  } catch {
    // migration best-effort
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    setUser,
    setProfile,
    setSettings,
    setLoading,
    setIsAdmin,
    reset,
  } = useAuthStore();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    let unsub = () => {};
    try {
      const auth = getClientAuth();
      unsub = onAuthStateChanged(auth, async (user: User | null) => {
        setUser(user);
        if (!user) {
          clearMatureSessionUnlock();
          reset();
          setLoading(false);
          return;
        }

        const localP = readLocalProfile(user.uid);
        const localS = readLocalSettings(user.uid);

        // Hydrate UI immediately from local cache
        const immediateProfile = mergeProfile(null, localP, user);
        const immediateSettings = mergeSettings(null, localS, user.uid);
        setProfile(immediateProfile);
        setSettings(immediateSettings);
        setMatureFlagClient(Boolean(immediateSettings.matureContent));

        try {
          const tokenResult = await user.getIdTokenResult();
          setIsAdmin(Boolean(tokenResult.claims.admin));

          try {
            const me = await fetchMe();
            const profile = mergeProfile(me.profile, localP, user);
            const settings = mergeSettings(me.settings, localS, user.uid);
            setProfile(profile);
            setSettings(settings);
            writeLocalProfile(user.uid, profile);
            writeLocalSettings(user.uid, settings);
            setMatureFlagClient(Boolean(settings.matureContent));
          } catch {
            // Keep local/immediate profile — do not clear to null
            if (!localP) {
              const p = defaultProfileFromUser(user);
              setProfile(p);
              writeLocalProfile(user.uid, p);
            }
            if (!localS) {
              const s = defaultSettings(user.uid);
              setSettings(s);
              writeLocalSettings(user.uid, s);
            }
          }

          await migrateGuestData(user.uid);
        } catch {
          if (!localP) setProfile(defaultProfileFromUser(user));
          if (!localS) setSettings(defaultSettings(user.uid));
        } finally {
          setLoading(false);
        }
      });
    } catch {
      setLoading(false);
    }
    return () => unsub();
  }, [setUser, setProfile, setSettings, setLoading, setIsAdmin, reset]);

  return <>{children}</>;
}
