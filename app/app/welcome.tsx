import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6B6B',
  white: '#FFFFFF',
} as const;

export default function WelcomeScreen() {
  const router = useRouter();
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Elegant Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 1200, 
        useNativeDriver: true 
      }),
      Animated.spring(scaleAnim, { 
        toValue: 1, 
        friction: 8, 
        useNativeDriver: true 
      }),
    ]).start();

    // Automatic Transition
    const timer = setTimeout(() => {
      router.push('/(tabs)');
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  const handlePress = () => {
    router.push('/(tabs)'); 
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={1} 
      onPress={handlePress}
    >
      <StatusBar barStyle="light-content" />
      
      <View style={styles.center}>
        <Animated.View style={[styles.textStack, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.welcomeText}>Welcome to RunTogether</Text>
          <Text style={styles.subtitleText}>COUPLE FITNESS APP</Text>
        </Animated.View>
      </View>
      
      <View style={styles.footer}>
         <Text style={styles.tapText}>TAP TO START</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStack: {
    alignItems: 'center',
    gap: 10,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
  },
  tapText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  }
});
