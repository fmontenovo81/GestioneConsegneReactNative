import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ConsegnaLocale } from '../../lib/db/sqlite';

const STATO_COLORS: Record<string, { bg: string; text: string; pill: string }> = {
  da_consegnare: { bg: '#fff',     text: '#374151', pill: '#e5e7eb' },
  in_corso:      { bg: '#eff6ff',  text: '#1d4ed8', pill: '#bfdbfe' },
  consegnata:    { bg: '#f0fdf4',  text: '#166534', pill: '#bbf7d0' },
  fallita:       { bg: '#fef2f2',  text: '#991b1b', pill: '#fecaca' },
};

const STATO_LABEL: Record<string, string> = {
  da_consegnare: 'Da consegnare',
  in_corso:      'In corso',
  consegnata:    'Consegnata',
  fallita:       'Fallita',
};

interface Props {
  consegna: ConsegnaLocale;
  numero: number;
  onPress?: () => void;
  trasportatoreNome?: string;
}

export function ConsegnaCard({ consegna, numero, onPress, trasportatoreNome }: Props) {
  const colors = STATO_COLORS[consegna.statoConsegna] ?? STATO_COLORS.da_consegnare;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.card, { backgroundColor: colors.bg }]}
    >
      <View style={[s.numero, { backgroundColor: colors.pill }]}>
        <Text style={[s.numeroText, { color: colors.text }]}>{numero}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.nome} numberOfLines={1}>{consegna.clienteNome}</Text>
        <Text style={s.indirizzo} numberOfLines={1}>{consegna.indirizzoConsegna}</Text>
        {trasportatoreNome && (
          <Text style={s.trasportatore}>{trasportatoreNome}</Text>
        )}
      </View>
      <View style={[s.badge, { backgroundColor: colors.pill }]}>
        <Text style={[s.badgeText, { color: colors.text }]}>
          {STATO_LABEL[consegna.statoConsegna]}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9', gap: 12 },
  numero:        { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numeroText:    { fontWeight: '800', fontSize: 15 },
  info:          { flex: 1 },
  nome:          { fontSize: 15, fontWeight: '700', color: '#111827' },
  indirizzo:     { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  trasportatore: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  badge:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText:     { fontSize: 11, fontWeight: '700' },
});
