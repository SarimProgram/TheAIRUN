import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    useWindowDimensions,
    Image,
    type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { PartnerConnectArtwork } from '@/components/partner/PartnerConnectArtwork';

const COLORS = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    subtle: '#94A3B8',
    border: '#E2E8F0',
};

const HUB_ICONS = {
    marketplace: require('../../assets/tabs/store.png'),
    timeline: require('../../assets/menu/partner.png'),
    reminders: require('../../assets/menu/goals.png'),
    settings: require('../../assets/menu/settings.png'),
    wrap: require('../../assets/menu/quest.png'),
} as const;

type HubItemId = keyof typeof HUB_ICONS;

type HubItem = {
    id: HubItemId;
    title: string;
    subtitle: string;
    route: '/partner-timeline' | '/partner-reminder' | '/partner-settings' | '/partner-wrap' | '/(tabs)/marketplace';
    icon: ImageSourcePropType;
    badge?: string;
};

type PartnerConnectedHubProps = {
    userName?: string;
    partnerName?: string;
    userGender?: string | null;
    partnerGender?: string | null;
    userPoints?: number | null;
    partnerPoints?: number | null;
};

export function PartnerConnectedHub({
    userName = 'You',
    partnerName = 'Partner',
    userGender,
    partnerGender,
    userPoints,
    partnerPoints,
}: PartnerConnectedHubProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const artworkWidth = Math.min(windowWidth - 16, 440);

    const items: HubItem[] = [
        {
            id: 'marketplace',
            title: 'Marketplace',
            subtitle: 'Create and redeem rewards together',
            route: '/(tabs)/marketplace',
            icon: HUB_ICONS.marketplace,
        },
        {
            id: 'timeline',
            title: 'Timeline',
            subtitle: 'Memories, milestones, and shared moments',
            route: '/partner-timeline',
            icon: HUB_ICONS.timeline,
        },
        {
            id: 'reminders',
            title: 'Reminders',
            subtitle: 'Send step, calorie, and hydration nudges',
            route: '/partner-reminder',
            icon: HUB_ICONS.reminders,
        },
        {
            id: 'settings',
            title: 'Settings',
            subtitle: 'Manage your partner connection',
            route: '/partner-settings',
            icon: HUB_ICONS.settings,
        },
        {
            id: 'wrap',
            title: 'Weekly Wrapped',
            subtitle: 'Last week recap - steps, runs, points & more',
            route: '/partner-wrap',
            icon: HUB_ICONS.wrap,
            badge: 'New',
        },
    ];

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={['#FFF5F5', '#F8FAFC', '#F8FAFC']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom + 32, 48) },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={[
                        styles.heroHeader,
                        { paddingTop: Math.max(insets.top + 4, 12) },
                    ]}
                >
                    <LinearGradient
                        colors={['#FFE9EC', '#FFF5F5', '#FFFFFF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <PartnerConnectArtwork
                        width={artworkWidth}
                        leftName={userName}
                        rightName={partnerName}
                        leftGender={userGender}
                        rightGender={partnerGender}
                        leftPoints={userPoints ?? 0}
                        rightPoints={partnerPoints ?? 0}
                    />

                </View>

                <View style={styles.bodyContent}>
                    <View style={styles.menuSection}>
                        {items.map((item, index) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.menuRow,
                                    index === items.length - 1 && styles.menuRowLast,
                                ]}
                                activeOpacity={0.82}
                                onPress={() => router.push(item.route)}
                            >
                                <Image
                                    source={item.icon}
                                    style={styles.menuIconImage}
                                    resizeMode="contain"
                                />
                                <View style={styles.menuCopy}>
                                    <View style={styles.menuTitleRow}>
                                        <Text style={styles.menuTitle}>{item.title}</Text>
                                        {item.badge ? (
                                            <View style={styles.titleBadge}>
                                                <Text style={styles.titleBadgeText}>{item.badge}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                </View>
                                <ChevronRight size={17} color={COLORS.subtle} strokeWidth={2.4} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 0,
    },
    heroHeader: {
        overflow: 'hidden',
        alignItems: 'center',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        borderCurve: 'continuous',
        paddingBottom: 22,
        borderBottomWidth: 1,
        borderBottomColor: '#FECACA',
        boxShadow: '0 12px 28px rgba(226, 76, 91, 0.10)',
    },

    bodyContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    menuSection: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderCurve: 'continuous',
        boxShadow: Platform.select({
            ios: '0 8px 24px rgba(15, 23, 42, 0.06)',
            android: undefined,
            default: '0 8px 24px rgba(15, 23, 42, 0.06)',
        }),
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    menuRowLast: {
        borderBottomWidth: 0,
    },
    menuIconImage: {
        width: 40,
        height: 40,
    },
    menuCopy: {
        flex: 1,
        gap: 3,
    },
    menuTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.2,
    },
    titleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    titleBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#EA580C',
        letterSpacing: 0.3,
    },
    menuSubtitle: {
        fontSize: 13,
        color: COLORS.muted,
        lineHeight: 18,
    },
});
