import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function HomeGoalConnector({ style }: { style?: StyleProp<ViewStyle> }) {
  const [height, setHeight] = useState(0);
  return <View
    pointerEvents="none"
    accessible={false}
    style={[styles.connector, style]}
    onLayout={event => setHeight(event.nativeEvent.layout.height)}
  >
    <Svg width={24} height="100%">
      {height > 96 ? <Path
        d={`M23 0 C23 24 7 24 7 48 L7 ${height - 48} C7 ${height - 24} 23 ${height - 24} 23 ${height}`}
        fill="none"
        stroke="#FFB1AC"
        strokeWidth={2}
        strokeDasharray="1 7"
        strokeLinecap="round"
      /> : null}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  connector: { position: 'absolute', left: -1, top: 42, bottom: -42, width: 24 },
});
