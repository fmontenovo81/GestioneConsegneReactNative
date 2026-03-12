import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, SafeAreaView, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import WebView from 'react-native-webview';
import { FileText, Maximize2, X, CheckCircle2, Clock, WifiOff } from 'lucide-react-native';

// ─── PDF.js cache (Android) ───────────────────────────────────────────────────
const PDFJS_CACHE_DIR  = `${FileSystem.cacheDirectory}pdfjs/`;
const PDFJS_MAIN       = `${PDFJS_CACHE_DIR}pdf.min.js`;
const PDFJS_WORKER     = `${PDFJS_CACHE_DIR}pdf.worker.min.js`;
const PDFJS_VERSION    = '3.11.174';
const PDFJS_CDN        = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

async function ensurePdfJsCached(): Promise<boolean> {
  try {
    const [mainInfo, workerInfo] = await Promise.all([
      FileSystem.getInfoAsync(PDFJS_MAIN),
      FileSystem.getInfoAsync(PDFJS_WORKER),
    ]);
    if (mainInfo.exists && workerInfo.exists) return true;

    await FileSystem.makeDirectoryAsync(PDFJS_CACHE_DIR, { intermediates: true }).catch(() => {});
    const downloads: Promise<any>[] = [];
    if (!mainInfo.exists)   downloads.push(FileSystem.downloadAsync(`${PDFJS_CDN}/pdf.min.js`,        PDFJS_MAIN));
    if (!workerInfo.exists) downloads.push(FileSystem.downloadAsync(`${PDFJS_CDN}/pdf.worker.min.js`, PDFJS_WORKER));
    await Promise.all(downloads);
    return true;
  } catch {
    return false;
  }
}

function buildViewerHtmlLocal(b64: string, mainPath: string, workerPath: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#525659}
  #viewer{padding:4px}
  canvas{display:block;margin:0 auto 6px;box-shadow:0 2px 8px rgba(0,0,0,.4)}
  #msg{color:#e5e7eb;text-align:center;padding:40px;font:14px sans-serif}
</style>
</head><body>
<div id="msg">Caricamento PDF\u2026</div>
<div id="viewer"></div>
<script src="${mainPath}"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='${workerPath}';
var b64='${b64}';
var raw=atob(b64);
var buf=new Uint8Array(raw.length);
for(var i=0;i<raw.length;i++)buf[i]=raw.charCodeAt(i);
pdfjsLib.getDocument({data:buf}).promise.then(function(pdf){
  document.getElementById('msg').remove();
  var v=document.getElementById('viewer');
  var dpr=Math.max(window.devicePixelRatio||1,3);
  for(var i=1;i<=pdf.numPages;i++){
    pdf.getPage(i).then(function(page){
      var sc=(window.innerWidth-8)/page.getViewport({scale:1}).width;
      var vp=page.getViewport({scale:sc*dpr});
      var c=document.createElement('canvas');
      c.width=vp.width;c.height=vp.height;
      c.style.width=((vp.width/dpr))+'px';
      c.style.height=((vp.height/dpr))+'px';
      v.appendChild(c);
      page.render({canvasContext:c.getContext('2d'),viewport:vp});
    });
  }
}).catch(function(e){
  document.getElementById('msg').textContent='Errore rendering: '+e.message;
});
</script>
</body></html>`;
}

interface Props {
  ddtPdf?: string;
  ddtFirmato?: string;
  firmaDigitale?: string;
  noteDdt?: string;
}

type WebViewSource = { uri: string } | { html: string };

const VIEWER_H = 380;

export function VisualizzaDDT({ ddtPdf, ddtFirmato, firmaDigitale, noteDdt }: Props) {
  const [source, setSource]         = useState<WebViewSource | null>(null);
  const [preparing, setPreparing]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [offlineError, setOfflineError] = useState(false);

  const isSigned = !!ddtFirmato;
  const firmaLabel = ddtFirmato
    ? 'DDT con firma incorporata'
    : firmaDigitale
      ? 'Firma raccolta — elaborazione in corso'
      : 'Non ancora firmato';

  // Ri-prepara il viewer solo quando cambia il PDF disponibile
  const pdfKey = ddtFirmato
    ? `f${ddtFirmato.length}`
    : ddtPdf
      ? `o${ddtPdf.length}`
      : null;

  useEffect(() => {
    const pdf = ddtFirmato ?? ddtPdf;
    if (!pdf) return;

    let cancelled = false;
    setOfflineError(false);
    (async () => {
      setPreparing(true);
      try {
        const b64 = pdf.replace(/^data:[^;]+;base64,/, '').replace(/[\n\r\s]/g, '');

        let src: WebViewSource;

        if (Platform.OS === 'ios') {
          // iOS: rendering PDF nativo via file://
          const uri = `${FileSystem.cacheDirectory}ddt_render.pdf`;
          await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
          src = { uri };
        } else {
          // Android: usa PDF.js in cache locale (scaricato una volta quando online)
          const cached = await ensurePdfJsCached();
          if (cached) {
            const html = buildViewerHtmlLocal(b64, PDFJS_MAIN, PDFJS_WORKER);
            const htmlUri = `${FileSystem.cacheDirectory}ddt_viewer.html`;
            await FileSystem.writeAsStringAsync(htmlUri, html);
            src = { uri: htmlUri };
          } else {
            // PDF.js non disponibile (offline al primo avvio) — usa CDN come fallback
            src = { html: buildViewerHtml(b64) };
            if (!cancelled) setOfflineError(true);
          }
        }

        if (!cancelled) setSource(src);
      } catch (e: any) {
        console.error('[DDT] Errore preparazione viewer:', e?.message);
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfKey]);

  const webViewProps = {
    allowFileAccess: true,
    allowUniversalAccessFromFileURLs: true,
    originWhitelist: ['file://*', 'https://*', 'about:*', '*'],
    mixedContentMode: 'always' as const,
    javaScriptEnabled: true,
    scrollEnabled: true,
    showsVerticalScrollIndicator: false,
  };

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <FileText size={18} color="#2563eb" />
        <Text style={s.titolo}>Documento di Trasporto</Text>
        {source && (
          <TouchableOpacity onPress={() => setFullscreen(true)} style={s.expandBtn}>
            <Maximize2 size={16} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Badge stato firma */}
      <View style={[s.badge, firmaDigitale ? s.badgeOk : s.badgeNo]}>
        {firmaDigitale
          ? <CheckCircle2 size={13} color="#16a34a" />
          : <Clock size={13} color="#d97706" />
        }
        <Text style={[s.badgeText, { color: firmaDigitale ? '#166534' : '#92400e' }]}>
          {firmaLabel}
        </Text>
      </View>

      {/* Avviso PDF offline (Android, prima connessione) */}
      {offlineError && (
        <View style={s.offlineWarn}>
          <WifiOff size={14} color="#d97706" />
          <Text style={s.offlineWarnText}>Connessione necessaria per il rendering la prima volta</Text>
        </View>
      )}

      {/* Viewer inline */}
      {!ddtPdf && !ddtFirmato ? (
        <View style={s.empty}><Text style={s.emptyText}>Nessun DDT allegato</Text></View>
      ) : preparing ? (
        <View style={s.loading}>
          <ActivityIndicator color="#2563eb" />
          <Text style={s.loadingText}>Caricamento PDF…</Text>
        </View>
      ) : source ? (
        <View style={s.pdfWrap}>
          <WebView source={source} style={s.webview} {...webViewProps} />
        </View>
      ) : null}

      {/* Note DDT */}
      {noteDdt && (
        <View style={s.noteBox}>
          <Text style={s.noteLabel}>Note al DDT</Text>
          <Text style={s.noteText}>{noteDdt}</Text>
        </View>
      )}

      {/* Modal fullscreen */}
      <Modal visible={fullscreen} animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalBar}>
            <Text style={s.modalTitolo}>{isSigned ? 'DDT Firmato' : 'DDT'}</Text>
            <TouchableOpacity onPress={() => setFullscreen(false)} style={s.closeBtn}>
              <X size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {source && (
            <WebView
              source={source}
              style={{ flex: 1 }}
              allowFileAccess
              allowUniversalAccessFromFileURLs
              originWhitelist={['file://*', 'https://*', 'about:*', '*']}
              mixedContentMode="always"
              javaScriptEnabled
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/**
 * Genera l'HTML con PDF.js (CDN) e il base64 del PDF incorporato come variabile JS.
 * Nessun fetch() locale — evita i problemi di accesso file su Android WebView.
 */
function buildViewerHtml(b64: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#525659}
  #viewer{padding:4px}
  canvas{display:block;margin:0 auto 6px;box-shadow:0 2px 8px rgba(0,0,0,.4)}
  #msg{color:#e5e7eb;text-align:center;padding:40px;font:14px sans-serif}
</style>
</head><body>
<div id="msg">Caricamento PDF…</div>
<div id="viewer"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var b64='${b64}';
var raw=atob(b64);
var buf=new Uint8Array(raw.length);
for(var i=0;i<raw.length;i++)buf[i]=raw.charCodeAt(i);
pdfjsLib.getDocument({data:buf}).promise.then(function(pdf){
  document.getElementById('msg').remove();
  var v=document.getElementById('viewer');
  var dpr=Math.max(window.devicePixelRatio||1,3);
  for(var i=1;i<=pdf.numPages;i++){
    pdf.getPage(i).then(function(page){
      var sc=(window.innerWidth-8)/page.getViewport({scale:1}).width;
      var vp=page.getViewport({scale:sc*dpr});
      var c=document.createElement('canvas');
      c.width=vp.width;c.height=vp.height;
      c.style.width=((vp.width/dpr))+'px';
      c.style.height=((vp.height/dpr))+'px';
      v.appendChild(c);
      page.render({canvasContext:c.getContext('2d'),viewport:vp});
    });
  }
}).catch(function(e){
  document.getElementById('msg').textContent='Errore rendering: '+e.message;
});
</script>
</body></html>`;
}

const s = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', gap: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titolo:      { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  expandBtn:   { padding: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  badgeOk:     { backgroundColor: '#f0fdf4' },
  badgeNo:     { backgroundColor: '#fffbeb' },
  badgeText:   { flex: 1, fontSize: 12, fontWeight: '600' },
  offlineWarn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  offlineWarnText: { flex: 1, fontSize: 11, color: '#92400e' },
  empty:       { padding: 24, alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12 },
  emptyText:   { color: '#9ca3af', fontSize: 14 },
  loading:     { height: VIEWER_H, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 12 },
  loadingText: { color: '#9ca3af', fontSize: 13 },
  pdfWrap:     { height: VIEWER_H, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  webview:     { flex: 1, backgroundColor: '#525659' },
  noteBox:     { backgroundColor: '#fffbeb', borderRadius: 12, padding: 12 },
  noteLabel:   { fontSize: 11, fontWeight: '700', color: '#d97706', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText:    { fontSize: 13, color: '#92400e', lineHeight: 18 },
  modal:       { flex: 1, backgroundColor: '#111827' },
  modalBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#1f2937' },
  modalTitolo: { fontSize: 15, fontWeight: '700', color: '#fff' },
  closeBtn:    { padding: 8, borderRadius: 8, backgroundColor: '#ef4444' },
});
