import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    Share as NativeShare,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Camera,
    Download,
    Flame,
    Play,
    Scale,
    Share2,
    Target,
    Users,
    X,
    Zap
} from 'lucide-react-native';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/src/auth/authContext';

const { width } = Dimensions.get('window');

const COLORS = {
    primary: '#24D2B8',
    secondary: '#FF6B9E',
    accent: '#8B5CF6',
    textLight: '#FFFFFF',
    textDim: 'rgba(255,255,255,0.74)',
    surface: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.18)',
    overlay: 'rgba(6, 12, 24, 0.42)',
    overlayStrong: 'rgba(6, 12, 24, 0.74)',
    bgLight: '#F8FAFC',
    textDark: '#0F172A',
    textMuted: '#64748B',
    borderLight: '#F1F5F9',
};


type RunResultData = {
    distance: string;
    time: string;
    calories: number;
    partners?: string;
    goalText?: string;
    partnerName?: string | null;
    weightKg?: number | null;
};

type RunResultScreenProps = {
    data: RunResultData;
    onDone?: () => void;
    onSkip?: () => void;
};

type ResultMeta = {
    displayName: string;
    partnerName: string | null;
    weightKg: number | null;
    loading: boolean;
};

function formatWeight(weightKg: number | null | undefined) {
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg)) return '--';
    return weightKg.toFixed(1);
}

export const RunResultScreen = ({ data, onDone, onSkip }: RunResultScreenProps) => {
    const { authFetch } = useAuth();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [libraryPermission, requestLibraryPermission] = MediaLibrary.usePermissions();
    const cameraRef = useRef<CameraView | null>(null);
    const viewShotRef = useRef<ViewShot | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [hasStartedPhotoFlow, setHasStartedPhotoFlow] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [meta, setMeta] = useState<ResultMeta>({
        displayName: 'You',
        partnerName: data.partnerName ?? null,
        weightKg: data.weightKg ?? null,
        loading: true,
    });

    useEffect(() => {
        let active = true;

        const loadMeta = async () => {
            try {
                const [profileRes, partnerRes, weightRes] = await Promise.allSettled([
                    authFetch(`${API_BASE_URL}/profile`),
                    authFetch(`${API_BASE_URL}/partner`),
                    authFetch(`${API_BASE_URL}/weight`),
                ]);

                let displayName = 'You';
                let partnerName = data.partnerName ?? null;
                let weightKg = data.weightKg ?? null;

                if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
                    const profileJson = await profileRes.value.json();
                    displayName = profileJson?.user?.displayName || displayName;
                    weightKg = profileJson?.user?.weightKg ?? weightKg;
                }

                if (partnerRes.status === 'fulfilled' && partnerRes.value.ok) {
                    const partnerJson = await partnerRes.value.json();
                    partnerName = partnerJson?.hasPartner ? partnerJson?.partner?.displayName ?? partnerName : null;
                }

                if (weightRes.status === 'fulfilled' && weightRes.value.ok) {
                    const weightJson = await weightRes.value.json();
                    weightKg = weightJson?.currentWeight ?? weightKg;
                }

                if (!active) return;
                setMeta({
                    displayName,
                    partnerName,
                    weightKg,
                    loading: false,
                });
            } catch {
                if (!active) return;
                setMeta((prev) => ({ ...prev, loading: false }));
            }
        };

        loadMeta();

        return () => {
            active = false;
        };
    }, [authFetch, data.partnerName, data.weightKg]);

    const partnerLine = useMemo(() => {
        if (meta.partnerName) return `${meta.displayName} & ${meta.partnerName}`.toUpperCase();
        if (data.partners && data.partners !== 'Solo Run') return data.partners.toUpperCase();
        return (meta.displayName || 'You').toUpperCase();
    }, [data.partners, meta.displayName, meta.partnerName]);

    const goalHeadline = data.goalText || 'RUN COMPLETE';
    const weightLabel = formatWeight(meta.weightKg);
    const showSummaryScreen = !hasStartedPhotoFlow && !isCameraActive && !capturedImage;

    const buildShareAsset = async () => {
        if (!viewShotRef.current) {
            throw new Error('No capture view available');
        }
        return captureRef(viewShotRef, { format: 'jpg', quality: 0.96 });
    };

    const handleCapture = async () => {
        if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res.granted) return;
        }
        if (!cameraRef.current) return;
        const photo = await cameraRef.current.takePictureAsync({ quality: 1.0 });
        setCapturedImage(photo.uri);
        setIsCameraActive(false);
    };

    const handleStartPhotoFlow = async () => {
        if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res.granted) return;
        }
        setHasStartedPhotoFlow(true);
        setIsCameraActive(true);
    };

    const handleSave = async () => {
        try {
            setIsExporting(true);
            const { status } = await requestLibraryPermission();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow gallery access to save your finish card.');
                return;
            }
            const uri = await buildShareAsset();
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert('Saved', 'Your finish card is in the gallery.');
        } catch {
            Alert.alert('Save failed', 'Could not save your finish card.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleShare = async () => {
        try {
            setIsExporting(true);
            const uri = await buildShareAsset();
            await NativeShare.share({
                title: 'My run finish card',
                message: `${goalHeadline} • ${data.distance} km in ${data.time}`,
                url: uri,
            });
        } catch {
            Alert.alert('Share failed', 'Could not open the share sheet.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setHasStartedPhotoFlow(true);
        setIsCameraActive(true);
    };

    const handleSkip = () => {
        setIsCameraActive(false);
        if (onSkip) {
            onSkip();
            return;
        }
        onDone?.();
    };

    if (showSummaryScreen) {
        return (
            <View style={styles.summaryContainer}>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView style={styles.summarySafe}>
                    <ScrollView 
                        contentContainerStyle={styles.summaryScroll}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.bentoHeader}>
                            <View style={styles.bentoHeroPill}>
                                <Text style={styles.bentoHeroPillText}>{goalHeadline}</Text>
                            </View>
                            <Text style={styles.bentoTitle}>Session{"\n"}Complete.</Text>
                        </View>

                        <View style={styles.bentoGrid}>
                            <View style={styles.bentoDistanceCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>TOTAL DISTANCE</Text>
                                    <Target size={16} color={COLORS.primary} />
                                </View>
                                <Text style={styles.bentoValueHero} adjustsFontSizeToFit numberOfLines={1}>
                                    {data.distance}
                                </Text>
                                <Text style={styles.bentoUnitHero}>KILOMETERS</Text>
                            </View>

                            <View style={styles.bentoRow}>
                                <View style={[styles.bentoCardSmall, styles.performanceCard]}>
                                    <View style={styles.performanceLabelRow}>
                                        <Text style={styles.bentoLabelSmall}>TIME</Text>
                                        <Play size={10} color="#64748B" />
                                    </View>
                                    <Text style={styles.bentoValueSmall}>{data.time}</Text>
                                </View>
                                <View style={[styles.bentoCardSmall, styles.performanceCard]}>
                                    <View style={styles.performanceLabelRow}>
                                        <Text style={[styles.bentoLabelSmall, { color: COLORS.secondary }]}>ENERGY</Text>
                                        <Flame size={10} color={COLORS.secondary} />
                                    </View>
                                    <Text style={[styles.bentoValueSmall, { color: COLORS.secondary }]}>
                                        {data.calories}
                                        <Text style={styles.bentoUnitTiny}> KCAL</Text>
                                    </Text>
                                </View>

                            </View>

                            <View style={styles.bentoMetaCard}>
                                <View style={styles.bentoMetaItem}>
                                    <Users size={14} color="#64748B" />
                                    <Text style={styles.bentoMetaText}>{partnerLine}</Text>
                                </View>
                                <View style={styles.bentoMetaDivider} />
                                <View style={styles.bentoMetaItem}>
                                    <Scale size={14} color="#64748B" />
                                    <Text style={styles.bentoMetaText}>{weightLabel} KG</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.bentoFooter}>
                            <TouchableOpacity style={styles.bentoPrimaryBtn} onPress={handleStartPhotoFlow}>
                                <Text style={styles.bentoPrimaryBtnText}>SAVE MEMORY</Text>
                                <Camera color="white" size={20} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.bentoSecondaryBtn} onPress={handleSkip}>
                                <Text style={styles.bentoSecondaryBtnText}>Skip and finish</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }





    return (
        <View style={styles.container}>
            <StatusBar hidden />

            <ViewShot ref={viewShotRef} style={styles.captureContainer}>
                {isCameraActive ? (
                    <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing="front" />
                ) : capturedImage ? (
                    <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFillObject} />
                ) : (
                    <LinearGradient
                        colors={['#07111E', '#132238', '#1F1431']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                )}

                <LinearGradient
                    colors={['rgba(0,0,0,0.14)', COLORS.overlay, COLORS.overlayStrong]}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.captureContent}>
                    <View style={styles.headerBlock}>
                        <View style={styles.topMetaRow}>
                            <Users size={14} color={COLORS.secondary} />
                            <Text style={styles.partnerLineHeader}>{partnerLine}</Text>
                        </View>
                        <Text style={styles.brandTextHeader}>RunTogether App</Text>
                    </View>



                    <View style={styles.statsSidebar}>
                        <View style={styles.sidebarStatItem}>
                            <Text style={styles.sidebarLabel}>DISTANCE</Text>
                            <Text style={[styles.sidebarValue, { color: COLORS.primary }]}>
                                {data.distance}
                                <Text style={styles.sidebarUnit}> KM</Text>
                            </Text>
                        </View>

                        <View style={styles.sidebarStatItem}>
                            <Text style={styles.sidebarLabel}>DURATION</Text>
                            <Text style={styles.sidebarValue}>{data.time}</Text>
                        </View>

                        <View style={styles.sidebarStatItem}>
                            <Text style={styles.sidebarLabel}>ENERGY</Text>
                            <Text style={[styles.sidebarValue, { color: COLORS.secondary }]}>
                                {data.calories}
                                <Text style={styles.sidebarUnit}> KCAL</Text>
                            </Text>
                        </View>
                    </View>


                    <View style={styles.brandFooter}>
                        {/* Footer text moved to header per user request */}
                    </View>



                </View>
            </ViewShot>

            <SafeAreaView style={styles.uiOverlay} pointerEvents="box-none">
                {isCameraActive ? (
                    <View style={styles.cameraHud}>
                        <View style={styles.cameraTip}>
                            {/* Instruction text removed per user request */}
                        </View>

                        <TouchableOpacity style={styles.shutter} onPress={handleCapture}>
                            <View style={styles.shutterInner} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.closeCam}
                            onPress={() => {
                                setIsCameraActive(false);
                                if (!capturedImage) {
                                    setHasStartedPhotoFlow(false);
                                }
                            }}
                        >
                            <X color="white" size={28} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                            <Text style={styles.skipText}>SKIP</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.ctaPanel}>
                        {!capturedImage ? (
                            <>
                                <View style={styles.overlayHeader}>
                                    <Text style={styles.heroTitleOverlay}>Ready to finish?</Text>
                                    <Text style={styles.heroSubtitleOverlay}>
                                        Add a photo to create your finish card and lock in the win.
                                    </Text>
                                </View>

                                <TouchableOpacity style={styles.mainBtn} onPress={() => setIsCameraActive(true)}>
                                    <Camera color="#05111D" size={22} />
                                    <Text style={styles.mainBtnText}>CREATE FINISH PHOTO</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.skipBtnInline} onPress={handleSkip}>
                                    <Text style={styles.skipTextInline}>Skip for now</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.postCapture}>
                                <View style={styles.compactActionRow}>
                                    <TouchableOpacity style={styles.glassBtnSmall} onPress={handleRetake}>
                                        <Camera color="white" size={16} />
                                        <Text style={styles.glassBtnTextSmall}>RETAKE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.glassBtnSmall} onPress={handleSave} disabled={isExporting}>
                                        <Download color="white" size={16} />
                                        <Text style={styles.glassBtnTextSmall}>SAVE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.glassBtnSmall} onPress={handleShare} disabled={isExporting}>
                                        <Share2 color="white" size={16} />
                                        <Text style={styles.glassBtnTextSmall}>SHARE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.glassBtnSmall, { backgroundColor: COLORS.primary }]} 
                                        onPress={onDone} 
                                        disabled={isExporting}
                                    >
                                        <Text style={[styles.glassBtnTextSmall, { color: '#05111D' }]}>DONE</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                        )}
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
};

export default RunResultScreen;

const styles = StyleSheet.create({
    summaryContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    summarySafe: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    summaryScroll: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 40,
    },
    bentoHeader: {
        marginBottom: 24,
    },

    bentoHeroPill: {
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    bentoHeroPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    bentoTitle: {
        fontSize: 52,
        lineHeight: 52,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -2,
        fontStyle: 'italic',
    },
    bentoGrid: {
        gap: 16,
        marginBottom: 32,
    },
    bentoDistanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 24,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.05)',
    },
    bentoCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    bentoLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: 'rgba(15, 23, 42, 0.45)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    bentoValueHero: {
        fontSize: 92,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -5,
        lineHeight: 92,
        fontStyle: 'italic',
        fontVariant: ['tabular-nums'],
    },
    bentoUnitHero: {
        fontSize: 14,
        fontWeight: '900',
        color: COLORS.primary,
        letterSpacing: 1,
        marginTop: -4,
        textTransform: 'uppercase',
    },
    bentoRow: {
        flexDirection: 'row',
        gap: 16,
    },
    bentoCardSmall: {
        flex: 1,
        padding: 20,
        borderRadius: 28,
        justifyContent: 'center',
    },
    performanceCard: {
        backgroundColor: '#FFFFFF',
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.03)',
    },
    performanceLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    bentoLabelSmall: {
        fontSize: 10,
        fontWeight: '900',
        color: 'rgba(15, 23, 42, 0.45)',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    bentoValueSmall: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -1,
        fontStyle: 'italic',
        fontVariant: ['tabular-nums'],
    },
    bentoUnitTiny: {
        fontSize: 12,
        color: 'rgba(15, 23, 42, 0.3)',
        fontStyle: 'normal',
    },
    bentoMetaCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(15, 23, 42, 0.03)',
    },

    bentoMetaItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    bentoMetaText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    bentoMetaDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 16,
    },
    bentoFooter: {
        gap: 12,
    },
    bentoPrimaryBtn: {
        backgroundColor: '#0F172A',
        height: 72,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 6,
    },
    bentoPrimaryBtnText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 1,
    },
    bentoSecondaryBtn: {
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bentoSecondaryBtnText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '800',
    },




    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    captureContainer: {
        flex: 1,
    },
    captureContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 56,
        paddingBottom: 220,
        justifyContent: 'space-between',
    },

    topMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    partnerLineHeader: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
    },
    brandTextHeader: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 4,
        marginLeft: 24,
    },

    partnerNamesOverlay: {
        display: 'none',
    },


    goalPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    goalPillText: {
        color: COLORS.textLight,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerBlock: {
        marginTop: 18,
    },
    partnerNames: {
        color: COLORS.textLight,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 2,
    },
    partnerAccent: {
        width: 48,
        height: 4,
        borderRadius: 999,
        backgroundColor: COLORS.secondary,
        marginTop: 6,
        marginBottom: 18,
    },
    heroTitle: {
        color: COLORS.textLight,
        fontSize: 34,
        fontWeight: '900',
        lineHeight: 38,
        letterSpacing: -1,
        maxWidth: width * 0.78,
    },
    heroSubtitle: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 21,
        marginTop: 10,
        maxWidth: width * 0.84,
    },
    statsBoardVertical: {
        gap: 12,
    },

    brandFooter: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    brandText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: -0.5,
        opacity: 0.9,
    },
    statsSidebar: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 28,
    },

    sidebarStatItem: {
        alignItems: 'center',
    },

    sidebarLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 2,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
    },
    sidebarValue: {
        color: '#FFFFFF',
        fontSize: 44,
        fontWeight: '900',
        letterSpacing: -1.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
    },
    sidebarUnit: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
    },


    overlayHeader: {
        marginBottom: 8,
    },
    heroTitleOverlay: {
        color: COLORS.textLight,
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    heroSubtitleOverlay: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
        marginTop: 4,
    },

    weightBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.36)',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    partnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    badgeLabel: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    badgeValue: {
        color: COLORS.textLight,
        fontSize: 22,
        fontWeight: '900',
        marginTop: 2,
    },
    badgeUnit: {
        fontSize: 12,
        color: COLORS.textDim,
    },
    badgeCopy: {
        color: COLORS.textLight,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
        maxWidth: width * 0.62,
    },
    uiOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    cameraHud: {
        minHeight: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraTip: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    cameraTipTitle: {
        color: COLORS.textLight,
        fontSize: 15,
        fontWeight: '900',
    },
    cameraTipText: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    shutter: {
        width: 86,
        height: 86,
        borderRadius: 43,
        borderWidth: 4,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    shutterInner: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: COLORS.primary,
    },
    closeCam: {
        position: 'absolute',
        top: 18,
        right: 0,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.28)',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    skipBtn: {
        position: 'absolute',
        top: 18,
        left: 0,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.32)',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    skipText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 1,
    },
    ctaPanel: {
        gap: 16,
    },
    mainBtn: {
        backgroundColor: COLORS.primary,
        height: 64,
        borderRadius: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 18,
        elevation: 8,
    },

    mainBtnText: {
        color: '#05111D',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 1,
    },
    skipBtnInline: {
        alignSelf: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    skipTextInline: {
        color: 'white',
        fontWeight: '800',
        fontSize: 13,
        opacity: 0.82,
    },
    postCapture: {
        gap: 12,
    },
    compactActionRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 4,
        paddingBottom: 20,
    },
    glassBtnSmall: {
        flex: 1,
        height: 48,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    glassBtnTextSmall: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },

});
