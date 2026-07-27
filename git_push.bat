@echo off
git add .
git commit -m "style(ui): align right panel and center content height with sidebar for balanced layout"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
