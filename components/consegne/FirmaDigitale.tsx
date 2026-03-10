import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Pen, RotateCcw, Check } from 'lucide-react-native';

interface Props {
  firmaEsistente?: string;
  noteDdt?: string;
  onSalvata: (firma: string, note: string) => void;
}

export function FirmaDigitale({ firmaEsistente, noteDdt: noteDdtIniziali, onSalvata }: Props) {
  const sigRef = useRef<any>(null);
  const [note, setNote] = useState(noteDdtIniziali ?? '');
  const [firmaSalvata, setFirmaSalvata] = useState(!!firmaEsistente);

  const handleOk = (firma: string) => {
    if (!firma || firma === 'data:image/png;base64,') {
      Alert.alert('Attenzione', 'Disegna la firma prima di salvare');
      return;
    }
    setFirmaSalvata(true);
    onSalvata(firma, note);
  };

  const handleCancella = () => {
    sigRef.current?.clearSignature();
    setFirmaSalvata(false);
  };

  const stile = `.m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; }
    body, html { background-color: #f8fafc; }`;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.header}>
        <Pen size={20} color="#2563eb" />
        <Text style={s.titolo}>Firma DDT</Text>
      </View>

      {/* Note DDT */}
      <Text style={s.label}>Note al DDT (opzionale)</Text>
      <TextInput
        style={s.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="Eventuali note o eccezioni..."
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={3}
      />

      {/* Area firma */}
      <Text style={s.label}>Firma del cliente</Text>
      {firmaSalvata ? (
        <View style={s.firmaOk}>
          <Check size={24} color="#16a34a" />
          <Text style={s.firmaOkText}>Firma acquisita</Text>
          <TouchableOpacity onPress={handleCancella} style={s.rifirmaBtn}>
            <RotateCcw size={14} color="#6b7280" />
            <Text style={s.rifirmaBtnText}>Rifirma</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.padWrapper}>
          <SignatureCanvas
            ref={sigRef}
            onOK={handleOk}
            webStyle={stile}
            minWidth={3}
            maxWidth={8}
            backgroundColor="rgba(0,0,0,0)"
            style={s.pad}
            descriptionText=""
          />
          <View style={s.padBtns}>
            <TouchableOpacity style={s.cancellaBtn} onPress={handleCancella}>
              <RotateCcw size={16} color="#6b7280" />
              <Text style={s.cancellaBtnText}>Cancella</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.salvaBtn} onPress={() => sigRef.current?.readSignature()}>
              <Check size={16} color="#fff" />
              <Text style={s.salvaBtnText}>Salva firma</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:      { padding: 4, gap: 16 },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titolo:         { fontSize: 18, fontWeight: '800', color: '#111827' },
  label:          { fontSize: 13, fontWeight: '600', color: '#374151' },
  noteInput:      { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', minHeight: 80, textAlignVertical: 'top' },
  padWrapper:     { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc' },
  pad:            { height: 220 },
  padBtns:        { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  cancellaBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
  cancellaBtnText:{ fontSize: 13, color: '#6b7280', fontWeight: '600' },
  salvaBtn:       { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, backgroundColor: '#2563eb' },
  salvaBtnText:   { fontSize: 14, color: '#fff', fontWeight: '700' },
  firmaOk:        { backgroundColor: '#f0fdf4', borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  firmaOkText:    { fontSize: 15, fontWeight: '700', color: '#166534' },
  rifirmaBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rifirmaBtnText: { fontSize: 12, color: '#6b7280' },
});
