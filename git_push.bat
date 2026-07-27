@echo off
git add src/lib/firebase.ts src/app/page.tsx git_push.bat
git commit -m "feat(ui): add right utility panel with task inspector, subtasks, deadline selector, stats & extension card"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
