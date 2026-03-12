import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { RefreshCw, MapPin } from 'lucide-react-native';
import { apiFetch } from '../../../lib/auth/apiClient';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Posizione {
  idTrasportatore: number;
  nome: string;
  email: string;
  latitudine: number;
  longitudine: number;
  timestampRilevazione: string;
  consegneOggi: number;
  consegneCompletate: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function usePosizioni() {
  return useQuery<Posizione[]>({
    queryKey: ['admin', 'posizioni'],
    queryFn: async () => {
      const r = await apiFetch('/posizioni/ultime');
      if (!r.ok) throw new Error('Errore fetch posizioni');
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function initials(nome: string): string {
  return nome.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

function isStale(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() > 30 * 60 * 1000;
}

function buildHtml(posizioni: Posizione[]): string {
  let centerLat = 41.9, centerLon = 12.5, zoom = 6;
  if (posizioni.length === 1) {
    centerLat = posizioni[0].latitudine;
    centerLon = posizioni[0].longitudine;
    zoom = 13;
  } else if (posizioni.length > 1) {
    centerLat = posizioni.reduce((s, p) => s + p.latitudine, 0) / posizioni.length;
    centerLon = posizioni.reduce((s, p) => s + p.longitudine, 0) / posizioni.length;
    zoom = 9;
  }

  const markersJs = posizioni.map(p => {
    const stale     = isStale(p.timestampRilevazione);
    const colore    = stale ? '#9ca3af' : '#1d4ed8';
    const bordo     = stale ? '#6b7280' : '#1e40af';
    const ini       = initials(p.nome);
    const pulse     = !stale
      ? `<div style="position:absolute;inset:0;border-radius:50%;background:${colore};opacity:.3;animation:ping 2s ease-in-out infinite;"></div>`
      : '';

    const markerHtml = `
      <div style="position:relative;width:40px;height:48px;">
        ${pulse}
        <div style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;
          background:${colore};border:3px solid ${bordo};box-shadow:0 2px 8px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:700;font-size:13px;font-family:system-ui;">${ini}</div>
        <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
          border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:8px solid ${bordo};"></div>
      </div>`;

    return `(function(){
      var icon = L.divIcon({ html: \`${markerHtml}\`, className:'', iconSize:[40,48], iconAnchor:[20,48], popupAnchor:[0,-52] });
      var m = L.marker([${p.latitudine},${p.longitudine}], { icon:icon }).addTo(map);
      m.on('click', function(){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({id:${p.idTrasportatore}})); });
    })();`;
  }).join('\n');

  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
  @keyframes ping{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.4);opacity:.3}}</style>
  </head><body><div id="map"></div><script>
  var map = L.map('map',{zoomControl:true}).setView([${centerLat},${centerLon}],${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
  ${markersJs}
  </script></body></html>`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MappaScreen() {
  const { data: posizioni, isLoading, isFetching, refetch } = usePosizioni();
  const [selezionato, setSelezionato] = useState<number | null>(null);
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(() => {
    if (!posizioni || posizioni.length === 0) return null;
    return buildHtml(posizioni);
  }, [posizioni]);

  // Centra la mappa sul trasportatore selezionato via injectJavaScript
  useEffect(() => {
    if (!selezionato || !posizioni) return;
    const p = posizioni.find(pos => pos.idTrasportatore === selezionato);
    if (!p) return;
    webViewRef.current?.injectJavaScript(`
      if (typeof map !== 'undefined') {
        map.flyTo([${p.latitudine}, ${p.longitudine}], 14, { duration: 1.2 });
      }
      true;
    `);
  }, [selezionato]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.id) setSelezionato((prev) => prev === data.id ? null : data.id);
    } catch {}
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Mappa GPS</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={() => refetch()} disabled={isFetching}>
          {isFetching
            ? <ActivityIndicator size="small" color="#2563eb" />
            : <RefreshCw size={18} color="#2563eb" />}
        </TouchableOpacity>
      </View>

      {/* Mappa */}
      <View style={s.mapContainer}>
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : html ? (
          <WebView
            ref={webViewRef}
            source={{ html }}
            style={s.webView}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />
        ) : (
          <View style={s.center}>
            <MapPin size={40} color="#d1d5db" />
            <Text style={s.emptyTxt}>Nessuna posizione disponibile</Text>
            <Text style={s.emptySubTxt}>Le posizioni vengono aggiornate ogni 5 minuti</Text>
          </View>
        )}
      </View>

      {/* Barra trasportatori */}
      {posizioni && posizioni.length > 0 && (
        <View style={s.bar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.barContent}
          >
            {posizioni.map(p => {
              const stale  = isStale(p.timestampRilevazione);
              const attivo = selezionato === p.idTrasportatore;
              return (
                <TouchableOpacity
                  key={p.idTrasportatore}
                  style={[s.card, attivo && s.cardAttivo]}
                  onPress={() => setSelezionato(prev => prev === p.idTrasportatore ? null : p.idTrasportatore)}
                >
                  <View style={[s.avatar, { backgroundColor: stale ? '#9ca3af' : '#1d4ed8' }]}>
                    <Text style={s.avatarTxt}>{initials(p.nome)}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <View style={s.cardRow}>
                      <Text style={s.cardNome} numberOfLines={1}>{p.nome}</Text>
                      <View style={[s.dot, { backgroundColor: stale ? '#9ca3af' : '#22c55e' }]} />
                    </View>
                    <Text style={s.cardStats}>{p.consegneCompletate}/{p.consegneOggi} consegne</Text>
                    <Text style={s.cardTime} numberOfLines={1}>
                      {formatDistanceToNow(new Date(p.timestampRilevazione), { addSuffix: true, locale: it })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#f8fafc' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#111827' },
  refreshBtn:   { padding: 8 },

  mapContainer: { flex: 1 },
  webView:      { flex: 1 },

  emptyTxt:     { fontSize: 15, color: '#6b7280', marginTop: 12 },
  emptySubTxt:  { fontSize: 12, color: '#9ca3af', marginTop: 4 },

  bar:          { height: 88, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  barContent:   { paddingHorizontal: 8, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },

  card:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', minWidth: 160 },
  cardAttivo:   { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  avatar:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardInfo:     { flex: 1 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardNome:     { fontSize: 13, fontWeight: '700', color: '#111827', flex: 1 },
  dot:          { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  cardStats:    { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  cardTime:     { fontSize: 11, color: '#6b7280', marginTop: 1 },
});
