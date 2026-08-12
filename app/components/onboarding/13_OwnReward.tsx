import React, { useState, useEffect, useRef } from 'react';
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
import {
  Coffee,
  Film,
  ShoppingBag,
  Map,
  Trophy,
  Gift,
  ArrowRight,
  Check,
  Sparkles
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  glass: 'rgba(255, 255, 255, 0.9)',
};

const OPTIONS = [
  { id: 'coffee', label: 'Coffee or a treat', icon: Coffee },
  { id: 'movie', label: 'Movie night', icon: Film },
  { id: 'shop', label: 'Shopping treat', icon: ShoppingBag },
  { id: 'exp', label: 'Fun day out', icon: Map },
  { id: 'save', label: 'Something big', icon: Trophy },
  { id: 'surprise', label: 'Surprise me', icon: Gift },
];

export default function MarketplaceMotivation({ onContinue }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  const toggleOption = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length < 3) {
        return [...prev, id];
      }
      return prev;
    });
  };

  const isButtonActive = selected.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FDFCFB', '#FFF5F5']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <Animated.View style={[
          styles.content,
          useCompactLayout && styles.contentCompact,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>

          {/* Header */}
          <View style={[styles.header, useCompactLayout && styles.headerCompact]}>
            <View style={[styles.miniTag, useCompactLayout && styles.miniTagCompact]}>
              <Sparkles size={12} color={COLORS.coral} fill={COLORS.coral} />
              <Text style={[styles.miniTagText, useCompactLayout && styles.miniTagTextCompact]}>PICK UP TO 3 · {selected.length}/3</Text>
            </View>
            <Text style={[styles.title, useCompactLayout && styles.titleCompact]}>
              What will keep{"\n"}
              <Text style={{ color: COLORS.coral }}>you going?</Text>
            </Text>
            <Text style={[styles.subtitle, useCompactLayout && styles.subtitleCompact]}>
              Pick up to three rewards you’d love to work toward.
            </Text>
          </View>

          {/* Grid Options */}
          <View style={[styles.grid, useCompactLayout && styles.gridCompact]}>
            {OPTIONS.map((item) => {
              const isSelected = selected.includes(item.id);
              const Icon = item.icon;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.9}
                  onPress={() => toggleOption(item.id)}
                  style={[
                    styles.card,
                    useCompactLayout && styles.cardCompact,
                    isSelected && styles.cardSelected
                  ]}
                >
                  <View style={[styles.iconBox, useCompactLayout && styles.iconBoxCompact, isSelected && styles.iconBoxSelected]}>
                    <Icon color={isSelected ? COLORS.white : COLORS.coral} size={useCompactLayout ? 21 : 24} strokeWidth={2.5} />
                  </View>
                  <Text style={[styles.cardLabel, useCompactLayout && styles.cardLabelCompact, isSelected && styles.cardLabelSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check color={COLORS.white} size={10} strokeWidth={4} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={[styles.footer, useCompactLayout && styles.footerCompact]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onContinue(selected)}
              style={[styles.mainButton, useCompactLayout && styles.mainButtonCompact]}
              disabled={!isButtonActive}
            >
              <LinearGradient
                colors={isButtonActive ? [COLORS.coral, COLORS.coralDark] : ['#E0E0E0', '#D0D0D0']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.buttonText, useCompactLayout && styles.buttonTextCompact]}>Save my rewards</Text>
                <ArrowRight color="white" size={useCompactLayout ? 18 : 20} strokeWidth={3} />
              </LinearGradient>
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
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
  contentCompact: {
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerCompact: {
    marginBottom: 14,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.coralLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  miniTagCompact: {
    paddingVertical: 3,
    marginBottom: 8,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1,
  },
  miniTagTextCompact: {
    fontSize: 9,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  subtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
    paddingHorizontal: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  gridCompact: {
    gap: 9,
    marginTop: 0,
  },
  card: {
    width: (width - 60) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    height: 125,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardCompact: {
    height: 110,
    borderRadius: 20,
    padding: 13,
  },
  cardSelected: {
    borderColor: COLORS.coral,
    backgroundColor: COLORS.white,
    shadowOpacity: 0.1,
    shadowColor: COLORS.coral,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBoxCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 9,
  },
  iconBoxSelected: {
    backgroundColor: COLORS.coral,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },
  cardLabelCompact: {
    fontSize: 12,
  },
  cardLabelSelected: {
    color: COLORS.black,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.coral,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  footer: {
    width: '100%',
    marginTop: 20,
  },
  footerCompact: {
    marginTop: 16,
  },
  mainButton: {
    height: 54,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  mainButtonCompact: {
    height: 52,
    borderRadius: 24,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  buttonTextCompact: {
    fontSize: 15,
  },
});
