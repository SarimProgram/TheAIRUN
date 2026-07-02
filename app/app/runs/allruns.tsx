import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Platform,
    Modal,
    TextInput,
} from 'react-native';
import { router } from 'expo-router';
import {
    ChevronLeft,
    Flame,
    Play,
    Timer,
    Zap,
    Wind,
    Sun,
    Activity,
    Compass,
    Armchair,
    Footprints,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getRunTemplate } from '@/lib/run-templates';
import type { RunType } from '@/types/RunTemplate';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 56) / 2;

type SetupGoalMode = 'distance' | 'time';

type SetupRunConfig = {
    title: string;
    subtitle: string;
    color: string;
    icon: any;
    templateId: RunType;
    defaultDistanceKm: number;
};

// --- THEME ---
const THEME = {
    primary: '#FF4757',
    secondary: '#1A1C1E',
    accent: '#70A1FF',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#1A1C1E',
    textMuted: '#64748B',
    white: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.9)',
    primaryTint: 'rgba(255, 71, 87, 0.08)',
    border: 'rgba(0, 0, 0, 0.05)',
};

function getTargetPaceSecPerKm(templateId: RunType) {
    const template = getRunTemplate(templateId);
    const targetZone = template.paceZones[template.targetZoneIndex];

    if (!targetZone) {
        return 360;
    }

    return Math.round((targetZone.minPaceSecPerKm + targetZone.maxPaceSecPerKm) / 2);
}

function getEstimatedMinutes(distanceKm: number, paceSecPerKm: number) {
    return Math.max(5, Math.round((distanceKm * paceSecPerKm) / 60));
}

function getEstimatedDistanceKm(minutes: number, paceSecPerKm: number) {
    return Number(((minutes * 60) / paceSecPerKm).toFixed(1));
}

// --- RUN TYPE CARD COMPONENT ---
const RunTypeCard = ({
    title,
    subtitle,
    color,
    icon: Icon,
    onPress,
}: {
    title: string;
    subtitle: string;
    color: string;
    icon: any;
    onPress: () => void;
}) => (
    <TouchableOpacity 
        style={styles.cardContainer} 
        onPress={onPress} 
        activeOpacity={0.9}
    >
        <View style={styles.cardInner}>
            <View style={[styles.cardIconBg, { backgroundColor: `${color}15` }]}>
                <Icon size={24} color={color} strokeWidth={2.5} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            <View style={styles.cardFooter}>
                <Text style={[styles.cardTag, { color: color, backgroundColor: `${color}10` }]}>START</Text>
                <View style={styles.playCircle}>
                    <Play size={12} color={THEME.white} fill={THEME.white} />
                </View>
            </View>
        </View>
    </TouchableOpacity>
);

// --- MAIN SCREEN ---
export default function AllRunsScreen() {
    const [showIntervalModePicker, setShowIntervalModePicker] = useState(false);
    const [showIntervalWalkKmPicker, setShowIntervalWalkKmPicker] = useState(false);
    const [showRunSetupModal, setShowRunSetupModal] = useState(false);
    const [intervalWalkKmInput, setIntervalWalkKmInput] = useState('3.0');
    const [intervalWalkKmError, setIntervalWalkKmError] = useState<string | null>(null);
    const [selectedRun, setSelectedRun] = useState<SetupRunConfig | null>(null);
    const [setupGoalMode, setSetupGoalMode] = useState<SetupGoalMode>('distance');
    const [setupDistanceInput, setSetupDistanceInput] = useState('5.0');
    const [setupTimeInput, setSetupTimeInput] = useState('30');
    const [setupError, setSetupError] = useState<string | null>(null);

    const launchRun = (templateId: RunType, distanceKm: number) => {
        router.push({
            pathname: '/runs/runscreen',
            params: {
                templateId,
                distanceKm: distanceKm.toFixed(1),
                weekContext: 'FREE RUN',
            }
        });
    };

    const openRunSetup = (run: SetupRunConfig) => {
        const estimatedPaceSecPerKm = getTargetPaceSecPerKm(run.templateId);
        const defaultDistanceKm = Number(run.defaultDistanceKm.toFixed(1));
        const defaultMinutes = getEstimatedMinutes(defaultDistanceKm, estimatedPaceSecPerKm);

        setSelectedRun(run);
        setSetupGoalMode('distance');
        setSetupDistanceInput(defaultDistanceKm.toFixed(1));
        setSetupTimeInput(defaultMinutes.toString());
        setSetupError(null);
        setShowRunSetupModal(true);
    };

    const closeRunSetup = () => {
        setShowRunSetupModal(false);
        setSetupError(null);
    };

    const handleRunSetupStart = () => {
        if (!selectedRun) {
            return;
        }

        const estimatedPaceSecPerKm = getTargetPaceSecPerKm(selectedRun.templateId);
        let distanceKm = selectedRun.defaultDistanceKm;

        if (setupGoalMode === 'distance') {
            const parsedKm = Number(setupDistanceInput);
            if (!Number.isFinite(parsedKm) || parsedKm < 0.5) {
                setSetupError('Enter at least 0.5 km.');
                return;
            }

            distanceKm = Number((Math.round(parsedKm * 10) / 10).toFixed(1));
        } else {
            const parsedMinutes = Number(setupTimeInput);
            if (!Number.isFinite(parsedMinutes) || parsedMinutes < 5) {
                setSetupError('Enter at least 5 minutes.');
                return;
            }

            distanceKm = Math.max(0.5, getEstimatedDistanceKm(parsedMinutes, estimatedPaceSecPerKm));
        }

        closeRunSetup();
        launchRun(selectedRun.templateId, distanceKm);
    };

    const handleIntervalModeSelect = (intervalMode: 'time' | 'distance') => {
        setShowIntervalModePicker(false);
        router.push({
            pathname: '/runs/interval-run',
            params: {
                intervalMode,
                source: 'allruns',
            },
        });
    };

    const handleIntervalWalkPress = () => {
        setIntervalWalkKmError(null);
        setShowIntervalWalkKmPicker(true);
    };

    const handleIntervalWalkStart = () => {
        const parsedKm = Number(intervalWalkKmInput);
        if (!Number.isFinite(parsedKm) || parsedKm < 1) {
            setIntervalWalkKmError('Enter at least 1.0 km.');
            return;
        }

        const distanceKm = (Math.round(parsedKm * 10) / 10).toFixed(1);
        setShowIntervalWalkKmPicker(false);
        router.push({
            pathname: '/runs/interval-walk',
            params: {
                distanceKm,
                intervalMode: 'distance',
                source: 'allruns',
            },
        });
    };

    const estimatedSetupDistanceKm = selectedRun
        ? getEstimatedDistanceKm(
            Math.max(0, Number(setupTimeInput) || 0),
            getTargetPaceSecPerKm(selectedRun.templateId)
        )
        : null;

    const runTypes: SetupRunConfig[] = [
        { 
            title: 'Easy Run', 
            subtitle: 'Recovery pace, light cardio', 
            color: '#2DD4BF', 
            icon: Wind,
            templateId: 'easy',
            defaultDistanceKm: 2.0,
        },
        { 
            title: 'Long Run', 
            subtitle: 'Endurance & stamina boost', 
            color: '#3B82F6', 
            icon: Compass,
            templateId: 'long',
            defaultDistanceKm: 5.0,
        },
        { 
            title: 'Intervals', 
            subtitle: 'Speed bursts, max effort', 
            color: '#F59E0B', 
            icon: Zap,
            templateId: 'interval',
            defaultDistanceKm: 3.0,
        },
        {
            title: 'Interval Walk',
            subtitle: 'Custom km, fast walk blocks',
            color: '#14B8A6',
            icon: Footprints,
            templateId: 'interval_walk',
            defaultDistanceKm: 3.0,
        },
        { 
            title: 'Walk', 
            subtitle: 'Gentle recovery movement', 
            color: '#10B981', 
            icon: Sun,
            templateId: 'walk',
            defaultDistanceKm: 2.0,
        },
        { 
            title: 'Power Walk', 
            subtitle: 'Brisk cardio, low impact', 
            color: '#8B5CF6', 
            icon: Activity,
            templateId: 'power_walk',
            defaultDistanceKm: 3.0,
        },
        { 
            title: 'Recovery', 
            subtitle: 'Very light active rest', 
            color: '#64748B', 
            icon: Armchair,
            templateId: 'easy',
            defaultDistanceKm: 1.0,
        },
        { 
            title: 'Free Run', 
            subtitle: 'Go anywhere at any pace', 
            color: THEME.primary, 
            icon: Play,
            templateId: 'freeform',
            defaultDistanceKm: 5.0,
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <Modal
                visible={showRunSetupModal}
                transparent
                animationType="fade"
                onRequestClose={closeRunSetup}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={[styles.modalEyebrow, { color: selectedRun?.color ?? THEME.primary }]}>
                            RUN SETUP
                        </Text>
                        <Text style={styles.modalTitle}>{selectedRun?.title ?? 'Choose your target'}</Text>
                        <Text style={styles.modalSubtitle}>
                            Pick a target distance or give yourself a time limit and we will set the run for you.
                        </Text>

                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                style={[
                                    styles.segmentBtn,
                                    setupGoalMode === 'distance' && styles.segmentBtnActive,
                                ]}
                                activeOpacity={0.9}
                                onPress={() => {
                                    setSetupGoalMode('distance');
                                    if (setupError) setSetupError(null);
                                }}
                            >
                                <Compass
                                    size={16}
                                    color={setupGoalMode === 'distance' ? THEME.white : THEME.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        setupGoalMode === 'distance' && styles.segmentTextActive,
                                    ]}
                                >
                                    Distance
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.segmentBtn,
                                    setupGoalMode === 'time' && styles.segmentBtnActive,
                                ]}
                                activeOpacity={0.9}
                                onPress={() => {
                                    setSetupGoalMode('time');
                                    if (setupError) setSetupError(null);
                                }}
                            >
                                <Timer
                                    size={16}
                                    color={setupGoalMode === 'time' ? THEME.white : THEME.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        setupGoalMode === 'time' && styles.segmentTextActive,
                                    ]}
                                >
                                    Time
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {setupGoalMode === 'distance' ? (
                            <>
                                <Text style={styles.inputLabel}>Distance (km)</Text>
                                <TextInput
                                    value={setupDistanceInput}
                                    onChangeText={(value) => {
                                        setSetupDistanceInput(value);
                                        if (setupError) setSetupError(null);
                                    }}
                                    keyboardType="decimal-pad"
                                    placeholder="5.0"
                                    placeholderTextColor="#94A3B8"
                                    style={styles.distanceInput}
                                />
                                <Text style={styles.helperText}>Minimum 0.5 km. Decimals are allowed.</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.inputLabel}>Time (minutes)</Text>
                                <TextInput
                                    value={setupTimeInput}
                                    onChangeText={(value) => {
                                        setSetupTimeInput(value);
                                        if (setupError) setSetupError(null);
                                    }}
                                    keyboardType="number-pad"
                                    placeholder="30"
                                    placeholderTextColor="#94A3B8"
                                    style={styles.distanceInput}
                                />
                                <Text style={styles.helperText}>
                                    {estimatedSetupDistanceKm && estimatedSetupDistanceKm > 0
                                        ? `This will target about ${estimatedSetupDistanceKm.toFixed(1)} km.`
                                        : 'Minimum 5 minutes.'}
                                </Text>
                            </>
                        )}

                        {setupError ? <Text style={styles.errorText}>{setupError}</Text> : null}

                        <TouchableOpacity
                            style={[
                                styles.modalPrimaryBtn,
                                { backgroundColor: selectedRun?.color ?? THEME.primary },
                            ]}
                            activeOpacity={0.9}
                            onPress={handleRunSetupStart}
                        >
                            <Text style={styles.modalPrimaryText}>Start Run</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            activeOpacity={0.85}
                            onPress={closeRunSetup}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showIntervalModePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowIntervalModePicker(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalEyebrow}>INTERVAL SETUP</Text>
                        <Text style={styles.modalTitle}>Choose your interval style</Text>
                        <Text style={styles.modalSubtitle}>
                            Time-based uses countdown blocks. Distance-based moves to the next block when you cover the target km.
                        </Text>

                        <TouchableOpacity
                            style={styles.modeOption}
                            activeOpacity={0.9}
                            onPress={() => handleIntervalModeSelect('time')}
                        >
                            <View style={[styles.modeIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                                <Timer size={20} color="#F59E0B" />
                            </View>
                            <View style={styles.modeTextWrap}>
                                <Text style={styles.modeTitle}>Time Based</Text>
                                <Text style={styles.modeSubtitle}>Run each block until the timer ends.</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modeOption}
                            activeOpacity={0.9}
                            onPress={() => handleIntervalModeSelect('distance')}
                        >
                            <View style={[styles.modeIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.14)' }]}>
                                <Compass size={20} color="#3B82F6" />
                            </View>
                            <View style={styles.modeTextWrap}>
                                <Text style={styles.modeTitle}>Distance Based</Text>
                                <Text style={styles.modeSubtitle}>Move on only after you cover the block distance.</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            activeOpacity={0.85}
                            onPress={() => setShowIntervalModePicker(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showIntervalWalkKmPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowIntervalWalkKmPicker(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={[styles.modalEyebrow, { color: '#14B8A6' }]}>INTERVAL WALK</Text>
                        <Text style={styles.modalTitle}>Choose your target distance</Text>
                        <Text style={styles.modalSubtitle}>
                            We will split the km into fast-walk and recovery blocks, then set each block timer from the target pace.
                        </Text>

                        <Text style={styles.inputLabel}>Distance (km)</Text>
                        <TextInput
                            value={intervalWalkKmInput}
                            onChangeText={(value) => {
                                setIntervalWalkKmInput(value);
                                if (intervalWalkKmError) setIntervalWalkKmError(null);
                            }}
                            keyboardType="decimal-pad"
                            placeholder="3.0"
                            placeholderTextColor="#94A3B8"
                            style={styles.distanceInput}
                        />

                        {intervalWalkKmError ? (
                            <Text style={styles.errorText}>{intervalWalkKmError}</Text>
                        ) : (
                            <Text style={styles.helperText}>Minimum 1.0 km. Decimals are allowed.</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.modalPrimaryBtn, { backgroundColor: '#14B8A6' }]}
                            activeOpacity={0.9}
                            onPress={handleIntervalWalkStart}
                        >
                            <Text style={styles.modalPrimaryText}>Start Interval Walk</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            activeOpacity={0.85}
                            onPress={() => setShowIntervalWalkKmPicker(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ChevronLeft size={24} color={THEME.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Run Collection</Text>
                    <Text style={styles.headerSubtitle}>Select your next challenge</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <LinearGradient
                    colors={[THEME.primary, '#FF6B6B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroContent}>
                        <View style={styles.heroTextGroup}>
                            <Text style={styles.heroSmallTitle}>READY TO MOVE?</Text>
                            <Text style={styles.heroLargeTitle}>Quick Free Run</Text>
                            <Text style={styles.heroDesc}>Standard 5km run at your own pace.</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.heroBtn}
                            onPress={() =>
                                openRunSetup({
                                    title: 'Free Run',
                                    subtitle: 'Go anywhere at any pace',
                                    color: THEME.primary,
                                    icon: Play,
                                    templateId: 'freeform',
                                    defaultDistanceKm: 5.0,
                                })
                            }
                        >
                            <Play size={20} color={THEME.primary} fill={THEME.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.heroStats}>
                        <View style={styles.heroStatItem}>
                            <Timer size={14} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.heroStatText}>~25-30 min</Text>
                        </View>
                        <View style={styles.heroStatItem}>
                            <Flame size={14} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.heroStatText}>High Burn</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>ALL CATEGORIES</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{runTypes.length}</Text>
                    </View>
                </View>

                <View style={styles.grid}>
                    {runTypes.map((item) => (
                        <RunTypeCard
                            key={item.title}
                            title={item.title}
                            subtitle={item.subtitle}
                            color={item.color}
                            icon={item.icon}
                            onPress={() => {
                                if (item.templateId === 'interval') {
                                    setShowIntervalModePicker(true);
                                    return;
                                }

                                if (item.templateId === 'interval_walk') {
                                    handleIntervalWalkPress();
                                    return;
                                }

                                openRunSetup(item);
                            }}
                        />
                    ))}
                </View>
                
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: THEME.white,
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor: THEME.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
        elevation: 12,
    },
    modalEyebrow: {
        fontSize: 11,
        fontWeight: '900',
        color: THEME.primary,
        letterSpacing: 1.4,
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: THEME.text,
        letterSpacing: -0.6,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.textMuted,
        lineHeight: 20,
        marginBottom: 18,
    },
    modeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 20,
        padding: 16,
        backgroundColor: '#F8FAFC',
        marginBottom: 12,
    },
    modeIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeTextWrap: {
        flex: 1,
    },
    modeTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: THEME.text,
        marginBottom: 2,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 18,
        padding: 4,
        marginBottom: 18,
        gap: 6,
    },
    segmentBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    segmentBtnActive: {
        backgroundColor: THEME.secondary,
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '800',
        color: THEME.textMuted,
    },
    segmentTextActive: {
        color: THEME.white,
    },
    modeSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: THEME.textMuted,
        lineHeight: 17,
    },
    modalCancelBtn: {
        marginTop: 6,
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(100, 116, 139, 0.08)',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '800',
        color: THEME.textMuted,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: THEME.text,
        marginBottom: 8,
    },
    distanceInput: {
        height: 54,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        fontSize: 20,
        fontWeight: '800',
        color: THEME.text,
        marginBottom: 10,
    },
    helperText: {
        fontSize: 12,
        fontWeight: '600',
        color: THEME.textMuted,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#DC2626',
        marginBottom: 16,
    },
    modalPrimaryBtn: {
        height: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    modalPrimaryText: {
        fontSize: 15,
        fontWeight: '900',
        color: THEME.white,
        letterSpacing: 0.2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 16,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: THEME.white,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: THEME.border,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
            android: { elevation: 2 }
        })
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: THEME.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: THEME.textMuted,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    heroCard: {
        borderRadius: 32,
        padding: 24,
        marginTop: 10,
        marginBottom: 30,
        ...Platform.select({
            ios: { shadowColor: THEME.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 15 },
            android: { elevation: 8 }
        })
    },
    heroContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroTextGroup: {
        flex: 1,
        paddingRight: 10,
    },
    heroSmallTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 1.5,
        marginBottom: 6,
    },
    heroLargeTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: THEME.white,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    heroDesc: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 20,
    },
    heroBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: THEME.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    heroStats: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 16,
    },
    heroStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    heroStatText: {
        color: THEME.white,
        fontSize: 11,
        fontWeight: '700',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: THEME.text,
        letterSpacing: 1.2,
    },
    countBadge: {
        backgroundColor: THEME.secondary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    countText: {
        color: THEME.white,
        fontSize: 10,
        fontWeight: '900',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    cardContainer: {
        width: COLUMN_WIDTH,
        backgroundColor: THEME.white,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 },
            android: { elevation: 2 }
        })
    },
    cardInner: {
        flex: 1,
    },
    cardIconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    cardContent: {
        flex: 1,
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: THEME.text,
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: THEME.textMuted,
        lineHeight: 16,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTag: {
        fontSize: 10,
        fontWeight: '900',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden',
    },
    playCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: THEME.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
