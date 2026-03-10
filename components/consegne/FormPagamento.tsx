import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Banknote, CreditCard, Building2, Check, RotateCcw } from 'lucide-react-native';
import { useCreaPagamento } from '../../lib/api/pagamenti';

type Metodo = 'contanti' | 'carta' | 'bonifico';

const METODI: { key: Metodo; label: string; Icona: any }[] = [
  { key: 'contanti', label: 'Contanti',  Icona: Banknote  },
  { key: 'carta',    label: 'Carta',     Icona: CreditCard },
  { key: 'bonifico', label: 'Bonifico',  Icona: Building2  },
];

function formatEuro(val: number) {
  return val.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

interface Props {
  consegnaServerId?: number;
  onCompletato: () => void;
}

export function FormPagamento({ consegnaServerId, onCompletato }: Props) {
  const sigRef = useRef<any>(null);
  const { mutate: creaPagamento, isPending } = useCreaPagamento();

  const [fase, setFase]         = useState<'form' | 'firma' | 'ok'>('form');
  const [importo, setImporto]   = useState('');
  const [metodo, setMetodo]     = useState<Metodo>('contanti');
  const [note, setNote]         = useState('');
  const [firma, setFirma]       = useState('');

  const handleAvanti = () => {
    const val = parseFloat(importo.replace(',', '.'));
    if (!importo || isNaN(val) || val <= 0) {
      Alert.alert('Attenzione', 'Inserisci un importo valido');
      return;
    }
    setFase('firma');
  };

  const handleFirmaOk = (f: string) => {
    if (!f || f === 'data:image/png;base64,') {
      Alert.alert('Attenzione', 'Firma la ricevuta prima di procedere');
      return;
    }
    setFirma(f);
    const val = parseFloat(importo.replace(',', '.'));
    creaPagamento(
      {
        idConsegna: consegnaServerId!,
        importo:    val,
        metodo,
        note:       note || undefined,
        firmaRicevuta: f,
      },
      {
        onSuccess: () => { setFase('ok'); },
        onError:   () => Alert.alert('Errore', 'Impossibile salvare il pagamento'),
      }
    );
  };

  const stile = `.m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; }
    body, html { background-color: #f8fafc; }`;

  if (fase === 'ok') {
    return (
      <View style={s.okContainer}>
        <View style={s.okIconWrap}>
          <Check size={40} color="#16a34a" />
        </View>
        <Text style={s.okTitolo}>Incasso registrato</Text>
        <Text style={s.okImporto}>{formatEuro(parseFloat(importo.replace(',', '.')))}</Text>
        <TouchableOpacity style={s.altroBtn} onPress={() => { setFase('form'); setImporto(''); setNote(''); setFirma(''); }}>
          <Text style={s.altroBtnText}>Registra altro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.continua} onPress={onCompletato}>
          <Text style={s.continuaText}>Vai al Riepilogo →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fase === 'firma') {
    return (
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.titolo}>Firma del trasportatore</Text>
        <Text style={s.sottotitolo}>Importo: <Text style={s.importoBold}>{formatEuro(parseFloat(importo.replace(',', '.')))}</Text></Text>
        <View style={s.padWrapper}>
          <SignatureCanvas
            ref={sigRef}
            onOK={handleFirmaOk}
            webStyle={stile}
            minWidth={2}
            maxWidth={6}
            backgroundColor="rgba(0,0,0,0)"
            style={{ height: 200 }}
            descriptionText=""
          />
          <View style={s.padBtns}>
            <TouchableOpacity style={s.cancellaBtn} onPress={() => sigRef.current?.clearSignature()}>
              <RotateCcw size={16} color="#6b7280" />
              <Text style={s.cancellaBtnText}>Cancella</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confermaBtn, isPending && s.confermaBtnDisabled]}
              onPress={() => sigRef.current?.readSignature()}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Check size={16} color="#fff" />
              }
              <Text style={s.confermaBtnText}>Conferma ricevuta</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={s.indietroBtn} onPress={() => setFase('form')}>
          <Text style={s.indietroBtnText}>← Torna al form</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.titolo}>Registra incasso</Text>

      {/* Importo */}
      <Text style={s.label}>Importo (€)</Text>
      <TextInput
        style={s.input}
        value={importo}
        onChangeText={setImporto}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor="#9ca3af"
      />

      {/* Metodo */}
      <Text style={s.label}>Metodo di pagamento</Text>
      <View style={s.metodiRow}>
        {METODI.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.metodoBtn, metodo === m.key && s.metodoBtnActive]}
            onPress={() => setMetodo(m.key)}
          >
            <m.Icona size={18} color={metodo === m.key ? '#2563eb' : '#6b7280'} />
            <Text style={[s.metodoBtnText, metodo === m.key && s.metodoBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Note */}
      <Text style={s.label}>Note (opzionale)</Text>
      <TextInput
        style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
        value={note}
        onChangeText={setNote}
        placeholder="Eventuali note..."
        placeholderTextColor="#9ca3af"
        multiline
      />

      <TouchableOpacity
        style={[s.avantiBtn, (!importo) && s.avantiBtnDisabled]}
        onPress={handleAvanti}
        disabled={!importo}
      >
        <Text style={s.avantiBtnText}>Avanti → Firma ricevuta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:          { padding: 4, gap: 14 },
  titolo:             { fontSize: 18, fontWeight: '800', color: '#111827' },
  sottotitolo:        { fontSize: 14, color: '#6b7280' },
  importoBold:        { fontWeight: '800', color: '#111827' },
  label:              { fontSize: 13, fontWeight: '600', color: '#374151' },
  input:              { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, fontSize: 16, color: '#111827' },
  metodiRow:          { flexDirection: 'row', gap: 8 },
  metodoBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  metodoBtnActive:    { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  metodoBtnText:      { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  metodoBtnTextActive:{ color: '#2563eb' },
  avantiBtn:          { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  avantiBtnDisabled:  { opacity: 0.5 },
  avantiBtnText:      { color: '#fff', fontWeight: '700', fontSize: 16 },
  padWrapper:         { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc' },
  padBtns:            { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  cancellaBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
  cancellaBtnText:    { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  confermaBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, backgroundColor: '#059669' },
  confermaBtnDisabled:{ opacity: 0.6 },
  confermaBtnText:    { fontSize: 14, color: '#fff', fontWeight: '700' },
  indietroBtn:        { alignItems: 'center', paddingVertical: 12 },
  indietroBtnText:    { color: '#6b7280', fontSize: 14 },
  okContainer:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  okIconWrap:         { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  okTitolo:           { fontSize: 22, fontWeight: '800', color: '#111827' },
  okImporto:          { fontSize: 28, fontWeight: '900', color: '#16a34a' },
  altroBtn:           { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb' },
  altroBtnText:       { color: '#374151', fontWeight: '600' },
  continua:           { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  continuaText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
});
