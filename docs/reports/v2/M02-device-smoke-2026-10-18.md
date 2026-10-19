# M02 — Android Device Smoke (read-only evidence)

Date: 2026-10-18
Repo: `D:/Coding/BrainIA/BrainIA-Mobile`
Scope: read-only device evidence collection. No app source/config changed, no commit.
Artifacts: `docs/reports/v2/device-evidence/launch-2026-10-18.png`, `docs/reports/v2/device-evidence/post-launch-60s-2026-10-18.png`

## Result summary

- `adb install -r` → **Success**
- Launch via monkey → **Success**, focused activity `com.brainia.mobile/.MainActivity`, process stayed alive across the capture window (pid 10245)
- Crash: **none**. No `FATAL EXCEPTION`, no `AndroidRuntime`, no ANR, no app-origin `E/` lines in the 30 s logcat window
- Screenshot: `docs/reports/v2/device-evidence/launch-2026-10-18.png` (1280x2772, 286,861 bytes, SHA-256 `F468400055519E089A52AF19A31081DD03ED2D74EC28A241AA5FB19A54616B06`)
- Runtime state observed: home screen rendered, but the "perspective" card is in an error state (`No pudimos actualizar tu perspectiva.` / `Reintentar`), consistent with a backend request timeout logged during launch
- Notification listener: **enabled and connected** (`listener_connected`), capture forwarding attempted, HTTP send to backend **timed out**

## 1. Device identity

```
$ adb devices -l
List of devices attached
SSU8MVXS65BED64L       device product:goya_global model:25069PTEBG device:goya transport_id:2
```

```
$ adb shell "getprop ro.product.manufacturer; getprop ro.product.model; getprop ro.product.device;
            getprop ro.build.version.release; getprop ro.build.version.sdk; getprop ro.build.fingerprint;
            getprop ro.build.version.security_patch; getprop ro.build.type; getprop ro.debuggable"
Xiaomi
25069PTEBG
goya
16
36
Xiaomi/goya_global/goya:16/BP2A.250605.031.A3/OS3.0.302.0.WOEMIXM:user/release-keys
2026-08-01
user
0
```

| Field | Value |
| --- | --- |
| Serial | SSU8MVXS65BED64L |
| Manufacturer / model | Xiaomi / 25069PTEBG (goya, Xiaomi 15T) |
| Android release | **16** (not 15 as stated in the task brief) |
| API level | **36** |
| Build fingerprint | `Xiaomi/goya_global/goya:16/BP2A.250605.031.A3/OS3.0.302.0.WOEMIXM:user/release-keys` |
| Security patch | 2026-08-01 |
| Build type / debuggable | `user` / `ro.debuggable=0` |

Storage:

```
$ adb shell "df -h /data"
Filesystem       Size Used Avail Use% Mounted on
/dev/block/dm-67 479G 114G  365G  24% /data/user/0
```

365 GB free — not a constraint for a 51 MB APK install.

Multi-user note: user 0 (`Germán Lamela`, running) plus user 10 (Work profile). `am get-current-user` = 0. Shell calls that target user 10 fail with `SecurityException: Shell does not have permission to access user 10`; the app is installed only for user 0.

## 2. APK identity, hash, signing

Local artifact:

```
Path      : D:\Coding\BrainIA\BrainIA-Mobile\android\app\build\outputs\apk\release\app-release.apk
Length    : 51196192
LastWrite : 2026-10-03 20:57:12 (-03)
SHA-256   : 1B6D65B83F1768FF6CB1601EBC06531B7B10F5989AF13F6EA2BC2B083FDDE9A6
```

`android/app/build/outputs/apk/release/output-metadata.json` and `aapt2 dump badging` agree:

```
package: name='com.brainia.mobile' versionCode='8' versionName='1.0.7'
compileSdkVersion='36' compileSdkVersionCodename='16'
minSdkVersion:'24'
targetSdkVersion:'36'
application-label:'BrainIA Mobile'
```

Signing certificate (from the APK, local read-only):

```
$ apksigner verify --print-certs app-release.apk
Signer #1 certificate DN: CN=BrainIA Mobile, OU=Mobile, O=BrainIA, L=Montevideo, ST=Montevideo, C=UY
Signer #1 certificate SHA-256 digest: 54e983732909a3b27138569437fa19240bb7302fd815a3c774e3854a87e65739
Signer #1 certificate SHA-1 digest:   52eb5cb625bf371e9e76244e7bbf4b48654ec1cf
Signer #1 certificate MD5 digest:     1581f8b4e227b372e82771304300c14f
```

On-device package state **before** reinstall (package was already present from an earlier 2026-10-03 install):

```
$ adb shell dumpsys package com.brainia.mobile
versionCode=8 minSdk=24 targetSdk=36
versionName=1.0.7
codePath=/data/app/~~RicJnpP_t1hwGV9dKiYY5w==/com.brainia.mobile-oAdLvVhjlHlxfXkDvCgkmg==
installerPackageName=com.google.android.packageinstaller
signatures=PackageSignatures{a3631ad version:2, signatures:[a7a9c89a], past signatures:[]}
lastUpdateTime=2026-10-03 21:05:30
firstInstallTime=2026-07-22 16:08:13
User 0: installed=true
```

### APK / source mismatch (important)

- APK build timestamp: **2026-10-03 20:57 (-03)**
- HEAD commit `def7501`: **2026-10-18 21:46 (-03)** — commit `def7501c302b103cc85c215c542964aa7904e04a`, `chore: re-import resealed approved contract (da2a989f)`

The APK **predates `def7501` by 15 days**. Nothing in this report validates current `main`. It validates `versionCode 8 / 1.0.7` as of 2026-10-03.

## 3. Install

```
$ adb install -r android/app/build/outputs/apk/release/app-release.apk
Performing Streamed Install
Success
```

Post-install verification:

```
$ adb shell dumpsys package com.brainia.mobile | grep versionCode
    versionCode=8 minSdk=24 targetSdk=36
$ adb shell dumpsys package com.brainia.mobile | grep versionName
    versionName=1.0.7
```

`-r` performed an in-place upgrade over the same version/signature; signing continuity was not explicitly tested with a mismatched key.

## 4. Launch and focused activity

```
$ adb logcat -c
$ adb shell monkey -p com.brainia.mobile -c android.intent.category.LAUNCHER 1
Events injected: 1
$ adb shell dumpsys activity activities | grep -E "topResumedActivity|mFocusedApp"
topResumedActivity=ActivityRecord{212107926 u0 com.brainia.mobile/.MainActivity t30154}
  mFocusedApp=ActivityRecord{212107926 u0 com.brainia.mobile/.MainActivity t30154}
```

Still foreground and alive ~60 s later:

```
$ adb shell pidof com.brainia.mobile
10245
$ adb shell dumpsys activity activities | grep topResumedActivity
topResumedActivity=ActivityRecord{212107926 u0 com.brainia.mobile/.MainActivity t30154}
```

Screenshots (captured with byte-safe redirection — see note below):

```
$ cmd /c "adb exec-out screencap -p > docs\reports\v2\device-evidence\launch-2026-10-18.png"
$ cmd /c "adb exec-out screencap -p > docs\reports\v2\device-evidence\post-launch-60s-2026-10-18.png"
```

| File | Size | Dimensions | SHA-256 |
| --- | --- | --- | --- |
| `device-evidence/launch-2026-10-18.png` | 286,861 B | 1280 x 2772 | `F468400055519E089A52AF19A31081DD03ED2D74EC28A241AA5FB19A54616B06` |
| `device-evidence/post-launch-60s-2026-10-18.png` | 286,861 B | 1280 x 2772 | `F468400055519E089A52AF19A31081DD03ED2D74EC28A241AA5FB19A54616B06` |

Both captures are byte-identical, i.e. the UI was pixel-stable across the 60 s window (no spinner, no transition, no partial render).

> Capture gotcha for future runs: PowerShell `adb exec-out screencap -p > file` writes UTF-16 text and produces a corrupt 600 KB file whose first bytes are `FF FE`. First attempt did exactly that and was discarded; the retained files are real PNGs (`89 50 4E 47 0D 0A 1A 0A`). Use `cmd /c` redirection or a byte stream.

Screen geometry: `wm size` 1280x2772, `wm density` 520.

UI hierarchy at capture time (`uiautomator dump`, text nodes only):

```
BRAIN IA / PERSONAL
Tu día, en perspectiva
En vivo
Lo importante de tu conocimiento, tu dinero y tus decisiones.
Tu perspectiva, más clara
Preguntar a Brain IA
No pudimos actualizar tu perspectiva.
Reintentar
Lo más importante
Lo que merece tu atención.
Unresolved
31 decisiones de datos necesitan revisión
Ver detalle
UYU expenses doubled week over week
```

So: shell renders, Spanish copy is in place, but the dashboard is in its **error/retry state**, matching the network timeout below.

## 5. Logcat, 30 s window after launch

Command used (PID-bound, 30 s wall clock):

```
$ adb logcat --pid=10245 -v time   # attached ~10 s after launch, sampled for 30 s
```

459 lines captured. Classification:

| Category | Count / finding |
| --- | --- |
| `FATAL EXCEPTION` | 0 |
| `AndroidRuntime` crash | 0 |
| ANR | 0 |
| App-origin `E/` lines | 0 (all `E/` lines are Xiaomi/MTK platform: `MiuiPreloadClassImpl`, `TurboSchedMonitor`, `MI-PreRender`, `ashmem`, `Zygote`, perfctl) |
| Warnings from app code | 2 (see below) |

Notable app-tagged events:

```
I/BrainIANotificationBridge: configuration_updated: Notification bridge configuration was refreshed
W/BrainIANotificationBridge: rebind_cycle_requested: Cycling Android notification-listener binding
I/BrainIANotificationBridge: reconnect_worker_started: Background listener health check started
I/BrainIANotificationBridge: service_created: Android created the notification listener service
I/BrainIANotificationBridge: listener_connected: Notification listener connected successfully
I/BrainIANotificationBridge: reconciliation_started: Reading Android active notifications
I/BrainIANotificationBridge: capture_forward_started: Forwarding a notification capture
W/BrainIANotificationBridge: Unable to reconcile one active notification
W/BrainIANotificationBridge: java.net.SocketTimeoutException: timeout  (Caused by: java.net.SocketException: Socket closed)
    at com.brainia.mobile.notification.NotificationBridgeService.sendCapture(NotificationBridgeService.kt:278)
    at com.brainia.mobile.notification.NotificationBridgeService.reconcileActiveNotifications$lambda$16$lambda$15(NotificationBridgeService.kt:157)
```

WorkManager:

```
D/WM-GreedyScheduler: Starting work for bfc8bed6-3d65-4f3c-858e-50671bd10dfa
D/WM-WorkerWrapper: Starting work for com.brainia.mobile.notification.NotificationReconciliationWorker
D/WM-Processor: Processor cancelling bfc8bed6-3d65-4f3c-858e-50671bd10dfa
I/WM-WorkerWrapper: Work [...] was cancelled
I/WM-WorkerWrapper: androidx.work.impl.WorkerStoppedException
```

The worker cancellation is the normal WorkManager stop path for a job replaced by the foreground start (`Cancelling work ID ...` immediately precedes `Scheduling work ID ...`), not a crash.

Connectivity at the time was healthy: WiFi `Zotea Music` VALIDATED (`192.168.0.37/24`, RSSI -55) plus validated LTE. So the `SocketTimeoutException` is a request-level failure (endpoint/host/timeout), not a missing network. This is logged evidence only — root cause not investigated here (read-only scope).

No personal data is reproduced in this report: only class names, log tags, and stack frames.

## 6. Notification-listener permission and SecureStore/Keystore

### Notification listener — ENABLED

```
$ adb shell settings get secure enabled_notification_listeners
com.xiaomi.barrage/...:...:com.brainia.mobile/com.brainia.mobile.notification.NotificationBridgeService:...

$ adb shell dumpsys notification --noredact
Allowed notification listeners: ... com.brainia.mobile/com.brainia.mobile.notification.NotificationBridgeService ...
All notification listeners (5) enabled for current profiles:
    ComponentInfo{com.brainia.mobile/com.brainia.mobile.notification.NotificationBridgeService}
```

User-set grant exists (`Has user set: userId=0 value={... NotificationBridgeService ...}`), and the live service bound successfully (`listener_connected`, `service_created`). So the grant is real, not just present in settings.

Two related gaps worth flagging:

1. `POST_NOTIFICATIONS` is **not declared** in the release manifest (`aapt2 dump badging` permission list: INTERNET, RECORD_AUDIO, QUERY_ALL_PACKAGES, READ/WRITE_EXTERNAL_STORAGE (maxSdk 32), SYSTEM_ALERT_WINDOW, VIBRATE, WAKE_LOCK, ACCESS_NETWORK_STATE, RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE, USE_BIOMETRIC, USE_FINGERPRINT, DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION). On API 33+ the app therefore cannot post its own notifications unless this is added later; `appops` currently reports `POST_NOTIFICATION: ignore`.
2. Android's sensitive-notification gate is closed for this listener:
   ```
   $ adb shell cmd appops get com.brainia.mobile RECEIVE_SENSITIVE_NOTIFICATIONS
   RECEIVE_SENSITIVE_NOTIFICATIONS: ignore; rejectTime=+1m39s971ms ago
   ```
   `RECEIVE_SENSITIVE_NOTIFICATIONS` is also not declared in the manifest. On Android 15/16 this means notifications classified as sensitive (OTP, banking) are withheld from the listener. For a finance-capture product this is a material functional gap — recorded as observation, not diagnosed here.

### SecureStore / Keystore — BLOCKED (no app-level probe possible)

- Release build is not debuggable:
  ```
  $ adb shell run-as com.brainia.mobile ls
  run-as: package not debuggable: com.brainia.mobile
  ```
- Shell is unprivileged and the device is not rooted:
  ```
  $ adb shell id
  uid=2000(shell) gid=2000(shell) ... context=u:r:shell:s0
  ```
- No Keystore/SecureStore log lines appear in the 30 s window (no Tink/`AndroidKeyStore`/`Cipher` tags), and there is no adb surface that can exercise `expo-secure-store` without either a debug build or app code changes — both out of scope.

No token, credential, or app-private storage content was read, and none was attempted.

## 7. What this evidence proves — and what it does not

**Proves**

- The 2026-10-03 release APK (`versionCode 8 / 1.0.7`, SHA-256 `1B6D65B8…DE9A6`, signed by `CN=BrainIA Mobile`) installs via `adb install -r` on a **Xiaomi 25069PTEBG, Android 16 / API 36, targetSdk 36, minSdk 24** device.
- It launches to `com.brainia.mobile/.MainActivity`, stays resumed, renders the Spanish home screen, and does not crash within the first ~60 s.
- The notification-listener path is granted at the OS level and the service binds; the capture code actually reaches the network layer.
- On this device, at this moment, the app is functional but in a degraded state: perspective fetch fails with a request timeout while connectivity is validated.

**Does not prove**

- **Capture flow end-to-end**: a capture was *forwarded* and then timed out (`sendCapture`, `NotificationBridgeService.kt:278`); no capture is shown to reach the backend or be acknowledged. Sensitive-notification delivery is blocked anyway (appop `ignore`).
- **Queue durability / offline replay**: no evidence that the timed-out capture was persisted, retried, or deduplicated. `NotificationReconciliationWorker` was cancelled in the same window; its retry semantics were not exercised.
- **SecureStore/Keystore custody**: not probed at all (see §6). Token encryption, key invalidation on lock-screen change, and biometric gating are unverified.
- **Signing custody**: only that the APK verifies against the embedded cert. Key ownership, HSM/Play App Signing arrangement, and rotation policy are out of scope.
- **Play distribution**: sideload-only install through `com.google.android.packageinstaller`; no Play upload, review, or delivery path was tested.
- **Current source tree**: the APK predates `def7501` by 15 days (§2). Any commit on or after 2026-10-03 is unvalidated on this device.
- **Other form factors**: one device, one OEM skin (HyperOS 3.0), one Android version. No Android 15, no other OEM, no tablet, no work-profile (user 10) install.

## 8. Blocked / not attempted

| Item | Status | Reason |
| --- | --- | --- |
| SecureStore / Keystore functional probe | **Blocked** | release build not debuggable (`run-as` denied), shell uid 2000, device not rooted, no code changes permitted |
| Reading persisted queue / DB state | **Blocked** | same — app-private storage inaccessible, and reading it would risk token exposure |
| Notification capture reaching backend | **Failed at runtime** | `SocketTimeoutException` on `sendCapture`; endpoint/root cause out of scope |
| Sensitive notification capture | **Blocked by OS** | `RECEIVE_SENSITIVE_NOTIFICATIONS: ignore`, permission not declared |
| Android 15 validation | **Not done** | the connected device runs Android **16** (API 36), not 15 |
| Work-profile (user 10) behavior | **Not possible** | app not installed for user 10; shell lacks cross-user access |
| Play distribution / signing custody | **Out of scope** | no Play credentials or signing infrastructure in this task |

## 9. Reproduction commands (condensed)

```powershell
$adb = "C:\Users\germa\AppData\Local\Android\Sdk\platform-tools\adb.exe"

& $adb devices -l
& $adb shell "getprop ro.build.version.release; getprop ro.build.version.sdk; getprop ro.build.fingerprint"
& $adb shell "df -h /data"

Get-FileHash android\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
& "C:\Users\germa\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat" verify --print-certs android\app\build\outputs\apk\release\app-release.apk

& $adb install -r android\app\build\outputs\apk\release\app-release.apk
& $adb logcat -c
& $adb shell monkey -p com.brainia.mobile -c android.intent.category.LAUNCHER 1
& $adb shell dumpsys activity activities | Select-String "topResumedActivity"

# byte-safe screenshot
cmd /c "`"$adb`" exec-out screencap -p > docs\reports\v2\device-evidence\launch-2026-10-18.png"

# 30 s app-scoped logcat
$p = Start-Process $adb -ArgumentList 'logcat','--pid=<pid>','-v','time' -RedirectStandardOutput "$env:TEMP\brainia-logcat.txt" -PassThru -NoNewWindow
Start-Sleep 30; Stop-Process -Id $p.Id -Force

& $adb shell settings get secure enabled_notification_listeners
& $adb shell cmd appops get com.brainia.mobile
& $adb shell cmd appops get com.brainia.mobile RECEIVE_SENSITIVE_NOTIFICATIONS
& $adb shell run-as com.brainia.mobile ls
```
