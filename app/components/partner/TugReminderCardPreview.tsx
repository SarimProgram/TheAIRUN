import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { TUG_SHEET } from '@/components/battle/tugAssets';
import { TUG_ATLAS, TUG_FRAME_HEIGHT, TUG_FRAME_WIDTH } from '@/components/battle/tugSprite';

export default function TugReminderCardPreview({ large = false }: { large?: boolean }) {
  const [width, setWidth] = useState(170);
  const [height, setHeight] = useState(100);
  const phoneWidth = Math.max(22, Math.min((width - 34) / 2, (height - (large ? 86 : 34)) / 1.85));
  const scale = phoneWidth * 0.96 / TUG_FRAME_WIDTH;
  return <View onLayout={event => { setWidth(event.nativeEvent.layout.width); setHeight(event.nativeEvent.layout.height); }} style={[styles.root, { gap: large ? 12 : 3, paddingVertical: large ? 16 : 5 }]}>
    <Text style={[styles.eyebrow, { fontSize: large ? 10 : 7 }]}>TWO PHONES. ONE ROPE.</Text>
    <View style={styles.pair}>
      {(['left', 'right'] as const).map((side, index) => <View key={side} style={[styles.phone, { width: phoneWidth, height: phoneWidth * 1.85 }]}>
        <View style={styles.island} />
        {large ? <>
          <Text style={[styles.name, { color: index ? '#218E87' : '#E96570', fontSize: 10 }]}>{index ? 'THEM' : 'YOU'}</Text>
          <Text style={[styles.count, { fontSize: 23 }]}>{index ? '6,200' : '6,450'}</Text>
        </> : null}
        <View style={[styles.rope, { top: phoneWidth * 1.03, left: index ? -4 : phoneWidth * 0.7, right: index ? phoneWidth * 0.7 : -4 }]} />
        <View style={{ position: 'absolute', top: phoneWidth * 0.43, left: phoneWidth * 0.02, width: phoneWidth * 0.96, height: TUG_FRAME_HEIGHT * scale, overflow: 'hidden', transform: [{ scaleX: index ? -1 : 1 }] }}>
          <Image source={TUG_SHEET} resizeMode="stretch" style={{ width: TUG_ATLAS.width * scale, height: TUG_ATLAS.height * scale, transform: [{ translateX: -3 * TUG_FRAME_WIDTH * scale }, { translateY: -index * TUG_FRAME_HEIGHT * scale }] }} />
        </View>
      </View>)}
    </View>
    <Text style={[styles.title, { fontSize: large ? 17 : 11 }]}>Your steps pull the rope.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, backgroundColor: '#EEF6F3', borderRadius: 10, borderCurve: 'continuous', overflow: 'hidden' },
  eyebrow: { color: '#61736D', fontWeight: '700', letterSpacing: 1 },
  pair: { flexDirection: 'row', gap: 4 },
  phone: { borderWidth: 2, borderColor: '#2A3837', borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#F9FCFA', alignItems: 'center', overflow: 'hidden' },
  island: { width: 20, height: 5, borderRadius: 3, backgroundColor: '#2A3837', marginTop: 5, marginBottom: 8 },
  name: { fontWeight: '800' },
  count: { color: '#22323A', fontWeight: '800', fontVariant: ['tabular-nums'] },
  rope: { position: 'absolute', height: 3, backgroundColor: '#B88A52' },
  title: { color: '#22323A', fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
});
