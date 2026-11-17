import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import EditableAvatar from '@/components/home/EditableAvatar';

type Props = { avatarKey?: string; name: string; gender?: string | null; size: number; ring: string; soft: string; ringWidth?: number };

/** A person's home avatar in their colour ring; falls back to an initial when no avatar is set. */
export default function PassAvatar({ avatarKey, name, gender, size, ring, soft, ringWidth = 2 }: Props) {
  const inner = size - ringWidth * 2 - 4;
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: ringWidth, borderColor: ring, backgroundColor: soft }]}>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {avatarKey
          ? <EditableAvatar storageKey={avatarKey} name={name} gender={gender} active={false} editable={false} imageStyle={styles.image} />
          : <Text style={[styles.initial, { color: ring, fontSize: Math.round(inner * 0.42) }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  initial: { fontWeight: '800' },
});
