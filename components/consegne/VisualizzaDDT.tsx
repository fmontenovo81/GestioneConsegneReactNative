import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FileText, Download, CheckCircle2 } from 'lucide-react-native';

interface Props {
  ddtPdf?: string;
  firmaDigitale?: string;
  noteDdt?: string;
}

export function VisualizzaDDT({ ddtPdf, firmaDigitale, noteDdt }: Props) {
  const [loading, setLoading] = useState(false);

  const apriPdf = async (base64: string, nomeFile: string) => {
    setLoading(true);
    try {
      const uri = FileSystem.cacheDirectory + nomeFile;
      const b64 = base64.replace(/^data:application\/pdf;base64,/, '');
      await FileSystem.writeAsStringAsync(uri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const disponibile = await Sharing.isAvailableAsync();
      if (disponibile) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Apri DDT' });
      } else {
        Alert.alert('Errore', 'Condivisione file non disponibile su questo dispositivo');
      }
    } catch (e) {
      Alert.alert('Errore', 'Impossibile aprire il PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <FileText size={20} color="#2563eb" />
        <Text style={s.titolo}>Documento di Trasporto</Text>
      </View>

      {ddtPdf ? (
        <TouchableOpacity
          style={s.btnPdf}
          onPress={() => apriPdf(ddtPdf, 'ddt.pdf')}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#2563eb" />
            : <Download size={18} color="#2563eb" />
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
    </View>
  );
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
});
