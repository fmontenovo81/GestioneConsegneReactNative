import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>Back Office</Text>
      <Text style={s.sub}>Gestione consegne, utenti e documenti.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24, paddingTop: 64 },
  title:     { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sub:       { fontSize: 14, color: '#6b7280' },
});
