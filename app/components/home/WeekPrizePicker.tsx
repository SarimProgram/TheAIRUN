import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRESETS = ['a massage', 'dinner', 'coffee', 'a movie night', 'breakfast in bed', 'a day off chores'];

type Props = {
  visible: boolean;
  currentPrize: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (prize: string) => Promise<void>;
  title?: string;
  description?: string;
};

export default function WeekPrizePicker({
  visible,
  currentPrize,
  saving,
  onClose,
  onSave,
  title = 'This week’s prize',
  description = 'Choose what the winner gets. Your partner will see the same prize.',
}: Props) {
  const [selected, setSelected] = useState('a massage');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const colors = dark
    ? { background: '#111827', card: '#1F2937', ink: '#F8FAFC', muted: '#CBD5E1', border: '#475569', selected: '#492D35' }
    : { background: '#F8FAFC', card: '#FFFFFF', ink: '#20212B', muted: '#6B7280', border: '#E2E8F0', selected: '#FFF1F2' };

  useEffect(() => {
    if (!visible) return;
    const preset = currentPrize && PRESETS.includes(currentPrize);
    setSelected(!currentPrize ? PRESETS[0] : preset ? currentPrize : 'custom');
    setCustom(preset ? '' : currentPrize || '');
    setError(null);
  }, [visible, currentPrize]);

  const prize = (selected === 'custom' ? custom : selected).trim();
  const save = async () => {
    if (!prize || saving) return;
    setError(null);
    try { await onSave(prize); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your prize. Try again.'); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 20 : Math.max(16, insets.top) }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close prize selection" onPress={onClose} style={styles.close}>
            <X size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
          {[...PRESETS, 'custom'].map(option => {
            const active = selected === option;
            return (
              <Pressable
                key={option} accessibilityRole="radio" accessibilityState={{ checked: active }}
                accessibilityLabel={option === 'custom' ? 'Choose a custom prize' : `Winner gets ${option}`}
                onPress={() => { setSelected(option); setError(null); }}
                style={({ pressed }) => [styles.option, { borderColor: active ? '#FF6B6B' : colors.border, backgroundColor: active ? colors.selected : colors.card }, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, { color: colors.ink }]}>{option === 'custom' ? 'Write your own' : option.charAt(0).toUpperCase() + option.slice(1)}</Text>
                <View style={[styles.radio, { borderColor: active ? '#FF6B6B' : colors.border, backgroundColor: active ? '#FF6B6B' : 'transparent' }]}>
                  {active && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
          {selected === 'custom' && (
            <View style={styles.custom}>
              <Text style={[styles.inputLabel, { color: colors.muted }]}>Winner gets…</Text>
              <TextInput
                accessibilityLabel="Custom weekly prize" placeholder="e.g. a picnic at the beach"
                placeholderTextColor={colors.muted} value={custom} maxLength={100}
                onChangeText={value => { setCustom(value); setError(null); }}
                style={[styles.input, { color: colors.ink, backgroundColor: colors.card, borderColor: colors.border }]}
                returnKeyType="done" onSubmitEditing={() => { void save(); }}
              />
              <Text style={[styles.characterCount, { color: colors.muted }]}>{custom.length}/100</Text>
            </View>
          )}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !prize || saving, busy: saving }}
            disabled={!prize || saving} onPress={() => { void save(); }}
            style={({ pressed }) => [styles.save, (!prize || saving) && styles.disabled, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save prize</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '800' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  option: { minHeight: 56, padding: 16, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionText: { flex: 1, fontSize: 16, fontWeight: '600' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  custom: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: 16, minHeight: 56, fontSize: 16 },
  characterCount: { textAlign: 'right', fontSize: 12, fontVariant: ['tabular-nums'] },
  error: { color: '#DC3036', fontSize: 14, lineHeight: 20 },
  actions: { paddingHorizontal: 20, paddingTop: 12 },
  save: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B6B', borderRadius: 16, borderCurve: 'continuous', padding: 16 },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
