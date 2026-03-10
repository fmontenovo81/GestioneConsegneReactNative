import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function SyncIndicator() {
  const isOnline = useOnlineStatus();
  return (
    <View style={[s.badge, isOnline ? s.online : s.offline]}>
      <View style={[s.dot, isOnline ? s.dotOnline : s.dotOffline]} />
      <Text style={[s.text, isOnline ? s.textOnline : s.textOffline]}>
        {isOnline ? 'Online' : 'Offline'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  online:      { backgroundColor: '#f0fdf4' },
  offline:     { backgroundColor: '#fef2f2' },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  dotOnline:   { backgroundColor: '#22c55e' },
  dotOffline:  { backgroundColor: '#ef4444' },
  text:        { fontSize: 11, fontWeight: '700' },
  textOnline:  { color: '#166534' },
  textOffline: { color: '#991b1b' },
});
