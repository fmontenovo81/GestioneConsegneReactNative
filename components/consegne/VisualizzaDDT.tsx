import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, SafeAreaView, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import WebView from 'react-native-webview';
import { FileText, Maximize2, X, CheckCircle2, Clock } from 'lucide-react-native';

interface Props {
  ddtPdf?: string;
  ddtFirmato?: string;
  firmaDigitale?: string;
  noteDdt?: string;
}

const VIEWER_H = 380;

export function VisualizzaDDT({ ddtPdf, ddtFirmato, firmaDigitale, noteDdt }: Props) {
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSigned, setShowSigned] = useState(false);

  // Determina quale PDF usare e se mostrare la versione firmata
  const pdfAttivo = (ddtFirmato && showSigned) ? ddtFirmato : (ddtFirmato ?? ddtPdf);
  const isSigned  = !!(ddtFirmato && (showSigned || !ddtPdf));

  // Chiave stabile per triggerare l'effetto solo quando cambia il PDF da visualizzare
  const pdfKey = ddtFirmato ? `firmato-${ddtFirmato.slice(-8)}` : ddtPdf ? `orig-${ddtPdf.slice(-8)}` : null;

  useEffect(() => {
    const pdf = ddtFirmato ?? ddtPdf;
    if (!pdf) return;

    let cancelled = false;
    (async () => {
      setPreparing(true);
      try {
        const b64 = pdf.replace(/^data:[^;]+;base64,/, '').replace(/[\n\r\s]/g, '');
        const pdfUri = `${FileSystem.cacheDirectory}ddt_render.pdf`;
        await FileSystem.writeAsStringAsync(pdfUri, b64, { encoding: 'base64' });

        let uri = pdfUri;
        if (Platform.OS === 'android') {
          const htmlUri = `${FileSystem.cacheDirectory}ddt_viewer.html`;
          await FileSystem.writeAsStringAsync(htmlUri, buildViewerHtml(), { encoding: 'utf8' });
          uri = htmlUri;
        }
        if (!cancelled) {
          setShowSigned(!!ddtFirmato);
          setViewerUri(uri);
        }
      } catch (e: any) {
        console.error('[DDT] Errore viewer:', e?.message);
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfKey]);

  const firmaLabel = ddtFirmato
    ? 'DDT con firma incorporata'
    : firmaDigitale
      ? 'Firma raccolta — elaborazione in corso'
      : 'Non ancora firmato';

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <FileText size={18} color="#2563eb" />
        <Text style={s.titolo}>Documento di Trasporto</Text>
        {viewerUri && (
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

      {/* Viewer inline */}
      {!ddtPdf && !ddtFirmato ? (
        <View style={s.empty}><Text style={s.emptyText}>Nessun DDT allegato</Text></View>
      ) : preparing ? (
        <View style={s.loading}>
          <ActivityIndicator color="#2563eb" />
          <Text style={s.loadingText}>Caricamento PDF…</Text>
        </View>
      ) : viewerUri ? (
        <View style={s.pdfWrap}>
          <WebView
            source={{ uri: viewerUri }}
            style={s.webview}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            originWhitelist={['file://*', 'https://*', '*']}
            mixedContentMode="always"
            javaScriptEnabled
            scrollEnabled
            showsVerticalScrollIndicator={false}
          />
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
          {viewerUri && (
            <WebView
              source={{ uri: viewerUri }}
              style={{ flex: 1 }}
              allowFileAccess
              allowUniversalAccessFromFileURLs
              originWhitelist={['file://*', 'https://*', '*']}
              mixedContentMode="always"
              javaScriptEnabled
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function buildViewerHtml(): string {
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
fetch('./ddt_render.pdf')
  .then(r=>r.arrayBuffer())
  .then(buf=>{
    document.getElementById('msg').remove();
    pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise.then(pdf=>{
      const v=document.getElementById('viewer');
      for(let i=1;i<=pdf.numPages;i++){
        pdf.getPage(i).then(page=>{
          const sc=(window.innerWidth-8)/page.getViewport({scale:1}).width;
          const vp=page.getViewport({scale:sc});
          const c=document.createElement('canvas');
          c.width=vp.width;c.height=vp.height;
          v.appendChild(c);
          page.render({canvasContext:c.getContext('2d'),viewport:vp});
        });
      }
    });
  })
  .catch(e=>document.getElementById('msg').textContent='Errore: '+e.message);
</script>
</body></html>`;
}

const s = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', gap: 10 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titolo:     { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  expandBtn:  { padding: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  badgeOk:    { backgroundColor: '#f0fdf4' },
  badgeNo:    { backgroundColor: '#fffbeb' },
  badgeText:  { flex: 1, fontSize: 12, fontWeight: '600' },
  empty:      { padding: 24, alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12 },
  emptyText:  { color: '#9ca3af', fontSize: 14 },
  loading:    { height: VIEWER_H, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 12 },
  loadingText:{ color: '#9ca3af', fontSize: 13 },
  pdfWrap:    { height: VIEWER_H, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  webview:    { flex: 1, backgroundColor: '#525659' },
  noteBox:    { backgroundColor: '#fffbeb', borderRadius: 12, padding: 12 },
  noteLabel:  { fontSize: 11, fontWeight: '700', color: '#d97706', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText:   { fontSize: 13, color: '#92400e', lineHeight: 18 },
  modal:      { flex: 1, backgroundColor: '#111827' },
  modalBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#1f2937' },
  modalTitolo:{ fontSize: 15, fontWeight: '700', color: '#fff' },
  closeBtn:   { padding: 8, borderRadius: 8, backgroundColor: '#ef4444' },
});
