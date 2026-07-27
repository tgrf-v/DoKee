@echo off
git add src/components/Sidebar.tsx src/app/layout.tsx src/app/page.tsx src/app/settings/page.tsx git_push.bat
git commit -m "feat(ui): implement sidebar navigation and separate dedicated settings page"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
