# Firebase setup guide

## 1. Create project

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Create project `cineverse-prod` (and optional `cineverse-dev`)
3. Enable **Google Analytics** if desired

## 2. Authentication

Enable providers:

- Email/Password
- Google
- Email link (passwordless)

Authorized domains: your production domain + `localhost`.

## 3. Firestore

1. Create database in production mode
2. Deploy rules: `firebase deploy --only firestore:rules`
3. Deploy indexes: `firebase deploy --only firestore:indexes`

Collections are created on first write (see schema in README).

## 4. Storage

1. Enable Storage
2. Deploy: `firebase deploy --only storage`

## 5. App Check

1. Register web app with reCAPTCHA v3 or Enterprise
2. Enforce App Check on Firestore, Storage, and Functions in production

## 6. Admin SDK

Create a service account with Firebase Admin privileges.

Set env:

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=
```

**Never** put these in `NEXT_PUBLIC_*` variables.

## 7. Custom claims (admin)

```js
// Node script with Admin SDK
await admin.auth().setCustomUserClaims(uid, { admin: true });
```

Users cannot set `admin` via client writes (rules + claim verification).

## 8. Emulators

```bash
firebase emulators:start
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`.

## 9. Remote Config & FCM

- Remote Config: feature flags (`maintenance_mode`, `hero_3d_enabled`)
- Cloud Messaging: store device tokens in `userDevices`
