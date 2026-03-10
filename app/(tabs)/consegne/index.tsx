import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../../hooks/useAuth';
import { useConsegne } from '../../../lib/api/consegne';
import { ConsegnaCard } from '../../../components/consegne/ConsegnaCard';
import { SyncIndicator } from '../../../components/sync/SyncIndicator';

const oggi = format(new Date(), 'yyyy-MM-dd');

export default function ConsegneScreen() {
  const { utente, idTrasportatore, logout } = useAuth();
  const router = useRouter();
  const [filtroData, setFiltroData] = useState(oggi);
  const [mostraConsegnate, setMostraConsegnate] = useState(false);

  const { data: consegne = [], isLoading, refetch, isRefetching } = useConsegne(idTrasportatore ?? 0);

  const filtrate = consegne.filter(c => {
    const dataC = format(new Date(c.dataProgrammata), 'yyyy-MM-dd');
    return dataC === filtroData && (mostraConsegnate || c.statoConsegna !== 'consegnata');
  });

  const primoNome = utente?.nome?.split(' ')[0] ?? '';
  const oggiLabel = format(new Date(), "EEEE d MMMM", { locale: it });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>{oggiLabel}</Text>
          <Text style={s.headerTitle}>{primoNome ? `Ciao, ${primoNome}` : 'Le mie consegne'}</Text>
        </View>
        <SyncIndicator />
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Esci</Text>
        </TouchableOpacity>
      </View>

      {/* Selettore data */}
      <View style={s.datePicker}>
        <TouchableOpacity onPress={() => setFiltroData(format(addDays(new Date(filtroData), -1), 'yyyy-MM-dd'))}>
          <ChevronLeft size={20} color="#6b7280" />
        </TouchableOpacity>
        <Text style={s.dateText}>{format(new Date(filtroData), 'EEEE d MMMM yyyy', { locale: it })}</Text>
        <TouchableOpacity onPress={() => setFiltroData(format(addDays(new Date(filtroData), 1), 'yyyy-MM-dd'))}>
          <ChevronRight size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {isLoading
        ? <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
        : (
          <FlatList
            data={filtrate}
            keyExtractor={c => String(c.localId ?? c.id)}
            renderItem={({ item, index }) => (
              <ConsegnaCard
                consegna={item}
                numero={index + 1}
                onPress={() => router.push(`/(tabs)/consegne/${item.id ?? item.localId}`)}
              />
            )}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            ListEmptyComponent={
              <View style={s.emptyContainer}>
                <Text style={s.emptyText}>Nessuna consegna per questa data</Text>
              </View>
            }
          />
        )
      }
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },
  header:         { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerSub:      { fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' },
  headerTitle:    { fontSize: 20, fontWeight: '800', color: '#111827' },
  logoutBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f3f4f6' },
  logoutText:     { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  datePicker:     { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dateText:       { fontSize: 14, fontWeight: '600', color: '#374151', textTransform: 'capitalize' },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText:      { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
