@echo off
git add .
git commit -m "style(ui): set background to pure white and remove status alert banner"
git remote add origin https://github.com/tgrf-v/DoKee.git 2>nul || git remote set-url origin https://github.com/tgrf-v/DoKee.git
git branch -M main
git push -u origin main
