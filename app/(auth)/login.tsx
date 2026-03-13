import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Settings, RotateCcw } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { getApiBase, setApiBase, resetApiBase, getDefaultApiBase } from '../../lib/config';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput]         = useState('');

  useEffect(() => {
    if (showSettings) setUrlInput(getApiBase());
  }, [showSettings]);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/consegne');
    } catch {
      Alert.alert('Errore', 'Email o password non validi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    await setApiBase(url);
    setShowSettings(false);
    Alert.alert('Salvato', `Backend: ${url}`);
  };

  const handleResetUrl = async () => {
    await resetApiBase();
    setUrlInput(getDefaultApiBase());
    Alert.alert('Ripristinato', 'URL backend reimpostato al valore predefinito.');
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <TouchableOpacity style={s.gearBtn} onPress={() => setShowSettings(true)}>
          <Settings size={20} color="#9ca3af" />
        </TouchableOpacity>

        <Text style={s.title}>Consegne</Text>
        <Text style={s.subtitle}>Accedi al tuo account</Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={s.pwdWrap}>
          <TextInput
            style={s.pwdInput}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
          />
          <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={s.pwdEye}>
            {showPwd ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.btn, (!email || !password || loading) && s.btnDisabled]}
          onPress={handleLogin}
          disabled={!email || !password || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Accedi</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Modal configurazione backend */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle}>Configurazione server</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={s.modalClose}>Chiudi</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.lbl}>URL backend (es. https://mioserver.it/api)</Text>
            <TextInput
              style={s.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://..."
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={s.hint}>Predefinito: {getDefaultApiBase()}</Text>

            <TouchableOpacity style={s.saveBtn} onPress={handleSaveUrl}>
              <Text style={s.saveBtnTxt}>Salva</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.resetBtn} onPress={handleResetUrl}>
              <RotateCcw size={15} color="#6b7280" />
              <Text style={s.resetBtnTxt}>Ripristina predefinito</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: '#fff' },
  container:   { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  gearBtn:     { position: 'absolute', top: 16, right: 16, padding: 4 },
  title:       { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 6 },
  subtitle:    { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  input:       { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 14 },
  pwdWrap:     { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, marginBottom: 14 },
  pwdInput:    { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827' },
  pwdEye:      { paddingHorizontal: 14 },
  btn:         { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  // modal
  modalHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalClose:  { fontSize: 15, color: '#2563eb', fontWeight: '600' },
  modalBody:   { padding: 20 },
  lbl:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  urlInput:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827', marginBottom: 6 },
  hint:        { fontSize: 12, color: '#9ca3af', marginBottom: 24 },
  saveBtn:     { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  saveBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  resetBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  resetBtnTxt: { fontSize: 14, color: '#6b7280' },
});
