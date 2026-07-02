import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// --- Modernized Theme Colors ---
const COLORS = {
    primary: '#FF6B6B',
    secondary: '#1F938A',
    bg: '#F8FAFC', // Slightly off-white for better contrast
    card: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    pinkLight: '#FFF1F2',
    tealLight: '#F0FDFA',
    white: '#FFFFFF',
    gold: '#F59E0B',
    blue: '#3B82F6',
    green: '#10B981',
};

const { width } = Dimensions.get('window');

const EARN_METHODS = [
    {
        id: 'calories',
        title: 'Keep Calories In Range',
        description: 'Stay close to your daily calorie target',
        icon: 'flame' as const,
        points: 'Daily points',
        color: COLORS.primary,
        details: [
            { label: 'Log your food for the day', pts: 'Track it' },
            { label: 'Stay inside your target range', pts: 'Earn points' },
            { label: 'Do it again tomorrow', pts: 'Keep building points' },
        ],
    },
    {
        id: 'steps',
        title: 'Hit Your Steps',
        description: 'Walk enough to reach your step goal',
        icon: 'walk' as const,
        points: 'Daily points',
        color: COLORS.blue,
        details: [
            { label: 'Wear your tracker or phone', pts: 'Track steps' },
            { label: 'Reach your daily step goal', pts: 'Earn points' },
            { label: 'More good days means more points', pts: 'Build rewards' },
        ],
    },
    {
        id: 'runs',
        title: 'Finish Your Runs',
        description: 'Complete the run your plan gives you',
        icon: 'footsteps' as const,
        points: 'Main points',
        color: COLORS.green,
        details: [
            { label: 'Open your run for today', pts: 'Start it' },
            { label: 'Finish the run and save it', pts: 'Earn points' },
            { label: 'Longer or key runs can help more', pts: 'More progress' },
        ],
    },
    {
        id: 'exercise',
        title: 'Do Your Exercise',
        description: 'Complete workouts inside your plan',
        icon: 'barbell' as const,
        points: 'Extra points',
        color: COLORS.secondary,
        details: [
            { label: 'Follow the workout for the day', pts: 'Do it' },
            { label: 'Finish the session', pts: 'Earn points' },
            { label: 'Stay consistent through the week', pts: 'More points' },
        ],
    },
    {
        id: 'hydration',
        title: 'Track Your Water',
        description: 'Log your water during the day',
        icon: 'water' as const,
        points: 'Small daily points',
        color: COLORS.blue,
        details: [
            { label: 'Log your water', pts: 'Track it' },
            { label: 'Hit your water goal', pts: 'Earn points' },
            { label: 'Keep it up each day', pts: 'Build rewards' },
        ],
    },
    {
        id: 'quests',
        title: 'Claim Quest Rewards',
        description: 'Some plan goals unlock bonus quest points',
        icon: 'trophy' as const,
        points: 'Bonus points',
        color: COLORS.primary,
        details: [
            { label: 'Finish the quest goal', pts: 'Complete it' },
            { label: 'Open the Quest page', pts: 'Check progress' },
            { label: 'Claim your reward', pts: 'Get points' },
        ],
    },
];

// Exported button component for use in other screens
export function HowToEarnButton({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} style={buttonStyles.container}>
            <Ionicons name="help-circle-outline" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
    );
}

const buttonStyles = StyleSheet.create({
    container: {
        marginRight: 12,
        padding: 4,
    },
});

export default function HowToEarn({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Drag Indicator for pageSheet */}
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Rewards Center</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeCircle}>
                        <Ionicons name="close" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Hero Section */}
                    <LinearGradient
                        colors={[COLORS.primary, '#FF8E8E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroCard}
                    >
                        <View style={styles.heroContent}>
                            <View>
                                <Text style={styles.heroTitle}>How To Earn{'\n'}Reward Points</Text>
                                <Text style={styles.heroSubtitle}>Follow your plan, finish your run, and claim points.</Text>
                            </View>
                            <View style={styles.heroIconContainer}>
                                <Ionicons name="trophy-outline" size={40} color="rgba(255,255,255,0.45)" />
                            </View>
                        </View>
                    </LinearGradient>

                    <Text style={styles.sectionLabel}>SIMPLE STEPS</Text>

                    {EARN_METHODS.map((method) => {
                        const isExpanded = expandedCard === method.id;
                        return (
                            <TouchableOpacity
                                key={method.id}
                                activeOpacity={0.7}
                                onPress={() => setExpandedCard(isExpanded ? null : method.id)}
                                style={[styles.methodCard, isExpanded && styles.expandedCardBorder]}
                            >
                                <View style={styles.methodMainRow}>
                                    <View style={[styles.iconBox, { backgroundColor: method.color + '15' }]}>
                                        <Ionicons name={method.icon} size={22} color={method.color} />
                                    </View>

                                    <View style={styles.methodText}>
                                        <Text style={styles.methodTitleText}>{method.title}</Text>
                                        <Text style={styles.methodDescText}>{method.description}</Text>
                                    </View>

                                    <View style={styles.pointsPill}>
                                        <Text style={[styles.pointsPillText, { color: method.color }]}>
                                            {method.points}
                                        </Text>
                                    </View>
                                </View>

                                {isExpanded && (
                                    <View style={styles.expandedContent}>
                                        {method.details.map((detail, idx) => (
                                            <View key={idx} style={styles.detailItem}>
                                                <Ionicons name="checkmark-circle" size={16} color={method.color} />
                                                <Text style={styles.detailLabel}>{detail.label}</Text>
                                                <Text style={[styles.detailPts, { color: method.color }]}>{detail.pts}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    dragIndicator: {
        width: 36,
        height: 5,
        backgroundColor: '#CBD5E1',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.5,
    },
    closeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
    },
    heroCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 32,
        ...Platform.select({
            ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
            android: { elevation: 8 },
        }),
    },
    heroContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.white,
        lineHeight: 30,
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    heroIconContainer: {
        opacity: 0.8,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textMuted,
        letterSpacing: 1.5,
        marginBottom: 16,
        marginLeft: 4,
    },
    methodCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
            android: { elevation: 3 },
        }),
    },
    expandedCardBorder: {
        borderColor: COLORS.border,
    },
    methodMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodText: {
        flex: 1,
        marginLeft: 16,
    },
    methodTitleText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    methodDescText: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    pointsPill: {
        backgroundColor: COLORS.bg,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    pointsPillText: {
        fontSize: 12,
        fontWeight: '800',
    },
    expandedContent: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    detailLabel: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: COLORS.text,
    },
    detailPts: {
        fontSize: 14,
        fontWeight: '700',
    },
});
