@echo off
git add src/app/globals.css src/app/login/page.tsx src/app/page.tsx git_push.bat
git commit -m "feat(web): add dark and light theme toggle button with persisted state"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
