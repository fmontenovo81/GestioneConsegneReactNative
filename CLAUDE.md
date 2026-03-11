# CLAUDE.md — GestioneConsegneReactNative

App mobile **React Native + Expo** per i trasportatori. Specchio dell'app web GestioneConsegneVercel.
Backend condiviso: stesso server Next.js su Vercel/VPS.

---

## Stack

```
Expo SDK 54 + expo-router v6
React Native
SQLite (expo-sqlite) — offline-first locale
TanStack Query — cache + sync
expo-location — GPS tracking
react-native-signature-canvas — firma DDT e ricevute
react-native-webview — viewer PDF (PDF.js CDN su Android, file:// su iOS)
```

---

## Repository

- GitHub: `fmontenovo81/GestioneConsegneReactNative` (branch: main)
- Cartella locale: `C:\Progetti\Cica\GestioneConsegneReactNative`
- Backend: `fmontenovo81/GestioneConsegneVercel` (condiviso con web app)

---

## Struttura file chiave

```
app/
├── (auth)/login.tsx               # Login → router.replace('/(tabs)/consegne') dopo login
├── (tabs)/
│   ├── _layout.tsx                # TabsLayout + GpsTracker (attivo per tutti)
│   ├── consegne/
│   │   ├── index.tsx              # Lista consegne, filtro data, toggle consegnate
│   │   └── [id].tsx               # Dettaglio wizard: Documenti→Firma→Pagamento→Riepilogo
│   └── admin/index.tsx            # Back Office: Consegne/Utenti/Documenti tab (solo admin)
├── _layout.tsx                    # RootLayout: initDb + AuthGuard + QueryProvider
components/
├── consegne/
│   ├── ConsegnaCard.tsx
│   ├── FirmaDigitale.tsx          # onLayout fix: SignatureCanvas renderizzato solo con dimensioni reali
│   ├── FormPagamento.tsx          # onLayout fix: idem
│   ├── VisualizzaDDT.tsx          # PDF.js CDN (Android) / file:// (iOS), dpr=3 per qualità
│   └── PagamentiConsegna.tsx
└── sync/SyncIndicator.tsx
hooks/
├── useAuth.ts
├── useGps.ts                      # expo-location, POST /posizioni ogni 5 min, coda SQLite offline
└── useOnlineStatus.ts
lib/
├── api/
│   ├── consegne.ts                # useConsegne, useConsegnaDetail, useUpdateConsegna
│   └── pagamenti.ts
├── auth/apiClient.ts              # apiFetch con silent refresh 401
├── db/sqlite.ts                   # SQLite: consegne, pagamenti, coda_gps, sessione
└── sync/syncManager.ts            # runSync(): consegne→pagamenti→GPS batch
providers/QueryProvider.tsx        # NetInfo + AppState → runSync() automatico
contexts/AuthContext.tsx
```

---

## Pattern chiave

### Offline-First (SQLite)
- Write-Through: scrivi SQLite prima, poi server se online
- `statoSincronizzazione: false` = offline pending, da sincronizzare
- `statoSincronizzazione: true` = sincronizzato, il server è fonte di verità
- `runSync()` triggerato da: NetInfo (rientro online) + AppState (app in foreground)
- Dopo batch sync OK → marca record come `statoSincronizzazione: true` in SQLite

### Sync consegne
- La lista GET `/consegne` NON restituisce campi binari (`ddtPdf`, `firmaDigitale`, `ddtFirmato`)
- I campi binari vengono da `useConsegnaDetail` → GET `/consegne/:id`
- Il batch sync (`/consegne/sync/batch`) esclude i campi binari dal payload (troppo grandi)
- I campi binari vengono preservati in SQLite ad ogni sync della lista

### PDF viewer (VisualizzaDDT)
- Android: PDF.js v3.11 via CDN, base64 incorporato come variabile JS nell'HTML (`source={{ html }}`)
  - NO fetch() locale — fallisce su Android WebView
  - `devicePixelRatio` forzato a `Math.max(dpr, 3)` per qualità nitida
- iOS: WebView con `source={{ uri: file:// }}` — rendering nativo
- Il DDT firmato viene generato server-side via `/consegne/:id/ddt-firmato` (pdf-lib)

### SignatureCanvas fix
- `react-native-signature-canvas` usa un WebView interno
- Su primo render in tab non ancora visitato → WebView riceve width=0 → non risponde ai tocchi
- Fix: renderizza `<SignatureCanvas>` solo dopo `onLayout` del container padre (`padWidth > 0`)
- Applicato in: `FirmaDigitale.tsx` e `FormPagamento.tsx`

### GPS tracking
- `hooks/useGps.ts`: permesso richiesto una volta sola, timeout GPS 15s, AppState per invio immediato al foreground
- Online: POST `/posizioni` diretto
- Offline: INSERT in `coda_gps` SQLite → flush via `/posizioni/batch` al prossimo runSync()
- Attivato in `(tabs)/_layout.tsx` tramite componente `GpsTracker`

### useUpdateConsegna
- Richiede `idTrasportatore` nel payload per invalidare `consegneKeys.byTrasportatore` in `onSettled`
- Salva subito in SQLite con `statoSincronizzazione: false`
- Se online + id server: PUT `/consegne/:id` → se OK marca `statoSincronizzazione: true`
- Se la PUT fallisce: resta `statoSincronizzazione: false` → `runSync()` riproverà automaticamente

### Back Office admin (`app/(tabs)/admin/index.tsx`)
- Visibile solo agli admin; tab bar nascosta per i trasportatori (`tabBarStyle: { display: 'none' }`)
- **Tab Consegne**: stats chip (cliccabili = filtro stato), DateNavigator (default oggi), ricerca, CRUD consegne, manutenzione DB (cleanup)
- **Tab Utenti**: lista utenti, crea/modifica/elimina, toggle attivo, cambio password opzionale
- **Tab Documenti**: DateNavigator + filtro trasportatore (chip orizzontali), share DDT firmato via `expo-sharing`
- DateNavigator: frecce < > per giorno precedente/successivo; tap sulla data → reset a oggi
- Download DDT: `expo-file-system/legacy` → scrive in `cacheDirectory`, poi `expo-sharing` per condividerlo

### EAS Build — dipendenze native (aggiornate 2026-03-11)
- `react-native-reanimated`: aggiornato a `^4.2.2` (3.x incompatibile con RN 0.81 — ShadowNode C++ deprecation)
- `react-native-worklets: ^0.7.4` — peer dependency richiesta da reanimated 4, va installata separatamente
- `.npmrc`: `legacy-peer-deps=true` — obbligatorio per EAS Build

---

## Funzionalità implementate

| Feature | Stato |
|---------|-------|
| Login / auth / refresh token | ✅ |
| Lista consegne + filtro data | ✅ |
| Toggle mostra/nascondi consegnate | ✅ |
| Dettaglio wizard (4 tab) | ✅ |
| DDT viewer embedded (firmato + non firmato) | ✅ |
| Firma DDT (SignatureCanvas) | ✅ |
| Pagamento (form + firma ricevuta) | ✅ |
| Sync offline/online bidirezionale | ✅ |
| GPS tracking ogni 5 min | ✅ |
| Bottone reinvia email (tab Riepilogo) | ✅ |
| Modifica email cliente inline (tab Riepilogo) | ✅ |
| Back Office admin (Consegne/Utenti/Documenti) | ✅ |
| Pagamento NFC carta (Nexi SoftPOS / Stripe Terminal) | ❌ decisione pendente |

---

## Pagamento NFC — decisione pendente

Il trasportatore usa attualmente il POS fisico separato. Opzioni discusse:

- **Nexi SoftPOS**: provider italiano, probabilmente già contratto bancario. Solo Android. Nessun SDK React Native ufficiale → richiede bridge nativo. Documentazione non pubblica (richiesta a Nexi).
- **Stripe Terminal**: SDK React Native ufficiale, supporta Tap to Pay su Android e Apple Tap to Pay su iOS 16+. Commissioni ~1.5% + 0.25€/transazione.
- **Conferma manuale**: metodo attuale, zero sviluppo.

Da chiarire: i tablet sono solo Android o anche iPad? Questo determina quale provider è fattibile.

---

## Comandi

```bash
npx expo start           # Dev server Expo (Expo Go)
npx expo start --tunnel  # Con tunnel (per test su dispositivo fisico)
eas build --platform android --profile preview     # APK per installazione diretta
eas build --platform android --profile production  # AAB per Google Play
eas update --branch production --message "desc"    # Aggiornamento OTA (solo JS, no nativi)
```

---

## Deploy

### Account EAS
- Owner: `entersrl`
- Project ID: `98d78e0d-d5dd-49f2-81eb-8fafa4628145`
- Package Android: `it.entersrl.gestioneconsegne`
- Bundle iOS: `it.entersrl.gestioneconsegne`

### Profili EAS (`eas.json`)
| Profilo | Output | Uso |
|---------|--------|-----|
| `preview` | APK | Installazione diretta sui tablet (sideload) |
| `production` | AAB | Google Play Store |
| `development` | APK + dev client | Debug con expo-dev-client |

### Procedura build APK (prima volta)
```bash
npm install -g eas-cli
eas login                         # login account Expo/entersrl
eas build --platform android --profile preview
# EAS compila in cloud (~10-15 min) → link download APK
# Installa sui tablet via USB o condividendo il link
```

### Aggiornamenti
| Tipo modifica | Comando |
|---|---|
| Solo codice TypeScript/React | `eas update --branch production --message "..."` |
| Nuovi plugin/permessi in `app.json` | `eas build --platform android --profile preview` |
| Nuove dipendenze native | `eas build --platform android --profile preview` |

### Permessi Android configurati
- `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` — GPS tracking
- `INTERNET` — connessione API
- `NFC` — predisposto per futuro pagamento NFC

---

## Regole sviluppo

1. Usare sempre `apiFetch` (da `lib/auth/apiClient.ts`) — non `fetch` diretto
2. Import `expo-file-system` → usare `/legacy` path: `import * as FileSystem from 'expo-file-system/legacy'`
3. `expo-sharing` accetta solo URI `file://` — non passare URI `content://`
4. Nuovi pacchetti: `npm install --legacy-peer-deps`
5. Pushai su GitHub dopo ogni feature: `git push origin main`
