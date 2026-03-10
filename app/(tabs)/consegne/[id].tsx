import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft, FileText, Pen, Banknote, ClipboardList,
  CheckCircle2, AlertTriangle, Truck, PackageCheck, Mail, Send, Check, X,
} from 'lucide-react-native';
import { useConsegne, useConsegnaDetail, useUpdateConsegna, consegneKeys } from '../../../lib/api/consegne';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getConsegnaById } from '../../../lib/db/sqlite';
import { VisualizzaDDT } from '../../../components/consegne/VisualizzaDDT';
import { PagamentiConsegna } from '../../../components/consegne/PagamentiConsegna';
import { FirmaDigitale } from '../../../components/consegne/FirmaDigitale';
import { FormPagamento } from '../../../components/consegne/FormPagamento';
import { SyncIndicator } from '../../../components/sync/SyncIndicator';

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
  const qc = useQueryClient();
  const [tab, setTab]           = useState<Tab>('documenti');
  const [emailInput, setEmail]  = useState('');

  const { data: consegne = [] } = useConsegne(idTrasportatore ?? 0);
  const consegna = consegne.find(c => String(c.id) === id || String(c.localId) === id)
    ?? getConsegnaById(Number(id));
  const serverId = consegna?.id;
  const { data: dettaglio } = useConsegnaDetail(serverId);
  // Merge: i campi binari vengono dalla GET dettaglio (esclusi dalla lista per payload)
  const ddtPdf        = dettaglio?.ddtPdf        ?? consegna?.ddtPdf;
  const ddtFirmato    = dettaglio?.ddtFirmato    ?? consegna?.ddtFirmato;
  const firmaDigitale = dettaglio?.firmaDigitale ?? consegna?.firmaDigitale;
  const { mutate: aggiorna, isPending } = useUpdateConsegna();
  const [inviandoEmail, setInviandoEmail] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailEditInput, setEmailEditInput] = useState('');

  if (!consegna) {
    return (
      <View style={s.center}>
        <Text style={s.notFound}>Consegna non trovata</Text>
      </View>
    );
  }

  const inCorso = consegna.statoConsegna === 'in_corso';

  const handleSalvaFirma = (firma: string, note: string) => {
    aggiorna({
      localId:         consegna.localId,
      id:              consegna.id,
      idTrasportatore: consegna.idTrasportatore,
      firmaDigitale:   firma,
      noteDdt:         note || undefined,
    }, {
      onSuccess: () => {
        setTab('pagamento');
        // Re-fetch dettaglio per generare ddtFirmato con la nuova firma
        if (consegna.id) qc.invalidateQueries({ queryKey: consegneKeys.detail(consegna.id) });
      },
    });
  };

  const handleReinviaEmail = async () => {
    if (!consegna.id) return;
    setInviandoEmail(true);
    try {
      const { apiFetch } = await import('../../../lib/auth/apiClient');
      const res = await apiFetch(`/consegne/${consegna.id}/invia-email`, { method: 'POST' });
      if (res.ok) {
        Alert.alert('Email inviata', `Documenti inviati a ${consegna.emailCliente}`);
      } else {
        Alert.alert('Errore', 'Impossibile inviare l\'email. Riprova.');
      }
    } catch {
      Alert.alert('Errore', 'Impossibile inviare l\'email. Riprova.');
    } finally {
      setInviandoEmail(false);
    }
  };

  const handleSegnaConsegnata = () => {
    if (!firmaDigitale) {
      Alert.alert(
        'Firma mancante',
        'Il DDT deve essere firmato prima di confermare la consegna.',
        [
          { text: 'Vai alla Firma', onPress: () => setTab('firma') },
          { text: 'Annulla', style: 'cancel' },
        ]
      );
      return;
    }
    const email = emailInput.trim() || consegna.emailCliente;
    Alert.alert(
      'Conferma consegna',
      email
        ? `I documenti verranno inviati a ${email}. Confermare?`
        : 'Segnare questa consegna come completata?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Conferma',
          onPress: () => aggiorna({
            localId:         consegna.localId,
            id:              consegna.id,
            idTrasportatore: consegna.idTrasportatore,
            statoConsegna:   'consegnata',
            ...(email ? { emailCliente: email } : {}),
          }, {
            onSuccess: () => router.replace('/(tabs)/consegne'),
          }),
        },
      ]
    );
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
        <SyncIndicator />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
          >
            <t.Icona size={15} color={tab === t.key ? '#111827' : '#9ca3af'} />
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenuto */}
      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: inCorso ? 100 : 24, gap: 16 }}>

        {/* ── Tab Documenti ── */}
        {tab === 'documenti' && (
          <>
            {consegna.statoConsegna === 'da_consegnare' && (
              <TouchableOpacity
                style={s.startBtn}
                onPress={() => aggiorna({
                  localId:         consegna.localId,
                  id:              consegna.id,
                  idTrasportatore: consegna.idTrasportatore,
                  statoConsegna:   'in_corso',
                })}
                disabled={isPending}
              >
                <Truck size={20} color="#fff" />
                <Text style={s.startBtnText}>Inizia consegna</Text>
              </TouchableOpacity>
            )}
            <VisualizzaDDT
              ddtPdf={ddtPdf}
              ddtFirmato={ddtFirmato}
              firmaDigitale={firmaDigitale}
              noteDdt={consegna.noteDdt}
            />
            <PagamentiConsegna consegnaServerId={consegna.id} />
          </>
        )}

        {/* ── Tab Firma ── */}
        {tab === 'firma' && (
          <FirmaDigitale
            firmaEsistente={firmaDigitale}
            noteDdt={consegna.noteDdt}
            onSalvata={handleSalvaFirma}
          />
        )}

        {/* ── Tab Pagamento ── */}
        {tab === 'pagamento' && (
          <FormPagamento
            consegnaServerId={consegna.id}
            onCompletato={() => setTab('riepilogo')}
          />
        )}

        {/* ── Tab Riepilogo ── */}
        {tab === 'riepilogo' && (
          <>
            {/* Card info */}
            <View style={s.infoCard}>
              <InfoRow label="Cliente"            value={consegna.clienteNome} />
              <InfoRow label="Indirizzo"          value={consegna.indirizzoConsegna} divider />
              {consegna.emailCliente && (
                <InfoRow label="Email cliente" value={consegna.emailCliente} divider />
              )}
            </View>

            {/* Stato firma */}
            <View style={[s.firmaRow, firmaDigitale ? s.firmaOk : s.firmaNok]}>
              {firmaDigitale
                ? <CheckCircle2 size={18} color="#16a34a" />
                : <AlertTriangle size={18} color="#d97706" />
              }
              <Text style={[s.firmaText, { color: firmaDigitale ? '#166534' : '#92400e' }]}>
                {firmaDigitale ? 'DDT firmato' : 'DDT non ancora firmato'}
              </Text>
              {!firmaDigitale && (
                <TouchableOpacity onPress={() => setTab('firma')}>
                  <Text style={s.vaiFirma}>Vai alla firma →</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Pagamenti */}
            <PagamentiConsegna consegnaServerId={consegna.id} />

            {/* Email */}
            {consegna.emailCliente ? (
              <View>
                {editingEmail ? (
                  <View style={s.emailEditRow}>
                    <Mail size={15} color="#9ca3af" />
                    <TextInput
                      style={s.emailEditInput}
                      value={emailEditInput}
                      onChangeText={setEmailEditInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const e = emailEditInput.trim();
                        if (!e) return;
                        aggiorna({ localId: consegna.localId, id: consegna.id, idTrasportatore: consegna.idTrasportatore, emailCliente: e });
                        setEditingEmail(false);
                      }}
                      style={s.emailEditOk}
                    >
                      <Check size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingEmail(false)} style={s.emailEditCancel}>
                      <X size={16} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.emailInfoRow}>
                    <Mail size={15} color="#2563eb" />
                    <Text style={s.emailInfoText}>
                      Email: <Text style={s.emailInfoBold}>{consegna.emailCliente}</Text>
                    </Text>
                    <TouchableOpacity onPress={() => { setEmailEditInput(consegna.emailCliente ?? ''); setEditingEmail(true); }}>
                      <Pen size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                )}
                {consegna.statoConsegna === 'consegnata' && (
                  <TouchableOpacity
                    style={[s.reinviaBtn, inviandoEmail && s.btnDisabled]}
                    onPress={handleReinviaEmail}
                    disabled={inviandoEmail}
                  >
                    {inviandoEmail
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Send size={15} color="#fff" />
                    }
                    <Text style={s.reinviaBtnText}>
                      {inviandoEmail ? 'Invio in corso…' : 'Reinvia documenti'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View>
                <Text style={s.label}>Email cliente (opzionale — per invio documenti)</Text>
                <View style={s.emailRow}>
                  <Mail size={16} color="#9ca3af" />
                  <TextInput
                    style={s.emailInput}
                    value={emailInput}
                    onChangeText={setEmail}
                    placeholder="cliente@esempio.it"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottone wizard fisso in basso */}
      {inCorso && (
        <View style={s.bottomBar}>
          {tab === 'riepilogo' ? (
            <TouchableOpacity
              style={[s.confirmBtn, isPending && s.btnDisabled]}
              onPress={handleSegnaConsegnata}
              disabled={isPending}
            >
              <PackageCheck size={20} color="#fff" />
              <Text style={s.confirmBtnText}>{isPending ? 'Salvataggio…' : 'Segna come Consegnata'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.nextBtn}
              onPress={() => {
                const order: Tab[] = ['documenti', 'firma', 'pagamento', 'riepilogo'];
                const next = order[order.indexOf(tab) + 1];
                if (next) setTab(next);
              }}
            >
              <Text style={s.nextBtnText}>
                {tab === 'firma' ? 'Vai al Pagamento →' : tab === 'pagamento' ? 'Vai al Riepilogo →' : 'Avanti →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[r.row, divider && r.divider]}>
      <Text style={r.label}>{label}</Text>
      <Text style={r.value}>{value}</Text>
    </View>
  );
}
const r = StyleSheet.create({
  row:    { paddingVertical: 12 },
  divider:{ borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  label:  { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 2 },
  value:  { fontSize: 14, fontWeight: '700', color: '#111827' },
});

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:       { color: '#9ca3af', fontSize: 16 },
  header:         { backgroundColor: '#fff', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
  backBtn:        { padding: 4 },
  headerInfo:     { flex: 1 },
  headerTitle:    { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerSub:      { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  tabBar:         { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 4 },
  tabBtn:         { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 7, borderRadius: 10 },
  tabBtnActive:   { backgroundColor: '#f1f5f9' },
  tabLabel:       { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  tabLabelActive: { color: '#111827' },
  content:        { flex: 1 },
  startBtn:       { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  infoCard:       { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  firmaRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14 },
  firmaOk:        { backgroundColor: '#f0fdf4' },
  firmaNok:       { backgroundColor: '#fffbeb' },
  firmaText:      { flex: 1, fontSize: 13, fontWeight: '600' },
  vaiFirma:       { fontSize: 12, color: '#d97706', fontWeight: '700' },
  label:          { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emailRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  emailInput:     { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 12 },
  emailInfoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  emailInfoText:  { flex: 1, fontSize: 13, color: '#1e40af' },
  emailInfoBold:  { fontWeight: '700' },
  bottomBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  confirmBtn:     { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  nextBtn:        { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  nextBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled:    { opacity: 0.5 },
  reinviaBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12 },
  reinviaBtnText:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  emailEditRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#2563eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#fff' },
  emailEditInput:  { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 8 },
  emailEditOk:     { padding: 6, borderRadius: 8, backgroundColor: '#059669' },
  emailEditCancel: { padding: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
});
