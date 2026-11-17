import React, { useId } from 'react';
import { Image as NativeImage, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image, Rect } from 'react-native-svg';
import { getImageChatAvatarSource } from '../../utils/genderMascot';

/** Static app-style portrait; old 2x2 avatars keep only their first pose. */
export default function CuteAvatar({ character, sheetUri }: { character: 'male' | 'female'; sheetUri?: string; active?: boolean }) {
  const id = `static-avatar-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!sheetUri) return <NativeImage source={getImageChatAvatarSource(character)} style={styles.frame} resizeMode="contain" />;
  return <View style={styles.frame}><Svg width="100%" height="100%" viewBox="0 0 128 128" accessible={false}>
    <Defs><ClipPath id={id}><Rect width={128} height={128} /></ClipPath></Defs>
    <G clipPath={`url(#${id})`}><Image href={{ uri: sheetUri }} width={256} height={256} /></G>
  </Svg></View>;
}
const styles = StyleSheet.create({ frame: { width: '100%', height: '100%' } });