@echo off
git add src/app/page.tsx git_push.bat
git commit -m "refactor(ui): streamline navbar profile dropdown, preset tolerance buttons, and remove redundant AI text"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
