# 🎬 Movies_Adda — Unlimited Movies, Web Series & TV Streaming

<p align="center">
  <img src="https://img.icons8.com/color/144/netflix--v1.png" alt="Movies_Adda Logo" width="96"/>
  <br>
  <b>Watch Thousands of Movies, TV Shows, and Anime in Full HD (1080p/4K) with Multi-Server Streaming</b>
  <br>
  <i>Optimized for Android Mobile, Tablets, and 32-inch+ Android TV / Google TV (Remote Control Supported)</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Android%20%7C%20Android%20TV-E50914?style=for-the-badge&logo=android" alt="Platform Badge"/>
  <img src="https://img.shields.io/badge/Build-GitHub%20Actions%20CI-green?style=for-the-badge&logo=githubactions" alt="CI Badge"/>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"/>
</p>

---

## ⚡ Quick Start: Download the Android APK

Aapko apne computer par kisi software ko install karne ki zaroorat nahi hai! GitHub Actions automatically har push par APK compile karta hai:

1. Is repository ke **[Actions](https://github.com/mypresonal65-star/Movies-Addaa/actions)** tab me jayein.
2. Sabse latest workflow run (**"Build Movies_Adda APK"**) par click karein.
3. Neeche **Artifacts** section me **`Movies_Adda-Debug-APK`** file par click karke direct `.apk` download karein!
4. Apne Phone ya Android TV par install karein aur enjoy karein!

---

## 📺 Android TV & Google TV (32-inch+) Remote Control Support

Yeh application Android TV ke 10-foot experience ke liye specially tuned hai:

| Remote Button | Function |
| :--- | :--- |
| **D-Pad Up (⬆️)** | Next upper section / Server tabs focus |
| **D-Pad Down (⬇️)** | Next movie row / Episodes grid focus |
| **D-Pad Left (⬅️)** | Previous movie poster / Prev server |
| **D-Pad Right (➡️)** | Next movie poster / Next server |
| **OK / Center (🔘)** | Movie play / Details open / Episode select |
| **Back Button (↩️)** | Close modal / Return to home screen |
| **Play / Pause (⏯️)** | Pause or play current stream |

### 🌟 TV Highlights:
- **Glowing Red Focus Ring**: TV screen par door baith kar remote chalate waqt active element par Netflix-style red glow (`#E50914`) aur 1.1x zoom animation.
- **Screen Keep-On**: Video dekhte waqt TV screen band ya dim nahi hogi.
- **Leanback Launcher**: TV ke home screen apps shelf par 16:9 HD banner (`tv_banner.xml`) dikhega.

---

## 🚀 Features & Capabilities

- 🎥 **4 High-Speed Streaming Servers**: Videasy, Vidsrc, SuperEmbed, 2Embed
- 📺 **TV Series & Seasons Browser**: Automatic season selector, episode thumbnails, descriptions, and runtimes
- 🍿 **Curated Categorization**: Trending Movies, TV Series, Top Rated, Action, Romance, Sci-Fi, Anime, Comedy, and Horror
- 🔍 **Instant Search**: Real-time debounce search with full poster grid
- 🌘 **Cinema Lights-Off Mode**: Theater dimming experience on the player
- 📲 **PWA & Native APK Ready**: Works on Chrome/Safari/Edge and compiles directly into a standalone Android APK

---

## 📂 Repository Structure

```
├── .github/
│   └── workflows/
│       └── build-apk.yml       <-- GitHub Actions automated APK compilation
├── android-app/                <-- Full Android Studio native project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/moviesadda/ott/MainActivity.java
│   │   │   ├── assets/www/     <-- Bundled offline web app
│   │   │   └── res/            <-- Layouts, icons, TV banners, styles
│   │   └── build.gradle
│   ├── build.gradle
│   ├── settings.gradle
│   └── build-apk.bat
├── index.html                  <-- Main OTT interface
├── player.html                 <-- Video player & TV shows engine
├── manifest.json               <-- PWA Manifest
└── PUBLISH_TO_GITHUB.bat       <-- 1-click Git publisher
```

---

## 🛠️ Local APK Build (Optional)

Agar aap Android Studio me manually build karna chahte hain:
1. Android Studio open karein aur `android-app` folder select karein.
2. **Build > Build Bundle(s) / APK(s) > Build APK(s)** par click karein.
3. Output APK: `android-app/app/build/outputs/apk/debug/app-debug.apk`

---

<p align="center">
  <b>Created with ❤️ for Movies_Adda</b>
</p>
