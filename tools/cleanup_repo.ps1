Write-Host "This script helps cleanup tracked secrets and local folders that should not be committed."
Write-Host "Please ensure you have backed up any files you need before running this script."

Write-Host "Removing Backend/.vercel from git tracking and deleting local cached env files (if present)"
git rm -r --cached Backend/.vercel -f 2>$null
git rm --cached Backend/.env -f 2>$null

Write-Host "Removing root package-lock and node_modules from git tracking (not deleting local files)"
git rm --cached package-lock.json -f 2>$null
git rm -r --cached node_modules -f 2>$null

Write-Host "Adding .gitignore changes (already added). Commit and push after verifying the files removed from tracking."
Write-Host "Recommended: rotate credentials if secrets were exposed."
