@echo off
git add src/app/page.tsx src/components/Sidebar.tsx git_push.bat
git commit -m "revert(ui): restore previous dark glassmorphic UI layout with right panel widgets"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
