# Tools

This folder contains migration and maintenance scripts for the backend.

- `migrate-quizzes.js` — copies cached quizzes from `data/quiz-fallback.json` into Firestore collection `quizzes`.
- `migrate-quests.js` — copies quest definitions from `data/quest-progress.json` into Firestore collection `quests`. If run with arguments, e.g. `node migrate-quests.js chapter_completed`, it will create a default quest for the provided event types in Firestore.

Usage:

```bash
# migrate from fallback file
node tools/migrate-quests.js

# create default quests for an event type
node tools/migrate-quests.js chapter_completed
```

Note: Both scripts rely on `utils/getDb` to initialize Firestore. Ensure credentials or emulator are properly configured.

PowerShell examples to configure Firebase for the current shell session:

1) Using GOOGLE_APPLICATION_CREDENTIALS pointing to a service account file
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccount.json'
node Backend/tools/migrate-quests.js chapter_completed
```

2) Putting the service account JSON directly in env var (useful for CI):
```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = (Get-Content -Raw 'C:\path\to\serviceAccount.json')
node Backend/tools/migrate-quests.js chapter_completed
```

3) Explicit credentials (escape newlines in private key with \n):
```powershell
$env:FIREBASE_PROJECT_ID = 'your-project-id'
$env:FIREBASE_CLIENT_EMAIL = 'your-service-account@project.iam.gserviceaccount.com'
$env:FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
node Backend/tools/migrate-quests.js chapter_completed
```

4) Using Firestore emulator (install with `npm i -g firebase-tools` or run with `npx`):
```powershell
npx firebase emulators:start --only firestore --project demo-project
# in another shell (same session), set env vars and run migration
$env:FIRESTORE_EMULATOR_HOST = 'localhost:8080'
$env:FIREBASE_PROJECT_ID = 'demo-project'
node Backend/tools/migrate-quests.js chapter_completed
```

Seed predefined quest definitions:
```powershell
node Backend/tools/migrate-quests.js seed
```

This command will seed the Firestore `quests` collection with a set of commonly useful quests including 'Chapter Conqueror', 'Read 3 Chapters', 'Perfect Memory', 'Stories Explorer', and 'Genre Adventurer'.

Convert student quests stored as objects to arrays (useful when upgrading from old fallback schema):
```powershell
node Backend/tools/migrate-quests.js --convert-student-quests
```

If you'd like the tool to write to the local fallback file instead of failing, I can add an option (e.g., `--fallback`) to write default quests to `data/quest-progress.json` when Firestore is not available.
