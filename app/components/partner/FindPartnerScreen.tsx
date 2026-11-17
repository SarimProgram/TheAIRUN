import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Hash, Heart, Mail, Store, Trash2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePassColors } from '@/components/mealpass/passTheme';
import { PartnerConnectArtwork } from './PartnerConnectArtwork';
import { PartnerInviteShareOptions } from './PartnerInviteShareOptions';

type Props = {
  step: number; gender?: string | null; email: string;
  loading: boolean; error: string; code: string; recipient?: string | null;
  emailSent: boolean; message: string; incoming?: { id: string; name: string };
  onEmailChange: (value: string) => void; onStep: (step: number) => void;
  onSendEmail: () => void; onCreateCode: () => void; onCancel: () => void;
  onAccept: (id: string) => void; onMarketplace: () => void;
};

export function FindPartnerScreen(p: Props) {
  const c = usePassColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [method, setMethod] = useState<'email' | 'code'>('email');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim());
  const canSubmit = !p.loading && (method === 'code' || validEmail);
  const primary = (label: string, action: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: p.loading }} disabled={disabled}
      onPress={action} style={({ pressed }) => [s.primary, { backgroundColor: c.accent, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      {p.loading ? <ActivityIndicator color={c.onAccent} /> : <><Text style={[s.primaryText, { color: c.onAccent }]}>{label}</Text><ArrowRight size={20} color={c.onAccent} /></>}
    </Pressable>
  );
  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: c.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style={c.surface === '#0F172A' ? 'light' : 'dark'} />
      <View style={[s.header, { paddingTop: insets.top }]}>
        <View style={s.nav}>
          {p.step > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={p.loading} onPress={() => p.onStep(p.step === 2 ? 1 : 0)}
            style={({ pressed }) => [s.back, { backgroundColor: c.card, opacity: pressed ? 0.6 : 1 }]}><ArrowLeft size={21} color={c.ink} /></Pressable> : <View style={s.back} />}
          <Text style={[s.navTitle, { color: c.ink }]}>Partner</Text><View style={s.back} />
        </View>

        <View style={s.hero}>
          <PartnerConnectArtwork plain width={Math.min(width - 64, 300)} leftGender={p.gender} />
          <Text style={[s.title, { color: c.ink }]}>{p.step === 0 ? 'Find your partner' : p.step === 1 ? 'Invite your partner' : 'Invite ready'}</Text>
          {p.step === 0 && <Text style={[s.subtitle, { color: c.muted }]}>Build healthy habits together.</Text>}
          {p.step === 2 && p.recipient && <Text style={[s.subtitle, { color: c.muted }]}>{p.emailSent ? 'Email sent to' : 'For'} {p.recipient}</Text>}
        </View>
      </View>

      <ScrollView key={p.step} style={s.bodyScroll} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        bounces={false} alwaysBounceVertical={false} overScrollMode="never" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 112 }]}>

        {p.step === 0 ? <>
          {p.incoming && <View style={[s.card, { backgroundColor: c.card }]}>
            <View style={s.row}><View style={[s.icon, { backgroundColor: c.accentSoft }]}><Heart size={21} color={c.accent} /></View>
              <View style={s.copy}><Text style={[s.cardTitle, { color: c.ink }]}>You have an invitation</Text><Text style={[s.body, { color: c.muted }]}>From {p.incoming.name}</Text></View></View>
            {primary('Accept invitation', () => p.onAccept(p.incoming!.id), p.loading)}
          </View>}
          <View style={[s.card, { backgroundColor: c.card }]}>
            {primary(p.code ? 'View invitation' : 'Invite partner', () => p.onStep(p.code ? 2 : 1), p.loading)}
          </View>
          <Pressable accessibilityRole="button" onPress={p.onMarketplace} style={({ pressed }) => [s.market, { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 }]}>
            <View style={[s.icon, { backgroundColor: c.accentSoft }]}><Store size={21} color={c.accent} /></View>
            <View style={s.copy}><Text style={[s.cardTitle, { color: c.ink }]}>Marketplace</Text><Text style={[s.body, { color: c.muted }]}>Rewards for your points</Text></View><ChevronRight size={19} color={c.faint} />
          </Pressable>
        </> : p.step === 1 ? <View style={[s.card, { backgroundColor: c.card }]}>
          <View accessibilityRole="tablist" style={[s.methods, { backgroundColor: c.soft }]}>
            {(['email', 'code'] as const).map(value => {
              const selected = method === value;
              const Icon = value === 'email' ? Mail : Hash;
              return <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected, disabled: p.loading }} disabled={p.loading}
                onPress={() => { setMethod(value); p.onEmailChange(p.email); }} style={[s.method, selected && { backgroundColor: c.card }]}>
                <Icon size={18} color={selected ? c.ink : c.muted} /><Text style={[s.methodLabel, { color: selected ? c.ink : c.muted }]}>{value === 'email' ? 'Email' : 'Invite code'}</Text>
              </Pressable>;
            })}
          </View>
          {method === 'code' && <Text style={[s.body, { color: c.muted }]}>Share a code in any app.</Text>}
          {method === 'email' && <View style={s.field}>
            <Text style={[s.label, { color: c.ink }]}>Partner’s email</Text>
            <TextInput accessibilityLabel="Partner’s email" style={[s.input, { color: c.ink, borderColor: p.error ? c.accent : c.line, backgroundColor: c.surface }]}
              placeholder="partner@example.com" placeholderTextColor={c.faint} value={p.email} onChangeText={p.onEmailChange}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
              returnKeyType="send" editable={!p.loading} onSubmitEditing={() => { if (canSubmit) p.onSendEmail(); }} />
          </View>}
          {p.error ? <Text accessibilityRole="alert" style={[s.body, { color: c.accent }]}>{p.error}</Text> : null}
          {primary(method === 'email' ? 'Send invitation' : 'Create invite code', method === 'email' ? p.onSendEmail : p.onCreateCode, !canSubmit)}
        </View> : <View style={[s.card, { backgroundColor: c.card }]}>
          <View style={s.row}><View style={[s.icon, { backgroundColor: c.accentSoft }]}><Check size={22} color={c.accent} /></View><View style={s.copy}>
            <Text style={[s.cardTitle, { color: c.ink }]}>Your invite code</Text>
          </View></View>
          <View style={[s.codeBox, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
            <Text selectable accessibilityLabel={`Invite code ${p.code}`} style={[s.code, { color: c.ink }]}>{p.code || 'Code unavailable'}</Text>
          </View>
          <Text style={[s.body, { color: c.muted }]}>Enter this in “I have a code” in the app.</Text>
          <PartnerInviteShareOptions message={p.message} disabled={p.loading || !p.code} />
          <Pressable accessibilityRole="button" disabled={p.loading} onPress={p.onCancel} style={({ pressed }) => [s.delete, { opacity: pressed || p.loading ? 0.5 : 1 }]}>
            <Trash2 size={17} color={c.muted} /><Text style={[s.methodLabel, { color: c.muted }]}>Cancel invitation</Text>
          </Pressable>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0, overflow: 'hidden' }, header: { flexShrink: 0, paddingHorizontal: 24, paddingBottom: 20, gap: 4 },
  bodyScroll: { flex: 1, minHeight: 0 }, scroll: { paddingHorizontal: 24, gap: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700' }, hero: { alignItems: 'center', gap: 8 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -1, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 340 },
  card: { padding: 20, borderRadius: 24, borderCurve: 'continuous', gap: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }, body: { fontSize: 14, lineHeight: 21 },
  primary: { minHeight: 56, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', flexShrink: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 }, market: { padding: 16, borderRadius: 24, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 12 },
  methods: { flexDirection: 'row', padding: 4, borderRadius: 16, borderCurve: 'continuous', gap: 4 },
  method: { flex: 1, minHeight: 44, borderRadius: 12, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  methodLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 }, field: { gap: 8 }, label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 56, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 16, fontSize: 16 },
  codeBox: { paddingVertical: 24, paddingHorizontal: 12, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center' },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'], textAlign: 'center' },
  delete: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
