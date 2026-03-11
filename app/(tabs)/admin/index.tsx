import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Switch,
  KeyboardAvoidingView, Platform, ScrollView, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Plus, X, Pencil, Trash2, Package, Users, FileText,
  Search, Download, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiFetch } from '../../../lib/auth/apiClient';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface UtenteAdmin {
  id: number;
  nome: string;
  email: string;
  ruolo: 'trasportatore' | 'admin';
  attivo: boolean;
  creatoIl: string;
}

interface ConsegnaAdmin {
  id: number;
  clienteNome: string;
  indirizzoConsegna: string;
  dataProgrammata: string;
  statoConsegna: string;
  idTrasportatore: number | null;
  trasportatore: { id: number; nome: string } | null;
  hasDdtPdf: boolean;
  hasDdtFirmato: boolean;
}

const STATO_LABEL: Record<string, string> = {
  da_consegnare: 'Da consegnare',
  in_corso:      'In corso',
  consegnata:    'Consegnata',
  fallita:       'Fallita',
};

const STATO_COLOR: Record<string, { bg: string; text: string }> = {
  da_consegnare: { bg: '#f3f4f6', text: '#374151' },
  in_corso:      { bg: '#dbeafe', text: '#1d4ed8' },
  consegnata:    { bg: '#dcfce7', text: '#15803d' },
  fallita:       { bg: '#fee2e2', text: '#b91c1c' },
};

// ─── Hook API ─────────────────────────────────────────────────────────────────

function useConsegneAdmin() {
  return useQuery<ConsegnaAdmin[]>({
    queryKey: ['admin', 'consegne'],
    queryFn: async () => {
      const r = await apiFetch('/consegne');
      if (!r.ok) throw new Error('Errore fetch consegne');
      return r.json();
    },
    staleTime: 30_000,
  });
}

function useUtentiAdmin() {
  return useQuery<UtenteAdmin[]>({
    queryKey: ['admin', 'utenti'],
    queryFn: async () => {
      const r = await apiFetch('/utenti');
      if (!r.ok) throw new Error('Errore fetch utenti');
      return r.json();
    },
    staleTime: 60_000,
  });
}

function useCreateConsegna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: {
      clienteNome: string; indirizzoConsegna: string; dataProgrammata: string;
      idTrasportatore?: number | null; noteTrasportatore?: string;
    }) => {
      const r = await apiFetch('/consegne', { method: 'POST', body: JSON.stringify(d) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.errore ?? 'Errore'); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

function useUpdateConsegnaAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; idTrasportatore: number | null; statoConsegna: string }) => {
      const r = await apiFetch(`/consegne/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.errore ?? 'Errore'); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

function useDeleteConsegna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/consegne/${id}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 204) throw new Error('Errore eliminazione');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

function useCreateUtente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: { nome: string; email: string; password: string; ruolo: string }) => {
      const r = await apiFetch('/utenti', { method: 'POST', body: JSON.stringify(d) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.errore ?? 'Errore'); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

function useUpdateUtente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; nome: string; email: string; ruolo: string; attivo: boolean; password?: string }) => {
      const body: Record<string, unknown> = { nome: data.nome, email: data.email, ruolo: data.ruolo, attivo: data.attivo };
      if (data.password) body.password = data.password;
      const r = await apiFetch(`/utenti/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.errore ?? 'Errore'); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

function useDeleteUtente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/utenti/${id}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 204) throw new Error('Errore eliminazione');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

function useCleanupConsegne() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ giorni, stati }: { giorni: number; stati: string[] }) => {
      const r = await apiFetch('/consegne/cleanup', { method: 'POST', body: JSON.stringify({ giorni, stati }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.errore ?? 'Errore'); }
      return r.json() as Promise<{ eliminati: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

// ─── Helper download DDT ──────────────────────────────────────────────────────

async function condividiDdtFirmato(id: number, clienteNome: string) {
  try {
    const r = await apiFetch(`/consegne/${id}/ddt-firmato`);
    if (!r.ok) { Alert.alert('Errore', 'DDT firmato non disponibile'); return; }
    const { ddtFirmato } = await r.json();
    if (!ddtFirmato) { Alert.alert('Errore', 'DDT firmato non disponibile'); return; }
    const nome = clienteNome.replace(/[^a-zA-Z0-9]/g, '-');
    const path = FileSystem.cacheDirectory + `DDT-${nome}-${id}.pdf`;
    await FileSystem.writeAsStringAsync(path, ddtFirmato, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: `DDT firmato – ${clienteNome}` });
  } catch {
    Alert.alert('Errore', 'Impossibile scaricare il DDT firmato');
  }
}

// ─── Screen principale ────────────────────────────────────────────────────────

type Tab = 'consegne' | 'utenti' | 'documenti';

export default function AdminScreen() {
  const [tab, setTab] = useState<Tab>('consegne');

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Back Office</Text>
      </View>

      <View style={s.tabBar}>
        {([
          ['consegne',  'Consegne',  Package],
          ['utenti',    'Utenti',    Users],
          ['documenti', 'Documenti', FileText],
        ] as [Tab, string, React.ComponentType<{ size: number; color: string }>][]).map(([key, label, Icon]) => (
          <TouchableOpacity
            key={key}
            style={[s.tabItem, tab === key && s.tabItemActive]}
            onPress={() => setTab(key)}
          >
            <Icon size={15} color={tab === key ? '#2563eb' : '#6b7280'} />
            <Text style={[s.tabLabel, tab === key && s.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'consegne'  && <ConsegnePanel />}
      {tab === 'utenti'    && <UtentiPanel />}
      {tab === 'documenti' && <DocumentiPanel />}
    </View>
  );
}

// ─── ConsegnePanel ────────────────────────────────────────────────────────────

function ConsegnePanel() {
  const { data: consegne, isLoading, isFetching, refetch } = useConsegneAdmin();
  const { data: utenti } = useUtentiAdmin();
  const { mutate: crea, isPending: creando } = useCreateConsegna();
  const { mutate: aggiorna, isPending: aggiornando } = useUpdateConsegnaAdmin();
  const { mutate: elimina } = useDeleteConsegna();
  const { mutate: cleanup, isPending: cleanupLoading } = useCleanupConsegne();

  const [cerca, setCerca] = useState('');
  const [filtroStato, setFiltroStato] = useState('');

  const [modalCrea, setModalCrea] = useState(false);
  const vuotoCrea = { clienteNome: '', indirizzoConsegna: '', dataProgrammata: format(new Date(), 'yyyy-MM-dd'), idTrasportatore: '', noteTrasportatore: '' };
  const [formCrea, setFormCrea] = useState(vuotoCrea);

  const [editConsegna, setEditConsegna] = useState<ConsegnaAdmin | null>(null);
  const [editForm, setEditForm] = useState({ idTrasportatore: '', statoConsegna: '' });

  const [manutenzioneAperta, setManutenzioneAperta] = useState(false);
  const [giorniCleanup, setGiorniCleanup] = useState('90');
  const [statiCleanup, setStatiCleanup] = useState(['consegnata', 'fallita']);

  const trasportatori = useMemo(() => (utenti ?? []).filter(u => u.ruolo === 'trasportatore'), [utenti]);

  const stats = useMemo(() => ({
    da_consegnare: (consegne ?? []).filter(c => c.statoConsegna === 'da_consegnare').length,
    in_corso:      (consegne ?? []).filter(c => c.statoConsegna === 'in_corso').length,
    consegnata:    (consegne ?? []).filter(c => c.statoConsegna === 'consegnata').length,
    fallita:       (consegne ?? []).filter(c => c.statoConsegna === 'fallita').length,
  }), [consegne]);

  const consegneFiltrate = useMemo(() => (consegne ?? []).filter(c => {
    if (filtroStato && c.statoConsegna !== filtroStato) return false;
    if (cerca) {
      const q = cerca.toLowerCase();
      if (!c.clienteNome.toLowerCase().includes(q) && !c.indirizzoConsegna.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [consegne, filtroStato, cerca]);

  const soglia = new Date();
  soglia.setDate(soglia.getDate() - parseInt(giorniCleanup || '90', 10));
  const previewCleanup = (consegne ?? []).filter(c =>
    statiCleanup.includes(c.statoConsegna) && new Date(c.dataProgrammata) < soglia
  ).length;

  const handleCrea = () => {
    if (!formCrea.clienteNome.trim() || !formCrea.indirizzoConsegna.trim() || !formCrea.dataProgrammata.trim()) {
      Alert.alert('Errore', 'Compila i campi obbligatori');
      return;
    }
    crea({
      clienteNome: formCrea.clienteNome.trim(),
      indirizzoConsegna: formCrea.indirizzoConsegna.trim(),
      dataProgrammata: formCrea.dataProgrammata.trim(),
      idTrasportatore: formCrea.idTrasportatore ? parseInt(formCrea.idTrasportatore) : null,
      noteTrasportatore: formCrea.noteTrasportatore.trim() || undefined,
    }, {
      onSuccess: () => { setModalCrea(false); setFormCrea(vuotoCrea); },
      onError: (e: Error) => Alert.alert('Errore', e.message),
    });
  };

  const handleAggiorna = () => {
    if (!editConsegna) return;
    aggiorna({
      id: editConsegna.id,
      idTrasportatore: editForm.idTrasportatore ? parseInt(editForm.idTrasportatore) : null,
      statoConsegna: editForm.statoConsegna,
    }, {
      onSuccess: () => setEditConsegna(null),
      onError: (e: Error) => Alert.alert('Errore', e.message),
    });
  };

  const handleElimina = (id: number, nome: string) => {
    Alert.alert('Elimina consegna', `Eliminare "${nome}"?\nL'operazione non è reversibile.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => elimina(id) },
    ]);
  };

  const handleCleanup = () => {
    if (previewCleanup === 0) { Alert.alert('Nessuna consegna', 'Nessuna consegna corrisponde ai criteri'); return; }
    Alert.alert('Manutenzione DB', `Eliminare ${previewCleanup} consegna/e (con tutti i pagamenti allegati)?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () =>
        cleanup({ giorni: parseInt(giorniCleanup || '90', 10), stati: statiCleanup }, {
          onSuccess: (data: { eliminati: number }) => Alert.alert('Completato', `${data.eliminati} consegna/e eliminate`),
          onError: (e: Error) => Alert.alert('Errore', e.message),
        })
      },
    ]);
  };

  const openEdit = (c: ConsegnaAdmin) => {
    setEditConsegna(c);
    setEditForm({ idTrasportatore: c.idTrasportatore?.toString() ?? '', statoConsegna: c.statoConsegna });
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  return (
    <View style={s.flex}>
      {/* Stats */}
      <View style={s.statsRow}>
        {(Object.keys(STATO_LABEL) as string[]).map(stato => (
          <TouchableOpacity
            key={stato}
            style={[s.statChip, { backgroundColor: STATO_COLOR[stato].bg }, filtroStato === stato && s.statChipSelected]}
            onPress={() => setFiltroStato(f => f === stato ? '' : stato)}
          >
            <Text style={[s.statNum, { color: STATO_COLOR[stato].text }]}>
              {stats[stato as keyof typeof stats]}
            </Text>
            <Text style={[s.statLabelTxt, { color: STATO_COLOR[stato].text }]} numberOfLines={1}>
              {STATO_LABEL[stato].split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          placeholder="Cerca cliente o indirizzo..."
          value={cerca}
          onChangeText={setCerca}
          placeholderTextColor="#9ca3af"
        />
        {!!cerca && <TouchableOpacity onPress={() => setCerca('')}><X size={16} color="#9ca3af" /></TouchableOpacity>}
      </View>

      {/* Lista */}
      <FlatList
        data={consegneFiltrate}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#2563eb']} />}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<Text style={s.emptyText}>Nessuna consegna trovata</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardCliente} numberOfLines={1}>{item.clienteNome}</Text>
              <View style={[s.statoBadge, { backgroundColor: STATO_COLOR[item.statoConsegna]?.bg ?? '#f3f4f6' }]}>
                <Text style={[s.statoBadgeTxt, { color: STATO_COLOR[item.statoConsegna]?.text ?? '#374151' }]}>
                  {STATO_LABEL[item.statoConsegna] ?? item.statoConsegna}
                </Text>
              </View>
            </View>
            <Text style={s.cardSub} numberOfLines={1}>{item.indirizzoConsegna}</Text>
            <Text style={s.cardMeta}>
              {format(new Date(item.dataProgrammata), 'dd/MM/yyyy', { locale: it })}
              {item.trasportatore ? ` · ${item.trasportatore.nome}` : ''}
            </Text>
            <View style={s.cardActions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(item)}>
                <Pencil size={13} color="#2563eb" />
                <Text style={s.actionBtnTxt}>Modifica</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnRed]} onPress={() => handleElimina(item.id, item.clienteNome)}>
                <Trash2 size={13} color="#dc2626" />
                <Text style={[s.actionBtnTxt, { color: '#dc2626' }]}>Elimina</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={s.manutenzioneBox}>
            <TouchableOpacity style={s.manutenzioneHdr} onPress={() => setManutenzioneAperta(v => !v)}>
              <Text style={s.manutenzioneTitle}>Manutenzione DB</Text>
              {manutenzioneAperta
                ? <ChevronUp size={16} color="#6b7280" />
                : <ChevronDown size={16} color="#6b7280" />}
            </TouchableOpacity>
            {manutenzioneAperta && (
              <View style={s.manutenzioneBody}>
                <Text style={s.manutenzioneLabel}>Elimina consegne più vecchie di (giorni):</Text>
                <TextInput
                  style={s.manutenzioneInput}
                  value={giorniCleanup}
                  onChangeText={setGiorniCleanup}
                  keyboardType="numeric"
                  maxLength={4}
                />
                <Text style={s.manutenzioneLabel}>Stato consegna:</Text>
                <View style={s.checkRow}>
                  {(['consegnata', 'fallita'] as string[]).map(stato => (
                    <TouchableOpacity
                      key={stato}
                      style={[s.checkChip, statiCleanup.includes(stato) && s.checkChipOn]}
                      onPress={() => setStatiCleanup(s => s.includes(stato) ? s.filter(x => x !== stato) : [...s, stato])}
                    >
                      <Text style={[s.checkChipTxt, statiCleanup.includes(stato) && s.checkChipTxtOn]}>
                        {STATO_LABEL[stato]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.previewTxt}>Consegne che verranno eliminate: <Text style={{ fontWeight: '700' }}>{previewCleanup}</Text></Text>
                <TouchableOpacity
                  style={[s.cleanupBtn, (cleanupLoading || previewCleanup === 0) && s.btnDisabled]}
                  onPress={handleCleanup}
                  disabled={cleanupLoading || previewCleanup === 0}
                >
                  {cleanupLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Trash2 size={14} color="#fff" />}
                  <Text style={s.cleanupBtnTxt}>Esegui pulizia</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setModalCrea(true)}>
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal Nuova Consegna */}
      <Modal visible={modalCrea} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalCrea(false)}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle}>Nuova Consegna</Text>
            <TouchableOpacity onPress={() => setModalCrea(false)}><X size={22} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLbl}>Cliente *</Text>
            <TextInput style={s.field} value={formCrea.clienteNome} onChangeText={v => setFormCrea(f => ({ ...f, clienteNome: v }))} placeholder="Nome cliente" placeholderTextColor="#9ca3af" />
            <Text style={s.fieldLbl}>Indirizzo *</Text>
            <TextInput style={s.field} value={formCrea.indirizzoConsegna} onChangeText={v => setFormCrea(f => ({ ...f, indirizzoConsegna: v }))} placeholder="Via, numero, città" placeholderTextColor="#9ca3af" />
            <Text style={s.fieldLbl}>Data (YYYY-MM-DD) *</Text>
            <TextInput style={s.field} value={formCrea.dataProgrammata} onChangeText={v => setFormCrea(f => ({ ...f, dataProgrammata: v }))} placeholder="2025-01-15" placeholderTextColor="#9ca3af" />
            <Text style={s.fieldLbl}>Trasportatore</Text>
            <View style={s.pickerRow}>
              {[{ id: '', nome: 'Nessuno' }, ...trasportatori.map(t => ({ id: t.id.toString(), nome: t.nome }))].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.pickerChip, formCrea.idTrasportatore === t.id && s.pickerChipOn]}
                  onPress={() => setFormCrea(f => ({ ...f, idTrasportatore: t.id }))}
                >
                  <Text style={[s.pickerChipTxt, formCrea.idTrasportatore === t.id && s.pickerChipTxtOn]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLbl}>Note</Text>
            <TextInput style={[s.field, s.fieldMultiline]} value={formCrea.noteTrasportatore} onChangeText={v => setFormCrea(f => ({ ...f, noteTrasportatore: v }))} placeholder="Note opzionali" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
          </ScrollView>
          <View style={s.modalFtr}>
            <TouchableOpacity style={[s.btnPrimary, creando && s.btnDisabled]} onPress={handleCrea} disabled={creando}>
              {creando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimaryTxt}>Crea consegna</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Modifica Consegna */}
      <Modal visible={!!editConsegna} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditConsegna(null)}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle} numberOfLines={1}>{editConsegna?.clienteNome}</Text>
            <TouchableOpacity onPress={() => setEditConsegna(null)}><X size={22} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLbl}>Stato</Text>
            <View style={s.pickerRow}>
              {(Object.entries(STATO_LABEL) as [string, string][]).map(([stato, label]) => (
                <TouchableOpacity
                  key={stato}
                  style={[s.pickerChip, editForm.statoConsegna === stato && s.pickerChipOn]}
                  onPress={() => setEditForm(f => ({ ...f, statoConsegna: stato }))}
                >
                  <Text style={[s.pickerChipTxt, editForm.statoConsegna === stato && s.pickerChipTxtOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLbl}>Trasportatore</Text>
            <View style={s.pickerRow}>
              {[{ id: '', nome: 'Nessuno' }, ...trasportatori.map(t => ({ id: t.id.toString(), nome: t.nome }))].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.pickerChip, editForm.idTrasportatore === t.id && s.pickerChipOn]}
                  onPress={() => setEditForm(f => ({ ...f, idTrasportatore: t.id }))}
                >
                  <Text style={[s.pickerChipTxt, editForm.idTrasportatore === t.id && s.pickerChipTxtOn]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={s.modalFtr}>
            <TouchableOpacity style={[s.btnPrimary, aggiornando && s.btnDisabled]} onPress={handleAggiorna} disabled={aggiornando}>
              {aggiornando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimaryTxt}>Salva modifiche</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── UtentiPanel ──────────────────────────────────────────────────────────────

function UtentiPanel() {
  const { data: utenti, isLoading, isFetching, refetch } = useUtentiAdmin();
  const { mutate: crea, isPending: creando } = useCreateUtente();
  const { mutate: aggiorna, isPending: aggiornando } = useUpdateUtente();
  const { mutate: elimina } = useDeleteUtente();

  const [modalCrea, setModalCrea] = useState(false);
  const vuotoCrea: { nome: string; email: string; password: string; ruolo: 'trasportatore' | 'admin' } =
    { nome: '', email: '', password: '', ruolo: 'trasportatore' };
  const [formCrea, setFormCrea] = useState(vuotoCrea);

  const [editUtente, setEditUtente] = useState<UtenteAdmin | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', email: '', ruolo: 'trasportatore' as 'trasportatore' | 'admin', attivo: true, password: '' });

  const openEdit = (u: UtenteAdmin) => {
    setEditUtente(u);
    setFormEdit({ nome: u.nome, email: u.email, ruolo: u.ruolo, attivo: u.attivo, password: '' });
  };

  const handleCrea = () => {
    if (!formCrea.nome.trim() || !formCrea.email.trim() || !formCrea.password.trim()) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }
    crea(formCrea, {
      onSuccess: () => { setModalCrea(false); setFormCrea(vuotoCrea); },
      onError: (e: Error) => Alert.alert('Errore', e.message),
    });
  };

  const handleAggiorna = () => {
    if (!editUtente) return;
    aggiorna({ id: editUtente.id, ...formEdit }, {
      onSuccess: () => setEditUtente(null),
      onError: (e: Error) => Alert.alert('Errore', e.message),
    });
  };

  const handleElimina = (u: UtenteAdmin) => {
    Alert.alert('Elimina utente', `Eliminare "${u.nome}"?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => elimina(u.id) },
    ]);
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  return (
    <View style={s.flex}>
      <FlatList
        data={utenti ?? []}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#2563eb']} />}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<Text style={s.emptyText}>Nessun utente trovato</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, !item.attivo && s.cardInattivo]}>
            <View style={s.cardHeader}>
              <View style={s.flex}>
                <Text style={s.cardCliente}>{item.nome}</Text>
                <Text style={s.cardSub}>{item.email}</Text>
              </View>
              <View style={s.utenteRight}>
                <View style={[s.ruoloBadge, item.ruolo === 'admin' && s.ruoloBadgeAdmin]}>
                  <Text style={[s.ruoloBadgeTxt, item.ruolo === 'admin' && s.ruoloBadgeAdminTxt]}>{item.ruolo}</Text>
                </View>
                {!item.attivo && <Text style={s.inattivoTxt}>Inattivo</Text>}
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(item)}>
                <Pencil size={13} color="#2563eb" />
                <Text style={s.actionBtnTxt}>Modifica</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnRed]} onPress={() => handleElimina(item)}>
                <Trash2 size={13} color="#dc2626" />
                <Text style={[s.actionBtnTxt, { color: '#dc2626' }]}>Elimina</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={s.fab} onPress={() => setModalCrea(true)}>
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal Nuovo Utente */}
      <Modal visible={modalCrea} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalCrea(false)}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle}>Nuovo Utente</Text>
            <TouchableOpacity onPress={() => setModalCrea(false)}><X size={22} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLbl}>Nome *</Text>
            <TextInput style={s.field} value={formCrea.nome} onChangeText={v => setFormCrea(f => ({ ...f, nome: v }))} placeholder="Nome cognome" placeholderTextColor="#9ca3af" />
            <Text style={s.fieldLbl}>Email *</Text>
            <TextInput style={s.field} value={formCrea.email} onChangeText={v => setFormCrea(f => ({ ...f, email: v }))} placeholder="email@esempio.it" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.fieldLbl}>Password *</Text>
            <TextInput style={s.field} value={formCrea.password} onChangeText={v => setFormCrea(f => ({ ...f, password: v }))} placeholder="Password" placeholderTextColor="#9ca3af" secureTextEntry />
            <Text style={s.fieldLbl}>Ruolo</Text>
            <View style={s.pickerRow}>
              {(['trasportatore', 'admin'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.pickerChip, formCrea.ruolo === r && s.pickerChipOn]}
                  onPress={() => setFormCrea(f => ({ ...f, ruolo: r }))}
                >
                  <Text style={[s.pickerChipTxt, formCrea.ruolo === r && s.pickerChipTxtOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={s.modalFtr}>
            <TouchableOpacity style={[s.btnPrimary, creando && s.btnDisabled]} onPress={handleCrea} disabled={creando}>
              {creando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimaryTxt}>Crea utente</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Modifica Utente */}
      <Modal visible={!!editUtente} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditUtente(null)}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle} numberOfLines={1}>Modifica {editUtente?.nome}</Text>
            <TouchableOpacity onPress={() => setEditUtente(null)}><X size={22} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLbl}>Nome *</Text>
            <TextInput style={s.field} value={formEdit.nome} onChangeText={v => setFormEdit(f => ({ ...f, nome: v }))} placeholderTextColor="#9ca3af" />
            <Text style={s.fieldLbl}>Email *</Text>
            <TextInput style={s.field} value={formEdit.email} onChangeText={v => setFormEdit(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9ca3af" />
            <Text style={s.fieldLbl}>Nuova password (lascia vuoto per non cambiare)</Text>
            <TextInput style={s.field} value={formEdit.password} onChangeText={v => setFormEdit(f => ({ ...f, password: v }))} placeholder="••••••••" placeholderTextColor="#9ca3af" secureTextEntry />
            <Text style={s.fieldLbl}>Ruolo</Text>
            <View style={s.pickerRow}>
              {(['trasportatore', 'admin'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.pickerChip, formEdit.ruolo === r && s.pickerChipOn]}
                  onPress={() => setFormEdit(f => ({ ...f, ruolo: r }))}
                >
                  <Text style={[s.pickerChipTxt, formEdit.ruolo === r && s.pickerChipTxtOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.switchRow}>
              <Text style={s.fieldLbl}>Utente attivo</Text>
              <Switch
                value={formEdit.attivo}
                onValueChange={v => setFormEdit(f => ({ ...f, attivo: v }))}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={formEdit.attivo ? '#2563eb' : '#9ca3af'}
              />
            </View>
          </ScrollView>
          <View style={s.modalFtr}>
            <TouchableOpacity style={[s.btnPrimary, aggiornando && s.btnDisabled]} onPress={handleAggiorna} disabled={aggiornando}>
              {aggiornando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnPrimaryTxt}>Salva modifiche</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── DocumentiPanel ───────────────────────────────────────────────────────────

function DocumentiPanel() {
  const { data: consegne, isLoading, isFetching, refetch } = useConsegneAdmin();
  const { data: utenti } = useUtentiAdmin();
  const [cerca, setCerca] = useState('');
  const [filtroTrasp, setFiltroTrasp] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);

  const trasportatori = useMemo(() => (utenti ?? []).filter(u => u.ruolo === 'trasportatore'), [utenti]);

  const conDocumenti = useMemo(() => (consegne ?? []).filter(c => {
    if (!c.hasDdtFirmato) return false;
    if (filtroTrasp && c.idTrasportatore?.toString() !== filtroTrasp) return false;
    if (cerca) {
      const q = cerca.toLowerCase();
      if (!c.clienteNome.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [consegne, filtroTrasp, cerca]);

  const handleDownload = async (c: ConsegnaAdmin) => {
    setDownloading(c.id);
    await condividiDdtFirmato(c.id, c.clienteNome);
    setDownloading(null);
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  return (
    <View style={s.flex}>
      {/* Search */}
      <View style={s.searchRow}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          placeholder="Cerca cliente..."
          value={cerca}
          onChangeText={setCerca}
          placeholderTextColor="#9ca3af"
        />
        {!!cerca && <TouchableOpacity onPress={() => setCerca('')}><X size={16} color="#9ca3af" /></TouchableOpacity>}
      </View>

      {/* Filtro trasportatore */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterScrollContent}>
        <TouchableOpacity style={[s.filterChip, filtroTrasp === '' && s.filterChipOn]} onPress={() => setFiltroTrasp('')}>
          <Text style={[s.filterChipTxt, filtroTrasp === '' && s.filterChipTxtOn]}>Tutti</Text>
        </TouchableOpacity>
        {trasportatori.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.filterChip, filtroTrasp === t.id.toString() && s.filterChipOn]}
            onPress={() => setFiltroTrasp(t.id.toString())}
          >
            <Text style={[s.filterChipTxt, filtroTrasp === t.id.toString() && s.filterChipTxtOn]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={conDocumenti}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={['#2563eb']} />}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<Text style={s.emptyText}>Nessun documento firmato trovato</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardCliente} numberOfLines={1}>{item.clienteNome}</Text>
              <View style={[s.statoBadge, { backgroundColor: STATO_COLOR[item.statoConsegna]?.bg ?? '#f3f4f6' }]}>
                <Text style={[s.statoBadgeTxt, { color: STATO_COLOR[item.statoConsegna]?.text ?? '#374151' }]}>
                  {STATO_LABEL[item.statoConsegna] ?? item.statoConsegna}
                </Text>
              </View>
            </View>
            <Text style={s.cardMeta}>
              {format(new Date(item.dataProgrammata), 'dd/MM/yyyy', { locale: it })}
              {item.trasportatore ? ` · ${item.trasportatore.nome}` : ''}
            </Text>
            <View style={s.cardActions}>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => handleDownload(item)}
                disabled={downloading === item.id}
              >
                {downloading === item.id
                  ? <ActivityIndicator size="small" color="#2563eb" />
                  : <Download size={13} color="#2563eb" />}
                <Text style={s.actionBtnTxt}>DDT firmato</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f8fafc' },
  flex:        { flex: 1 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:      { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },

  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 5 },
  tabItemActive: { borderBottomColor: '#2563eb' },
  tabLabel:      { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  tabLabelActive:{ color: '#2563eb' },

  statsRow:    { flexDirection: 'row', padding: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  statChip:    { flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 2, borderColor: 'transparent' },
  statChipSelected: { borderColor: '#2563eb' },
  statNum:     { fontSize: 20, fontWeight: '700' },
  statLabelTxt:{ fontSize: 10, fontWeight: '500', marginTop: 1 },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 10, marginBottom: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },

  filterScroll:       { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterScrollContent:{ paddingHorizontal: 8, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  filterChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipOn:  { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  filterChipTxt: { fontSize: 13, lineHeight: 20, color: '#374151' },
  filterChipTxtOn: { color: '#1d4ed8', fontWeight: '600' },

  listContent: { padding: 12, paddingBottom: 90 },
  emptyText:   { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 14 },

  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardInattivo: { opacity: 0.55 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardCliente:  { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  cardSub:      { fontSize: 13, color: '#4b5563', marginBottom: 2 },
  cardMeta:     { fontSize: 12, color: '#6b7280' },
  cardActions:  { flexDirection: 'row', gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#eff6ff' },
  actionBtnRed: { backgroundColor: '#fef2f2' },
  actionBtnTxt: { fontSize: 13, color: '#2563eb', fontWeight: '500' },

  statoBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, flexShrink: 0 },
  statoBadgeTxt: { fontSize: 11, fontWeight: '600' },

  utenteRight:     { alignItems: 'flex-end', gap: 3 },
  ruoloBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: '#f3f4f6' },
  ruoloBadgeAdmin: { backgroundColor: '#fef3c7' },
  ruoloBadgeTxt:   { fontSize: 11, fontWeight: '600', color: '#374151' },
  ruoloBadgeAdminTxt: { color: '#92400e' },
  inattivoTxt:     { fontSize: 10, color: '#ef4444', fontWeight: '700' },

  manutenzioneBox:   { marginTop: 8, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  manutenzioneHdr:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  manutenzioneTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  manutenzioneBody:  { padding: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  manutenzioneLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  manutenzioneInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 80, fontSize: 14, color: '#111827', marginBottom: 12 },
  checkRow:          { flexDirection: 'row', gap: 8, marginBottom: 12 },
  checkChip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  checkChipOn:       { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  checkChipTxt:      { fontSize: 13, color: '#374151' },
  checkChipTxtOn:    { color: '#1d4ed8', fontWeight: '600' },
  previewTxt:        { fontSize: 13, color: '#374151', marginBottom: 12 },
  cleanupBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10 },
  cleanupBtnTxt:     { color: '#fff', fontSize: 14, fontWeight: '600' },

  fab:           { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },

  modalHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  modalBody:   { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  modalFtr:    { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },

  fieldLbl:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 14 },
  field:         { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  fieldMultiline:{ height: 80, textAlignVertical: 'top' },

  pickerRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  pickerChipOn:      { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pickerChipTxt:     { fontSize: 13, color: '#374151' },
  pickerChipTxtOn:   { color: '#fff', fontWeight: '600' },

  switchRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingVertical: 4 },

  btnPrimary:    { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:   { opacity: 0.55 },
  btnPrimaryTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
