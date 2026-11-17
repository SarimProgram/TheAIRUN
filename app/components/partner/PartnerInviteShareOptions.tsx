import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mail, MessageCircle, Send, Share2 } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePassColors } from '@/components/mealpass/passTheme';
import { sharePartnerInviteVia, type PartnerInviteShareChannel } from '@/utils/partnerInviteShare';

const OPTIONS = [
  { channel: 'whatsapp', label: 'WhatsApp' },
  { channel: 'sms', label: 'Messages' },
  { channel: 'email', label: 'Email' },
  { channel: 'telegram', label: 'Telegram' },
  { channel: 'native', label: 'More' },
] as const;

export function PartnerInviteShareOptions({ message, disabled = false }: { message: string; disabled?: boolean }) {
  const c = usePassColors();
  const [active, setActive] = useState<PartnerInviteShareChannel | null>(null);
  const busy = disabled || !!active || !message.trim();
  const share = async (channel: PartnerInviteShareChannel) => {
    if (busy) return;
    setActive(channel);
    try { await sharePartnerInviteVia(channel, message); }
    catch { Alert.alert('Unable to share', 'Please try another sharing option.'); }
    finally { setActive(null); }
  };
  return <View style={s.root}>
    <Text style={[s.heading, { color: c.muted }]}>Share your invitation</Text>
    <View style={s.options}>
      {OPTIONS.map(({ channel, label }) => {
        const Icon = channel === 'sms' ? MessageCircle : channel === 'email' ? Mail : channel === 'telegram' ? Send : Share2;
        return <Pressable key={channel} accessibilityRole="button" accessibilityLabel={`Share via ${label}`} accessibilityState={{ disabled: busy }}
          onPress={() => { void share(channel); }} disabled={busy}
          style={({ pressed }) => [s.option, { backgroundColor: c.soft, opacity: busy ? 0.5 : pressed ? 0.65 : 1 }]}>
          {active === channel ? <ActivityIndicator color={c.ink} size="small" />
            : channel === 'whatsapp' ? <Ionicons name="logo-whatsapp" size={21} color={c.ink} /> : <Icon size={20} color={c.ink} />}
          <Text style={[s.label, { color: c.ink }]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
const s = StyleSheet.create({
  root: { width: '100%', gap: 12 }, heading: { fontSize: 13, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, flexBasis: '28%', minHeight: 72, padding: 12, gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous' },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
