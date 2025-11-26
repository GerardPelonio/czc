# Firestore Setup and Emulator

This project expects Firestore connectivity for full features (like quiz persistence and student updates). If Firestore is not configured, the server runs in limited mode with an in-memory cache and a file fallback for quizzes.

## Options to provide Firestore credentials

Set one of the following environment configurations:

1. Service account JSON string (recommended for CI/local dev):

- Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the full service account JSON string (escaped), then start the server.

2. Explicit env variables (if you prefer):

- Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (with \n replaced as `\\n`). The server will use these to initialize firebase-admin.

3. Google ADC (Application Default Credentials):

- Set `GOOGLE_APPLICATION_CREDENTIALS` to a file path to a service account JSON file.

4. Use Firestore Emulator (recommended for offline dev/test):

- Install firebase tools: `npm i -g firebase-tools` or use `npx`.
- Start the emulator: `npx firebase emulators:start --only firestore`.
- Set `FIRESTORE_EMULATOR_HOST=localhost:8080` (port used by emulator)
- Optionally set `FIREBASE_PROJECT_ID` to a test project ID (e.g., `demo-project`).

## Minimal environment variables for emulator

- FIRESTORE_EMULATOR_HOST=localhost:8080
- FIREBASE_PROJECT_ID=demo-project

## Common error

- Error: "Unable to detect a Project Id in the current environment." — This happens when the SDK cannot find credentials. Use one of the credential options above to fix this. In local dev, running the emulator and setting `FIRESTORE_EMULATOR_HOST` is the easiest route.

## How to run in 'limited mode'

If no credentials are provided and `NODE_ENV` is not production, the server will run in limited mode (no Firestore) and will use an in-memory cache and a persistent `data/quiz-fallback.json` file for quizzes.

This is intended for local development and testing without a Firestore connection.

## Quick commands for PowerShell

Start the emulator and run the server in another terminal:

```powershell
npx firebase emulators:start --only firestore
```

Then set env vars and run the server in a separate shell:

```powershell
$env:FIRESTORE_EMULATOR_HOST = 'localhost:8080'
$env:FIREBASE_PROJECT_ID = 'demo-project'
npm run dev
```

Alternative (service account JSON stored as env var):

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content -Raw C:\path\to\serviceAccount.json
npm run dev
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to point to the service account file (preferred if you use ADC):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccount.json'
npm run dev
```
