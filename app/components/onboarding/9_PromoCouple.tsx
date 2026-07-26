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
  Platform,
} from 'react-native';
import { Quote, ChevronRight, Heart } from 'lucide-react-native';
import { Image } from 'expo-image';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const height = Math.min(windowHeight, 800);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

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
          useCompactLayout && styles.contentCompact,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          
          {/* Visual Area (Couple Image goes here) */}
          <View style={[styles.imageContainer, useCompactLayout && styles.imageContainerCompact]}>
             {/* This represents your "Couple walking/running" visual */}
             <View style={[styles.illustrationPlaceholder, useCompactLayout && styles.illustrationPlaceholderCompact]}>
                <View style={styles.imageClip}>
                  <Image
                    source={require('../../assets/promo.jpg')}
                    style={styles.heroImage}
                    contentFit="cover"
                  />
                </View>
             </View>
             {/* Tag is now sibling to give it better overflow visibility */}
             <View style={[styles.floatingTag, useCompactLayout && styles.floatingTagCompact]}>
                <Heart size={14} color={COLORS.coral} fill={COLORS.coral} />
                <Text style={[styles.tagText, useCompactLayout && styles.tagTextCompact]}>Built for Couples</Text>
             </View>
          </View>

          {/* Testimonial Section */}
          <View style={[styles.testimonialCard, useCompactLayout && styles.testimonialCardCompact]}>
            <View style={[styles.quoteCircle, useCompactLayout && styles.quoteCircleCompact]}>
              <Quote size={useCompactLayout ? 20 : 24} color={COLORS.white} fill={COLORS.white} />
            </View>
            
            <Text style={[styles.bodyText, useCompactLayout && styles.bodyTextCompact]}>
              “I always quit by week 3. Running with my partner and earning <Text style={styles.highlight}>date nights</Text> kept me consistent for the first time.”
            </Text>

            <View style={[styles.authorSection, useCompactLayout && styles.authorSectionCompact]}>
                <View>
                  <Text style={[styles.authorName, useCompactLayout && styles.authorNameCompact]}>Sarah & James</Text>
                  <Text style={[styles.authorSub, useCompactLayout && styles.authorSubCompact]}>Earning rewards since 2026</Text>
               </View>
            </View>
          </View>

          {/* Footer Info */}
          <View style={[styles.footer, useCompactLayout && styles.footerCompact]}>
            <Text style={[styles.footerText, useCompactLayout && styles.footerTextCompact]}>
              Thousands of couples and solo runners are building habits together.
            </Text>

            <TouchableOpacity 
              activeOpacity={0.9} 
              style={[styles.ctaButton, useCompactLayout && styles.ctaButtonCompact]}
              onPress={onContinue}
            >
              <Text style={[styles.buttonText, useCompactLayout && styles.buttonTextCompact]}>Continue</Text>
              <View style={[styles.iconBox, useCompactLayout && styles.iconBoxCompact]}>
                <ChevronRight color={COLORS.coral} size={useCompactLayout ? 22 : 24} strokeWidth={3} />
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
  contentCompact: {
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  imageContainer: {
    height: height * 0.35, // More room for the half-on/half-off tag
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  imageContainerCompact: {
    height: 218,
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
  illustrationPlaceholderCompact: {
    width: width * 0.72,
    height: 150,
    borderRadius: 32,
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
  floatingTagCompact: {
    bottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.dark,
  },
  tagTextCompact: {
    fontSize: 12,
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
  testimonialCardCompact: {
    borderRadius: 28,
    padding: 24,
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
  quoteCircleCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginTop: -45,
  },
  bodyText: {
    fontSize: 20,
    lineHeight: 32,
    color: COLORS.dark,
    fontWeight: '600',
    marginVertical: 20,
  },
  bodyTextCompact: {
    fontSize: 17,
    lineHeight: 26,
    marginVertical: 14,
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
  authorSectionCompact: {
    marginTop: 4,
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
  authorNameCompact: {
    fontSize: 15,
  },
  authorSub: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  authorSubCompact: {
    fontSize: 12,
  },
  footer: {
    gap: 24,
  },
  footerCompact: {
    gap: 12,
  },
  footerText: {
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
    opacity: 1,
    paddingHorizontal: 10,
    fontWeight: '700',
  },
  footerTextCompact: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 18,
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
  ctaButtonCompact: {
    height: 58,
    borderRadius: 20,
    paddingLeft: 26,
  },
  buttonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.coral,
  },
  buttonTextCompact: {
    fontSize: 15,
  },
  iconBox: {
    width: 56,
    height: 56,
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxCompact: {
    width: 46,
    height: 46,
    borderRadius: 16,
  },
});
