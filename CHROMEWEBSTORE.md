# Chrome Web Store Metadata & Publishing Guide - DoKee

## Basic Information
- **Name:** DoKee - Anti-Distraction Keeper
- **Version:** 0.2.0
- **Category:** Productivity
- **Language:** English (United States)
- **Short Description:** Real-time self-productivity and anti-distraction enforcement synced with Cloud Firestore.

## Long Description
DoKee (Do + Keeper) is an intelligent anti-distraction system that holds you accountable to your daily schedule. 

### Key Features:
- **Real-Time Distraction Control:** Automatically blocks configured URLs (such as social media or video streaming) when you have overdue uncompleted tasks.
- **Reflection Pause Warning:** Displays a non-intrusive reflection banner reminding you of remaining tolerance minutes before hard penalty enforcement.
- **Black Screen of Death Penalty:** Completely locks access to distractor sites when your daily tolerance time expires until pending tasks are completed.
- **Instant Unblock Magic:** Centrally checking off a completed task in your DoKee Web App instantly unlocks distractor sites across all open tabs in real-time without needing page refreshes.
- **Emergency Waiting Room Protocol:** Strict 120-second focus countdown lock for emergency exceptions.

---

## Permissions Justification

| Permission | Reason for Use |
|------------|----------------|
| `storage` | Required to securely save local user state, authentication tokens, and cached tolerance limits across service worker restarts. |
| `tabs` | Required to monitor active web tab URLs, detect when a user enters/exits blocked domains, and compute actual time spent on distractors. |
| `scripting` | Required to inject reflection warning overlays and visual blocker scripts on active tabs. |
| `alarms` | Required to schedule periodic background sync with Cloud Firestore in Manifest V3 service workers. |
| `host_permissions: <all_urls>` | Required to evaluate user-configured blocked URLs across any domain specified in user settings. |

---

## Privacy & Data Use Disclosures
- **Single Purpose:** Anti-distraction enforcement and daily task management.
- **Data Collection:** Only user-configured blocked URLs, task titles, and daily tolerance durations are stored in your private Firebase Firestore instance.
- **Data Storage:** Data is stored locally in `chrome.storage.local` and in user's isolated Cloud Firestore collections protected by Firestore security rules. No data is sold or shared with third parties.

---

## Version History
- **v0.2.0 (2026-07-27):** MVP release with Firebase Auth, Cloud Firestore real-time `onSnapshot` sync, reflection warning banner, Black Screen of Death penalty overlay, and Waiting Room focus reset protocol.
