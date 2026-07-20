import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from "firebase/storage";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from "firebase/analytics";
import {
  getMessaging,
  isSupported,
  type Messaging,
} from "firebase/messaging";

/**
 * CineVerse Firebase web config.
 * Prefer NEXT_PUBLIC_* env vars; falls back to the CineVerse production project.
 */
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyANhMe7aIvgYRZncHcmnpk9XtAzK-ECYCk",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "original-mesh-469112-t3.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "original-mesh-469112-t3",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "original-mesh-469112-t3.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1008051342049",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:1008051342049:web:877e39a22d994485fb85a0",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-TFGD999DY1",
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let messaging: Messaging | undefined;
let analytics: Analytics | undefined;
let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    maybeConnectEmulators();
  }
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    maybeConnectEmulators();
  }
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
    maybeConnectEmulators();
  }
  return storage;
}

export async function getClientAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  const ok = await isAnalyticsSupported();
  if (!ok) return null;
  if (!analytics) {
    analytics = getAnalytics(getFirebaseApp());
  }
  return analytics;
}

export async function getClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  if (!messaging) {
    messaging = getMessaging(getFirebaseApp());
  }
  return messaging;
}

function maybeConnectEmulators(): void {
  if (emulatorsConnected || typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") return;
  try {
    const a = getAuth(getFirebaseApp());
    const f = getFirestore(getFirebaseApp());
    const s = getStorage(getFirebaseApp());
    connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(f, "127.0.0.1", 8080);
    connectStorageEmulator(s, "127.0.0.1", 9199);
    emulatorsConnected = true;
  } catch {
    emulatorsConnected = true;
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}
