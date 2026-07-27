@echo off
git add .
git commit -m "style(ui): permanently switch to light theme and remove dark theme toggles"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
