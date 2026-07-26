import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { Clock, BatteryWarning, Bandage, Meh, Map, ChevronRight, Check } from 'lucide-react-native';

const COLORS = {
  primary: '#FF6B6B',
  text: '#2D3436',
  muted: '#636E72',
  bg: '#FFFFFF',
  selectionBg: '#FFF8F8',
  cardBg: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E2E8F0',
};

interface Struggle {
  id: string;
  title: string;
  icon: any;
}

const STRUGGLES: Struggle[] = [
  { 
    id: 'time', 
    title: 'Lack of time', 
    icon: Clock 
  },
  { 
    id: 'motivation', 
    title: 'Low motivation', 
    icon: BatteryWarning 
  },
  { 
    id: 'injury', 
    title: 'Injuries or pain', 
    icon: Bandage 
  },
  { 
    id: 'boredom', 
    title: 'Boredom', 
    icon: Meh 
  },
  { 
    id: 'plan', 
    title: 'No clear plan', 
    icon: Map 
  },
];

export default function PastStruggles({ onContinue }: any) {
  // State holds an array of selected IDs for multi-select
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true })
    ]).start();
  }, []);

  const handleToggle = (id: string) => {
    setSelectedItems(prevItems => {
      if (prevItems.includes(id)) {
        // Remove if already selected
        return prevItems.filter(item => item !== id);
      } else {
        // Add if not selected
        return [...prevItems, id];
      }
    });
  };

  const Card = ({ item }: { item: Struggle }) => {
    const isSelected = selectedItems.includes(item.id);
    const Icon = item.icon;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleToggle(item.id)}
        style={[styles.card, isSelected && styles.selectedCard]}
      >
        <View style={[styles.iconContainer, isSelected && styles.selectedIconContainer]}>
          <Icon color={isSelected ? COLORS.white : COLORS.primary} size={24} strokeWidth={2.5} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.cardTitle, isSelected && styles.selectedText]}>{item.title}</Text>
        </View>

        {/* Multi-select checkbox style indicator */}
        <View style={[styles.checkboxCircle, isSelected && styles.checkboxActive]}>
          {isSelected && <Check size={14} color={COLORS.white} strokeWidth={4} />}
        </View>
      </TouchableOpacity>
    );
  };

  const isFormValid = selectedItems.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <Animated.View style={[
        styles.content, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Past Struggles</Text>
          <Text style={styles.description}>What usually stops you from staying consistent?</Text>
          <Text style={styles.helperText}>(Select all that apply)</Text>
        </View>

        <View style={styles.list}>
          {STRUGGLES.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, !isFormValid && styles.buttonDisabled]}
            disabled={!isFormValid}
            activeOpacity={0.8}
            onPress={() => onContinue(selectedItems)}
          >
            <Text style={styles.buttonText}>Continue</Text>
            <View style={styles.buttonIconWrapper}>
              <ChevronRight color={COLORS.primary} size={20} strokeWidth={3} />
            </View>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -1,
  },
  description: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    backgroundColor: COLORS.cardBg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    backgroundColor: COLORS.selectionBg,
    borderColor: COLORS.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  selectedIconContainer: {
    backgroundColor: COLORS.primary,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  selectedText: {
    color: COLORS.primary,
  },
  // Checkbox style instead of radio
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 8, // Slightly squarer for checkbox feel
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  footer: {
    marginTop: 40,
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 64,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#F1F2F6',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginLeft: 32,
  },
  buttonIconWrapper: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});