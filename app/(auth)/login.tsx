import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      Alert.alert('Errore', 'Email o password non validi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
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
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
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
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 },
  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  title:      { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 6 },
  subtitle:   { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  input:      { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 14 },
  btn:        { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});
