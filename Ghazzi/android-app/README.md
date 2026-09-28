# Movies_Adda — Dual Compatible Android Mobile & Android TV (Google TV) APK Guide

Ye folder (`android-app`) Movies_Adda ka complete, production-ready Android Studio & Gradle project hai. Ye app **Android Mobile Phones**, **Tablets**, aur **Android TV / Google TV (32-inch+)** dono par smoothly chalne ke liye optimize kiya gaya hai.

---

## 📺 Android TV & Google TV (32-inch+) Remote Control Support

Aap is app ko kisi bhi **32-inch ya badi Google TV / Android TV** par install kar sakte hain aur **TV Remote se 100% control** kar sakte hain:

### 🎮 TV Remote Control Key Mapping

| Remote Button | Action in Movies_Adda |
| :--- | :--- |
| **D-Pad Up (⬆️)** | Agle upar wale section, category chip, ya player button par focus karega |
| **D-Pad Down (⬇️)** | Agle neeche wale movie row, card, ya episodes grid par smooth scroll karega |
| **D-Pad Left (⬅️)** | Row ke pichhle movie poster ya previous server button par jayega |
| **D-Pad Right (➡️)** | Row ke agle movie poster ya next server button par jayega |
| **OK / Center (🔘)** | Movie play karega, modal open karega, episode change karega |
| **Back Button (↩️)** | Detail modal band karega, player se home screen par aayega |
| **Play / Pause (⏯️)** | Video stream pause / play karega |

### 🌟 TV Specific Features Configured:
1. **Glowing Red 10-Foot Focus Ring**: Door baith kar TV remote se navigate karte waqt focused item ke chaaron taraf bright red glow (`#E50914`) aur 1.1x zoom-in effect dikhta hai.
2. **Leanback Home Screen Banner**: TV ke home screen apps row me 16:9 HD banner (`tv_banner.xml`) dikhega.
3. **Always Screen-On**: TV detection par `FLAG_KEEP_SCREEN_ON` activate ho jata hai, jisse movie chalte waqt TV screen dim ya sleep nahi hoti.
4. **Touchscreen Not Required**: `android.hardware.touchscreen` ko `required="false"` set kiya gaya hai taki TV devices is app ko bina kisi restriction ke install kar sakein.

---

## 📲 TV par APK Install (Sideload) Kaise Karein?

Apne 32-inch Android TV / Google TV par APK install karne ke 3 sabse aasan tarike:

### Option A: Pendrive / USB Drive se (Sabse Aasan)
1. Apne PC par build kiya hua `.apk` file ek USB Pendrive me copy karein.
2. Pendrive ko apne TV ke USB port me lagayein.
3. TV par **File Manager** (jaise *File Commander* ya *FX File Explorer*) open karein.
4. APK par click karke **Install** karein aur open karein!

### Option B: "Send Files to TV" App se (Bina Pendrive ke)
1. Apne Mobile aur Android TV dono par Play Store se **Send files to TV** app install karein.
2. Phone se APK select karein aur TV par send karein.
3. TV par File Manager se click karke install karein.

### Option C: Wireless ADB se
```bash
adb connect <TV_IP_ADDRESS>:5555
adb install app-debug.apk
```

---

## 🚀 2 Simple Ways to Build the APK

### Method 1: Android Studio (Sabse Aasan aur Recommended)
1. Apne PC par **Android Studio** open karein.
2. **File > Open** par click karein.
3. Is folder ko select karein:
   ```
   C:\Users\Dell\Desktop\Ghazzi\android-app
   ```
4. Android Studio project ko open karega aur Gradle sync automatically complete karega (takes ~30-60 seconds).
5. Top menu bar me jayein:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
6. Build complete hote hi bottom-right corner me notification aayega:
   > *"APK(s) generated successfully for 1 module: locate"*
7. **"locate"** button par click karein. Aapka APK file yahan ready milega:
   ```
   android-app\app\build\outputs\apk\debug\app-debug.apk
   ```
8. Is `.apk` file ko apne phone ya Android TV me transfer karein aur install karein!

---

### Method 2: Command Line (CMD / Terminal)
Agar aapke system par Gradle / Android SDK installed hai:
1. Terminal / Command Prompt open karein:
   ```bash
   cd C:\Users\Dell\Desktop\Ghazzi\android-app
   ```
2. Build command run karein:
   ```bash
   gradle assembleDebug
   # ya release ke liye:
   gradle assembleRelease
   ```
3. APK file output location:
   ```
   app\build\outputs\apk\debug\app-debug.apk
   ```

---

## 🔒 All Permissions Included (`AndroidManifest.xml`)
Aapke request ke mutabiq saari permissions configure ki gayi hain:

| Permission | Purpose |
| :--- | :--- |
| `android.permission.INTERNET` | High-speed video streaming & API calls |
| `android.permission.ACCESS_NETWORK_STATE` | Auto detect online / offline state |
| `android.permission.ACCESS_WIFI_STATE` | Wi-Fi streaming stability on TV & Mobile |
| `android.permission.WAKE_LOCK` | Movie dekhte waqt phone/TV screen off nahi hogi |
| `android.permission.MODIFY_AUDIO_SETTINGS` | Volume control & external speaker support |
| `android.permission.READ_MEDIA_VIDEO` | Android 13+ media access |
| `android.permission.READ_MEDIA_IMAGES` | Poster / media saving |
| `android.permission.READ_EXTERNAL_STORAGE` | Storage reading support |
| `android.permission.WRITE_EXTERNAL_STORAGE` | Downloads support |
| `android.permission.POST_NOTIFICATIONS` | Push notifications & playback status |
| `android.permission.FOREGROUND_SERVICE` | Background audio & streaming service |
| `android.permission.SYSTEM_ALERT_WINDOW` | Floating Video / Picture-in-Picture mode |
| `android.permission.VIBRATE` | Smooth haptic tap feedback on mobile |

---

## ⚡ Native APK Features Summary

1. **Dual Experience Detection**:
   - Phone par: Mobile bottom navigation bar + Touch swipe carousel + haptic feedback.
   - TV par: 10-foot spatial navigation + remote D-Pad focus rings + high visibility typography.

2. **Native True Fullscreen Video**:
   - `WebChromeClient` me `onShowCustomView()` implement kiya gaya hai.
   - Fullscreen button dabate hi video automatically landscape rotate hoti hai aur cinema view open hota hai.

3. **Picture-in-Picture (PiP)**:
   - Video play karte waqt Home button press karne par video floating window me chalti rahegi (Android 8.0+).

4. **100% Bundled Offline Assets (`assets/www/`)**:
   - Web application files (`index.html`, `player.html`, `manifest.json`) app ke andar bundled hain. App instant bina kisi hosting server ke fast launch hota hai.

5. **Hardware Acceleration & Mixed Content**:
   - `hardwareAccelerated="true"` aur `usesCleartextTraffic="true"` enabled hai jisse sabhi HTTP/HTTPS video sources smoothly 60fps par bina kisi security warning ke run hote hain.
