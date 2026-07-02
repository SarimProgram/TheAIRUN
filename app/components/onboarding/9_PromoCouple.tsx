import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Quote, ChevronRight, Heart } from 'lucide-react-native';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

const COLORS = {
  coral: '#FF6B6B',
  coralLight: '#FF8E8E',
  dark: '#2D3436',
  white: '#FFFFFF',
  textMuted: '#636E72',
};

export default function SocialProofScreen({ onContinue }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background stays Coral for the whole screen */}
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          
          {/* Visual Area (Couple Image goes here) */}
          <View style={styles.imageContainer}>
             {/* This represents your "Couple walking/running" visual */}
             <View style={styles.illustrationPlaceholder}>
                <View style={styles.imageClip}>
                  <Image
                    source={require('../../assets/promo.jpg')}
                    style={styles.heroImage}
                    contentFit="cover"
                  />
                </View>
             </View>
             {/* Tag is now sibling to give it better overflow visibility */}
             <View style={styles.floatingTag}>
                <Heart size={14} color={COLORS.coral} fill={COLORS.coral} />
                <Text style={styles.tagText}>Built for Couples</Text>
             </View>
          </View>

          {/* Testimonial Section */}
          <View style={styles.testimonialCard}>
            <View style={styles.quoteCircle}>
              <Quote size={24} color={COLORS.white} fill={COLORS.white} />
            </View>
            
            <Text style={styles.bodyText}>
              “I always quit by week 3. Running with my partner and earning <Text style={styles.highlight}>date nights</Text> kept me consistent for the first time.”
            </Text>

            <View style={styles.authorSection}>
                <View>
                  <Text style={styles.authorName}>Sarah & James</Text>
                  <Text style={styles.authorSub}>Earning rewards since 2026</Text>
               </View>
            </View>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Thousands of couples and solo runners are building habits together.
            </Text>

            <TouchableOpacity 
              activeOpacity={0.9} 
              style={styles.ctaButton}
              onPress={onContinue}
            >
              <Text style={styles.buttonText}>Continue</Text>
              <View style={styles.iconBox}>
                <ChevronRight color={COLORS.coral} size={24} strokeWidth={3} />
              </View>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.coral, // Full screen Coral
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  imageContainer: {
    height: height * 0.35, // More room for the half-on/half-off tag
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  illustrationPlaceholder: {
    width: width * 0.8,
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  imageClip: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingTag: {
    position: 'absolute',
    bottom: (height * 0.35 - 180) / 2 - 20, // Mathematically center it half-on/half-off 180 height box
    zIndex: 100,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.dark,
  },
  testimonialCard: {
    backgroundColor: COLORS.white,
    borderRadius: 36,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  quoteCircle: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.coral,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -56, // Pops it out of the top
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  bodyText: {
    fontSize: 20,
    lineHeight: 32,
    color: COLORS.dark,
    fontWeight: '600',
    marginVertical: 20,
  },
  highlight: {
    color: COLORS.coral,
    fontWeight: '800',
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F2F6',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
  },
  authorSub: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  footer: {
    gap: 24,
  },
  footerText: {
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  ctaButton: {
    backgroundColor: COLORS.white,
    height: 72,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingLeft: 32,
  },
  buttonText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.coral,
  },
  iconBox: {
    width: 56,
    height: 56,
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
