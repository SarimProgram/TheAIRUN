// ConnectionStatus.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { API_BASE_URL } from '../../config/api'; // adjust path as needed

type Status = 'idle' | 'loading' | 'ok' | 'error';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        setStatus('loading');
        const res = await fetch(`${API_BASE_URL}/health`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setStatus('ok');
        setMessage(`Backend OK – ${data.status}`);
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message ?? 'Unable to reach server');
      }
    };

    checkConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection</Text>

      {status === 'loading' && (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.text}>  Checking server…</Text>
        </View>
      )}

      {status === 'ok' && (
        <Text style={[styles.text, styles.ok]}>
          Frontend: listening ✅{'\n'}
          Server: connected to {API_BASE_URL}
        </Text>
      )}

      {status === 'error' && (
        <Text style={[styles.text, styles.error]}>
          Frontend: listening ✅{'\n'}
          Server: not reachable ❌{'\n'}
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  title: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
  },
  ok: {
    color: 'green',
  },
  error: {
    color: 'red',
  },
});
