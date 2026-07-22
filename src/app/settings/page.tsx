"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { updateMe, updateSettings } from "@/lib/api/user";
import type { AnimeTitlePreference, ContentType } from "@/types/content";
import { PinGateModal } from "@/components/content/pin-gate";
import {
  setMatureFlagClient,
  writeLocalProfile,
  writeLocalSettings,
} from "@/lib/user/local-profile";
import {
  clearMatureSessionUnlock,
  hasParentalPin,
  setMatureSessionUnlocked,
  setParentalPin,
  verifyParentalPin,
} from "@/lib/user/mature-pin";
import { setDeviceRegion } from "@/lib/user/region";
import { useQueryClient } from "@tanstack/react-query";

type PinModalMode = "create" | "verify-enable" | "change" | null;

export default function SettingsPage() {
  const { user, profile, settings, setProfile, setSettings } = useAuthStore();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [animePref, setAnimePref] = useState<AnimeTitlePreference>("english");
  const [animeAudioLang, setAnimeAudioLang] = useState("ja");
  const [kdramaAudioLang, setKdramaAudioLang] = useState("ko");
  const [generalAudioLang, setGeneralAudioLang] = useState("en");
  const [mature, setMature] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinModal, setPinModal] = useState<PinModalMode>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
    }
    if (settings) {
      setAnimePref(settings.animeTitlePreference ?? "english");
      setAnimeAudioLang(settings.animeAudioLanguage ?? "ja");
      setKdramaAudioLang(settings.kdramaAudioLanguage ?? "ko");
      setGeneralAudioLang(settings.generalAudioLanguage ?? "en");
      setMature(Boolean(settings.matureContent));
    }
    if (user?.uid) {
      setPinConfigured(hasParentalPin(user.uid));
    } else {
      setPinConfigured(false);
    }
  }, [profile, settings, user?.uid]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
          Account
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-white">
          Settings
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Sign in free to manage profile, parental PIN, region, and preferences.
          CineVerse is unlimited for every member.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="secondary">Create free account</Button>
          </Link>
        </div>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    const localProfile = {
      ...(profile ?? {
        uid: user.uid,
        username:
          username ||
          user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") ||
          `user_${user.uid.slice(0, 6)}`,
        displayName: displayName || user.displayName || "Member",
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      displayName: displayName.trim() || profile?.displayName || "Member",
      username:
        username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) ||
        profile?.username ||
        "member",
      bio: bio.slice(0, 280),
      updatedAt: new Date().toISOString(),
    };

    const localSettings = {
      ...(settings ?? {
        uid: user.uid,
        language: "en",
        preferredProviders: [],
        preferredContentTypes: [] as ContentType[],
        performanceMode: "cinematic" as const,
        notificationPrefs: {
          airing: true,
          recommendations: true,
          social: true,
          product: false,
        },
      }),
      uid: user.uid,
      region: "US",
      animeTitlePreference: animePref,
      animeAudioLanguage: animeAudioLang,
      kdramaAudioLanguage: kdramaAudioLang,
      generalAudioLanguage: generalAudioLang,
      matureContent: mature,
      preferredContentTypes: [] as ContentType[],
      updatedAt: new Date().toISOString(),
    };

    try {
      if (isFirebaseConfigured()) {
        await user.getIdToken(true);
      }
      const [{ profile: nextProfile }, { settings: nextSettings }] =
        await Promise.all([
          updateMe({
            displayName: localProfile.displayName,
            username: localProfile.username,
            bio: localProfile.bio,
          }),
          updateSettings({
            region: "US",
            animeTitlePreference: animePref,
            animeAudioLanguage: animeAudioLang,
            kdramaAudioLanguage: kdramaAudioLang,
            generalAudioLanguage: generalAudioLang,
            matureContent: mature,
            preferredContentTypes: [] as ContentType[],
          }),
        ]);
      setProfile(nextProfile);
      setSettings(nextSettings);
      writeLocalProfile(user.uid, nextProfile);
      writeLocalSettings(user.uid, nextSettings);
      setMatureFlagClient(Boolean(nextSettings.matureContent));
      setDeviceRegion("US");
      void queryClient.invalidateQueries({
        queryKey: ["catalog"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["home"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["providers"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["playback"],
        refetchType: "all",
      });
      setMessage("Saved. Catalog stays United States · live home will refresh.");
    } catch {
      // Always keep preferences on this device so the UI does not hard-fail
      setProfile(localProfile);
      setSettings(localSettings);
      writeLocalProfile(user.uid, localProfile);
      writeLocalSettings(user.uid, localSettings);
      setMatureFlagClient(Boolean(localSettings.matureContent));
      setDeviceRegion("US");
      void queryClient.invalidateQueries({
        queryKey: ["catalog"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["home"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["providers"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["playback"],
        refetchType: "all",
      });
      setMessage("Saved on this device.");
    } finally {
      setSaving(false);
    }
  };

  const persistMatureLocal = (on: boolean) => {
    const base = settings ?? {
      uid: user.uid,
      region: "US",
      language: "en",
      preferredProviders: [] as number[],
      preferredContentTypes: [] as ContentType[],
      animeTitlePreference: animePref,
      animeAudioLanguage: animeAudioLang,
      kdramaAudioLanguage: kdramaAudioLang,
      generalAudioLanguage: generalAudioLang,
      performanceMode: "cinematic" as const,
      notificationPrefs: {
        airing: true,
        recommendations: true,
        social: true,
        product: false,
      },
    };
    const next = {
      ...base,
      uid: user.uid,
      matureContent: on,
      animeTitlePreference: animePref,
      animeAudioLanguage: animeAudioLang,
      kdramaAudioLanguage: kdramaAudioLang,
      generalAudioLanguage: generalAudioLang,
      updatedAt: new Date().toISOString(),
    };
    setSettings(next);
    writeLocalSettings(user.uid, next);
    setMatureFlagClient(on);
    if (!on) clearMatureSessionUnlock();
  };

  const onMatureCheckbox = (checked: boolean) => {
    setError(null);
    setMessage(null);
    if (!checked) {
      setMature(false);
      persistMatureLocal(false);
      return;
    }
    if (!hasParentalPin(user.uid)) {
      setError(
        "Set a parental PIN below first. Kids can’t access 18+ without a PIN.",
      );
      setPinModal("create");
      return;
    }
    setPinModal("verify-enable");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
        Account
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        Settings
      </h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Free unlimited account. Cinematic presentation is always on.
      </p>

      <section className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Profile
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Signed in as {user.email}
        </p>
        <label className="block text-sm text-[var(--text-secondary)]">
          Display name
          <Input
            className="mt-1.5 h-11"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block text-sm text-[var(--text-secondary)]">
          Username
          <Input
            className="mt-1.5 h-11"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))
            }
          />
        </label>
        <label className="block text-sm text-[var(--text-secondary)]">
          Bio
          <textarea
            className="field-textarea mt-1.5"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 280))}
          />
        </label>
        {profile?.username && (
          <Link
            href={`/profile/${profile.username}`}
            className="inline-block text-sm text-[var(--primary-light)] underline"
          >
            View public profile
          </Link>
        )}
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Parental PIN
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          A 4–6 digit PIN is required before enabling 18+ mature content and
          before opening the 18+ library. Configure it here so kids can’t turn
          mature titles on.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              pinConfigured
                ? "bg-[var(--success)]/15 text-[var(--success)]"
                : "bg-white/10 text-[var(--text-muted)]"
            }`}
          >
            {pinConfigured ? "PIN configured" : "PIN not set"}
          </span>
          {!pinConfigured ? (
            <Button size="sm" onClick={() => setPinModal("create")}>
              Create PIN
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPinModal("change")}
            >
              Change PIN
            </Button>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Watching preferences
        </h2>
        <div className="rounded-xl border border-white/10 bg-[var(--background-secondary)] px-4 py-3">
          <p className="text-sm font-medium text-white">Region</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            CineVerse is{" "}
            <span className="font-semibold text-[var(--primary-light)]">
              United States (US)
            </span>{" "}
            only. Featured, Movies, and legal providers use the US market.
          </p>
        </div>
        <label className="block text-sm text-[var(--text-secondary)]">
          Anime title language
          <select
            className="field-select mt-1.5"
            value={animePref}
            onChange={(e) =>
              setAnimePref(e.target.value as AnimeTitlePreference)
            }
          >
            <option value="english">English</option>
            <option value="romaji">Romaji</option>
            <option value="native">Native</option>
          </select>
        </label>
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Audio language
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Default audio language when playing content. The player uses these
          unless the embed source does not support the language.
        </p>
        <label className="block text-sm text-[var(--text-secondary)]">
          Anime
          <select
            className="field-select mt-1.5"
            value={animeAudioLang}
            onChange={(e) => setAnimeAudioLang(e.target.value)}
          >
            <option value="ja">Japanese</option>
            <option value="en">English</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="pt">Portuguese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="ru">Russian</option>
            <option value="hi">Hindi</option>
            <option value="th">Thai</option>
            <option value="id">Indonesian</option>
            <option value="ms">Malay</option>
            <option value="vi">Vietnamese</option>
            <option value="tl">Tagalog</option>
          </select>
        </label>
        <label className="block text-sm text-[var(--text-secondary)]">
          K-drama / Korean
          <select
            className="field-select mt-1.5"
            value={kdramaAudioLang}
            onChange={(e) => setKdramaAudioLang(e.target.value)}
          >
            <option value="ko">Korean</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="pt">Portuguese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="ru">Russian</option>
            <option value="hi">Hindi</option>
            <option value="th">Thai</option>
            <option value="id">Indonesian</option>
            <option value="ms">Malay</option>
            <option value="vi">Vietnamese</option>
            <option value="tl">Tagalog</option>
          </select>
        </label>
        <label className="block text-sm text-[var(--text-secondary)]">
          Movies / Series / Other
          <select
            className="field-select mt-1.5"
            value={generalAudioLang}
            onChange={(e) => setGeneralAudioLang(e.target.value)}
          >
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="es">Spanish</option>
            <option value="pt">Portuguese</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="ru">Russian</option>
            <option value="hi">Hindi</option>
            <option value="th">Thai</option>
            <option value="ar">Arabic</option>
            <option value="tr">Turkish</option>
            <option value="pl">Polish</option>
            <option value="nl">Dutch</option>
            <option value="sv">Swedish</option>
            <option value="da">Danish</option>
            <option value="no">Norwegian</option>
            <option value="fi">Finnish</option>
            <option value="id">Indonesian</option>
            <option value="ms">Malay</option>
            <option value="vi">Vietnamese</option>
            <option value="tl">Tagalog</option>
          </select>
        </label>
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Parental controls
        </h2>
        <div className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-4">
          <p className="text-sm font-semibold text-white">18+ mature content</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            When enabled, Movies / Series / Anime and the dedicated{" "}
            <Link href="/mature" className="text-[var(--primary-light)] underline">
              18+ Mature library
            </Link>{" "}
            include R / NC-17 / TV-MA / adult-tagged titles. Requires a parental
            PIN (set above). The 18+ nav tab only appears when this is on.
            Default is off.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={mature}
              onChange={(e) => onMatureCheckbox(e.target.checked)}
              className="h-4 w-4 rounded border-white/20"
            />
            Show 18+ mature titles (movies, series, anime)
          </label>
          {!pinConfigured && (
            <p className="mt-2 text-xs text-[var(--danger)]">
              Create a parental PIN first, then check this box and enter the PIN.
            </p>
          )}
          {mature && (
            <Link
              href="/mature"
              className="mt-3 inline-block text-sm text-[var(--primary-light)] underline"
            >
              Browse mature library →
            </Link>
          )}
        </div>
      </section>

      <PinGateModal
        open={pinModal === "create"}
        mode="create"
        onCancel={() => setPinModal(null)}
        onCreatePin={(pin) => {
          setParentalPin(user.uid, pin);
          setPinConfigured(true);
        }}
        onSuccess={() => {
          setPinModal(null);
          setMessage("Parental PIN saved. You can now enable 18+ mature content.");
          setError(null);
        }}
      />

      <PinGateModal
        open={pinModal === "verify-enable"}
        mode="verify"
        title="Confirm parental PIN"
        description="Enter your parental PIN to enable 18+ mature content and show the 18+ tab."
        confirmLabel="Enable 18+"
        verifyPin={(pin) => verifyParentalPin(user.uid, pin)}
        onCancel={() => {
          setPinModal(null);
          setMature(false);
          setMatureFlagClient(false);
        }}
        onSuccess={() => {
          setPinModal(null);
          setMature(true);
          persistMatureLocal(true);
          setMatureSessionUnlocked(true);
          setMessage(
            "18+ mature enabled. The 18+ tab is now available. Save settings to sync to your account.",
          );
        }}
      />

      <PinGateModal
        open={pinModal === "change"}
        mode="change"
        onCancel={() => setPinModal(null)}
        onChangePin={(current, next) => {
          if (!verifyParentalPin(user.uid, current)) return false;
          setParentalPin(user.uid, next);
          return true;
        }}
        onSuccess={() => {
          setPinModal(null);
          setMessage("Parental PIN updated.");
        }}
      />

      {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
      {message && (
        <p className="mt-4 text-sm text-[var(--success)]">{message}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            if (isFirebaseConfigured()) {
              await signOut(getClientAuth());
            }
          }}
        >
          Sign out
        </Button>
      </div>

      <section className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/notifications" className="text-[var(--primary-light)] underline">
          Notifications
        </Link>
        <Link href="/privacy" className="text-[var(--primary-light)] underline">
          Privacy
        </Link>
        <Link href="/legal" className="text-[var(--primary-light)] underline">
          Legal
        </Link>
        <Link href="/copyright" className="text-[var(--primary-light)] underline">
          Copyright
        </Link>
      </section>
    </div>
  );
}
