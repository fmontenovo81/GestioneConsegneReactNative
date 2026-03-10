import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, SafeAreaView, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import WebView from 'react-native-webview';
import { FileText, X, ExternalLink, CheckCircle2 } from 'lucide-react-native';

interface Props {
  ddtPdf?: string;
  firmaDigitale?: string;
  noteDdt?: string;
}

export function VisualizzaDDT({ ddtPdf, firmaDigitale, noteDdt }: Props) {
  const [loading, setLoading]         = useState(false);
  const [fileUri, setFileUri]         = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);

  const preparaPdf = async () => {
    if (!ddtPdf) return;
    setLoading(true);
    try {
      const uri = `${FileSystem.cacheDirectory}ddt.pdf`;
      const b64 = ddtPdf
        .replace(/^data:[^;]+;base64,/, '')
        .replace(/[\n\r\s]/g, '');
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
      setFileUri(uri);
      setShowModal(true);
    } catch (e: any) {
      console.error('[DDT] Errore preparazione PDF:', e?.message ?? e);
      Alert.alert('Errore', 'Impossibile aprire il PDF');
    } finally {
      setLoading(false);
    }
  };

  const apriEsterno = async () => {
    if (!fileUri) return;
    try {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Apri DDT' });
    } catch (e) {
      Alert.alert('Errore', 'Impossibile aprire con app esterna');
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <FileText size={20} color="#2563eb" />
        <Text style={s.titolo}>Documento di Trasporto</Text>
      </View>

      {ddtPdf ? (
        <TouchableOpacity style={s.btnPdf} onPress={preparaPdf} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color="#2563eb" />
            : <FileText size={18} color="#2563eb" />
          }
          <Text style={s.btnPdfText}>Visualizza DDT</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.nessunDdt}>
          <Text style={s.nessunDdtText}>Nessun DDT caricato</Text>
        </View>
      )}

      {/* Stato firma */}
      <View style={[s.firmaRow, firmaDigitale ? s.firmaOk : s.firmaMancante]}>
        <CheckCircle2 size={16} color={firmaDigitale ? '#16a34a' : '#d97706'} />
        <Text style={[s.firmaText, { color: firmaDigitale ? '#166534' : '#92400e' }]}>
          {firmaDigitale ? 'DDT firmato dal cliente' : 'DDT non ancora firmato'}
        </Text>
      </View>

      {/* Note DDT */}
      {noteDdt && (
        <View style={s.noteBox}>
          <Text style={s.noteLabel}>Note al DDT</Text>
          <Text style={s.noteText}>{noteDdt}</Text>
        </View>
      )}

      {/* Modal PDF viewer */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitolo}>DDT</Text>
            <View style={s.modalActions}>
              <TouchableOpacity onPress={apriEsterno} style={s.modalBtn}>
                <ExternalLink size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowModal(false)} style={[s.modalBtn, s.modalBtnClose]}>
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {fileUri && (
            Platform.OS === 'ios' ? (
              // iOS: WebView renderizza i PDF nativamente con file:// URI
              <WebView
                source={{ uri: fileUri }}
                style={{ flex: 1 }}
                originWhitelist={['file://*']}
                allowFileAccess
              />
            ) : (
              // Android: WebView non renderizza PDF da file:// — usa HTML con embed
              <WebView
                source={{ html: buildPdfHtml(ddtPdf!) }}
                style={{ flex: 1 }}
                originWhitelist={['*']}
                javaScriptEnabled
              />
            )
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function buildPdfHtml(base64: string): string {
  const b64 = base64.replace(/^data:[^;]+;base64,/, '').replace(/[\n\r\s]/g, '');
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#555; width:100%; height:100vh; display:flex; align-items:center; justify-content:center; }
  embed { width:100%; height:100vh; }
</style></head><body>
<embed src="data:application/pdf;base64,${b64}" type="application/pdf" width="100%" height="100%"/>
</body></html>`;
}

const s = StyleSheet.create({
  container:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  titolo:         { fontSize: 15, fontWeight: '700', color: '#111827' },
  btnPdf:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 12 },
  btnPdfText:     { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  nessunDdt:      { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' },
  nessunDdtText:  { color: '#9ca3af', fontSize: 14 },
  firmaRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 8 },
  firmaOk:        { backgroundColor: '#f0fdf4' },
  firmaMancante:  { backgroundColor: '#fffbeb' },
  firmaText:      { fontSize: 13, fontWeight: '600' },
  noteBox:        { backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginTop: 4 },
  noteLabel:      { fontSize: 11, fontWeight: '700', color: '#d97706', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText:       { fontSize: 13, color: '#92400e', lineHeight: 18 },
  modal:          { flex: 1, backgroundColor: '#1a1a1a' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#111827' },
  modalTitolo:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalActions:   { flexDirection: 'row', gap: 8 },
  modalBtn:       { padding: 8, borderRadius: 8, backgroundColor: '#374151' },
  modalBtnClose:  { backgroundColor: '#ef4444' },
});
