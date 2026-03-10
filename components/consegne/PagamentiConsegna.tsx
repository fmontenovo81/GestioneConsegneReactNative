import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Banknote, CreditCard, Building2 } from 'lucide-react-native';
import { usePagamenti } from '../../lib/api/pagamenti';

const METODO_ICON: Record<string, any> = {
  contanti: Banknote,
  carta:    CreditCard,
  bonifico: Building2,
};
const METODO_LABEL: Record<string, string> = {
  contanti: 'Contanti',
  carta:    'Carta',
  bonifico: 'Bonifico',
};

function formatEuro(val: number) {
  return val.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

interface Props {
  consegnaServerId?: number;
}

export function PagamentiConsegna({ consegnaServerId }: Props) {
  const { data: pagamenti = [], isLoading } = usePagamenti(consegnaServerId);

  return (
    <View style={s.container}>
      <Text style={s.titolo}>Incassi</Text>
      {isLoading && <ActivityIndicator color="#2563eb" />}
      {!isLoading && pagamenti.length === 0 && (
        <Text style={s.vuoto}>Nessun incasso registrato</Text>
      )}
      {pagamenti.map((p, i) => {
        const Icona = METODO_ICON[p.metodo] ?? Banknote;
        return (
          <View key={p.id ?? p.localId ?? i} style={s.riga}>
            <View style={s.iconWrap}>
              <Icona size={16} color="#2563eb" />
            </View>
            <View style={s.info}>
              <Text style={s.metodo}>{METODO_LABEL[p.metodo]}</Text>
              {p.note && <Text style={s.note}>{p.note}</Text>}
            </View>
            <Text style={s.importo}>{formatEuro(p.importo)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  titolo:    { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  vuoto:     { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  riga:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  iconWrap:  { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  info:      { flex: 1 },
  metodo:    { fontSize: 14, fontWeight: '600', color: '#374151' },
  note:      { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  importo:   { fontSize: 15, fontWeight: '800', color: '#111827' },
});
