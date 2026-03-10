import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, FileText, Pen, Banknote, ClipboardList } from 'lucide-react-native';
import { useConsegne, useUpdateConsegna } from '../../../lib/api/consegne';
import { useAuth } from '../../../hooks/useAuth';
import { getConsegnaById } from '../../../lib/db/sqlite';

type Tab = 'documenti' | 'firma' | 'pagamento' | 'riepilogo';

const TABS: { key: Tab; label: string; Icona: any }[] = [
  { key: 'documenti', label: 'Documenti', Icona: FileText },
  { key: 'firma',     label: 'Firma',     Icona: Pen },
  { key: 'pagamento', label: 'Pagamento', Icona: Banknote },
  { key: 'riepilogo', label: 'Riepilogo', Icona: ClipboardList },
];

export default function DettaglioConsegnaScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const { idTrasportatore } = useAuth();
  const [tab, setTab] = useState<Tab>('documenti');

  const { data: consegne = [] } = useConsegne(idTrasportatore ?? 0);
  const consegna = consegne.find(c => String(c.id) === id || String(c.localId) === id)
    ?? getConsegnaById(Number(id));
  const { mutate: aggiorna, isPending } = useUpdateConsegna();

  if (!consegna) {
    return (
      <View style={s.center}>
        <Text style={s.notFound}>Consegna non trovata</Text>
      </View>
    );
  }

  const inCorso = consegna.statoConsegna === 'in_corso';

  const handleSegnaConsegnata = () => {
    if (!consegna.firmaDigitale) {
      Alert.alert('Firma mancante', 'Il DDT deve essere firmato prima di confermare la consegna.', [
        { text: 'Vai alla Firma', onPress: () => setTab('firma') },
        { text: 'Annulla', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Conferma consegna', 'Vuoi segnare questa consegna come completata?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Conferma',
        onPress: () => aggiorna({
          localId: consegna.localId, id: consegna.id,
          idTrasportatore: consegna.idTrasportatore,
          statoConsegna: 'consegnata',
        }, {
          onSuccess: () => router.replace('/(tabs)/consegne'),
        }),
      },
    ]);
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color="#374151" />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>{consegna.clienteNome}</Text>
          <Text style={s.headerSub} numberOfLines={1}>{consegna.indirizzoConsegna}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
          >
            <t.Icona size={16} color={tab === t.key ? '#111827' : '#9ca3af'} />
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenuto */}
      <ScrollView style={s.content} contentContainerStyle={{ padding: 20, paddingBottom: inCorso ? 100 : 20 }}>
        {tab === 'documenti' && (
          <View>
            <Text style={s.sectionTitle}>Documenti</Text>
            {consegna.statoConsegna === 'da_consegnare' && (
              <TouchableOpacity
                style={s.startBtn}
                onPress={() => aggiorna({ localId: consegna.localId, id: consegna.id, idTrasportatore: consegna.idTrasportatore, statoConsegna: 'in_corso' })}
              >
                <Text style={s.startBtnText}>Inizia consegna</Text>
              </TouchableOpacity>
            )}
            <Text style={s.placeholder}>{'DDT e ricevute disponibili qui.'}</Text>
          </View>
        )}
        {tab === 'firma' && (
          <View>
            <Text style={s.sectionTitle}>Firma DDT</Text>
            <Text style={s.placeholder}>{consegna.firmaDigitale ? 'DDT firmato.' : 'Nessuna firma ancora. Usa il componente firma qui.'}</Text>
          </View>
        )}
        {tab === 'pagamento' && (
          <View>
            <Text style={s.sectionTitle}>Pagamento</Text>
            <Text style={s.placeholder}>Form incasso qui.</Text>
          </View>
        )}
        {tab === 'riepilogo' && (
          <View style={{ gap: 12 }}>
            <Text style={s.sectionTitle}>Riepilogo</Text>
            <InfoRow label="Cliente"   value={consegna.clienteNome} />
            <InfoRow label="Indirizzo" value={consegna.indirizzoConsegna} />
            <InfoRow label="Stato"     value={consegna.statoConsegna} />
          </View>
        )}
      </ScrollView>

      {/* Bottone wizard fisso in basso */}
      {inCorso && (
        <View style={s.bottomBar}>
          {tab === 'riepilogo' ? (
            <TouchableOpacity style={s.confirmBtn} onPress={handleSegnaConsegnata} disabled={isPending}>
              <Text style={s.confirmBtnText}>{isPending ? 'Salvataggio…' : 'Segna come Consegnata'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.nextBtn}
              onPress={() => {
                const order: Tab[] = ['documenti','firma','pagamento','riepilogo'];
                const next = order[order.indexOf(tab) + 1];
                if (next) setTab(next);
              }}
            >
              <Text style={s.nextBtnText}>Avanti →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' }}>
      <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:       { color: '#9ca3af', fontSize: 16 },
  header:         { backgroundColor: '#fff', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn:        { padding: 6, marginRight: 8 },
  headerInfo:     { flex: 1 },
  headerTitle:    { fontSize: 17, fontWeight: '800', color: '#111827' },
  headerSub:      { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  tabBar:         { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 4 },
  tabBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 12 },
  tabBtnActive:   { backgroundColor: '#f1f5f9' },
  tabLabel:       { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  tabLabelActive: { color: '#111827' },
  content:        { flex: 1 },
  sectionTitle:   { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  placeholder:    { color: '#9ca3af', fontSize: 14, marginTop: 8 },
  startBtn:       { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  startBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  bottomBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  confirmBtn:     { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  nextBtn:        { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  nextBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});
