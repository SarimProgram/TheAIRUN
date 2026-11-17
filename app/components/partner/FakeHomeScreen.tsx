import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
    Activity,
    Camera,
    ChevronUp,
    Clock,
    CloudSun,
    Compass,
    Image as ImageIcon,
    ImagePlus,
    Mail,
    Map,
    MessageCircle,
    Music,
    Phone,
    Search,
    Settings,
    StickyNote,
    type LucideIcon,
} from 'lucide-react-native';

const APP_ICON = require('../../assets/iosicon.png');
const COLUMNS = 4;
const SIDE_PADDING = 28;

type FakeApp =
    | { kind: 'icon'; label: string; Icon: LucideIcon; colors: [string, string]; glyph?: string }
    | { kind: 'calendar'; label: string }
    | { kind: 'image'; label: string };

const GRID_APPS: FakeApp[] = [
    { kind: 'calendar', label: 'Calendar' },
    { kind: 'icon', label: 'Photos', Icon: ImageIcon, colors: ['#FFFFFF', '#F1F5F9'], glyph: '#F97316' },
    { kind: 'icon', label: 'Weather', Icon: CloudSun, colors: ['#38BDF8', '#1D4ED8'] },
    { kind: 'icon', label: 'Mail', Icon: Mail, colors: ['#60A5FA', '#2563EB'] },
    { kind: 'icon', label: 'Notes', Icon: StickyNote, colors: ['#FDE68A', '#F59E0B'] },
    { kind: 'icon', label: 'Maps', Icon: Map, colors: ['#86EFAC', '#16A34A'] },
    { kind: 'icon', label: 'Clock', Icon: Clock, colors: ['#27272A', '#09090B'] },
    { kind: 'icon', label: 'Fitness', Icon: Activity, colors: ['#18181B', '#000000'], glyph: '#A3E635' },
    { kind: 'image', label: 'RunTogether' },
    { kind: 'icon', label: 'Music', Icon: Music, colors: ['#FB7185', '#E11D48'] },
    { kind: 'icon', label: 'Camera', Icon: Camera, colors: ['#D4D4D8', '#71717A'], glyph: '#18181B' },
    { kind: 'icon', label: 'Settings', Icon: Settings, colors: ['#A1A1AA', '#52525B'] },
];

const DOCK_APPS: FakeApp[] = [
    { kind: 'icon', label: 'Phone', Icon: Phone, colors: ['#4ADE80', '#16A34A'] },
    { kind: 'icon', label: 'Safari', Icon: Compass, colors: ['#FFFFFF', '#E2E8F0'], glyph: '#2563EB' },
    { kind: 'icon', label: 'Messages', Icon: MessageCircle, colors: ['#4ADE80', '#16A34A'] },
    { kind: 'icon', label: 'Music', Icon: Music, colors: ['#FB7185', '#E11D48'] },
];

function useMinuteClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            const current = new Date();
            timer = setTimeout(
                () => {
                    setNow(new Date());
                    schedule();
                },
                60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()) + 50,
            );
        };
        schedule();
        return () => clearTimeout(timer);
    }, []);
    return now;
}

type FakeHomeScreenProps = {
    wallpaperUri: string | null;
    /** Shown as a frosted chip while no wallpaper has been chosen. */
    onPickWallpaper?: () => void;
    /** Long-press on the wallpaper to change it (like editing the real Home Screen). */
    onLongPressWallpaper?: () => void;
    /** Replaces the clock inside the top frosted widget. */
    widgetContent?: React.ReactNode;
    /** Replaces "Search" in the pill above the dock with a swipe-up hint. */
    swipeHint?: string;
};

export function FakeHomeScreen({
    wallpaperUri,
    onPickWallpaper,
    onLongPressWallpaper,
    widgetContent,
    swipeHint,
}: FakeHomeScreenProps) {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const now = useMinuteClock();

    const iconSize = Math.min(64, Math.round((width - SIDE_PADDING * 2) / COLUMNS - 26));
    const cellWidth = (width - SIDE_PADDING * 2) / COLUMNS;
    const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <Pressable
            style={StyleSheet.absoluteFill}
            onLongPress={onLongPressWallpaper}
            delayLongPress={450}
            accessible={false}
        >
            <StatusBar style="light" />
            {wallpaperUri ? (
                <Image
                    source={{ uri: wallpaperUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={220}
                />
            ) : (
                <LinearGradient
                    colors={['#1E1B4B', '#4338CA', '#C026D3', '#F97316']}
                    locations={[0, 0.38, 0.72, 1]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            )}
            <LinearGradient
                colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.22)']}
                locations={[0, 0.22, 0.7, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />

            <View style={[styles.content, { paddingTop: insets.top + 14 }]} pointerEvents="box-none">
                <View
                    style={[styles.widget, { marginHorizontal: SIDE_PADDING - 6 }]}
                    pointerEvents={widgetContent ? 'box-none' : 'none'}
                >
                    <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
                    {widgetContent ?? (
                        <>
                            <Text style={styles.widgetTime}>{time}</Text>
                            <Text style={styles.widgetDate}>{date}</Text>
                        </>
                    )}
                </View>

                {!wallpaperUri && onPickWallpaper ? (
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)}>
                        <Pressable
                            onPress={onPickWallpaper}
                            style={styles.wallpaperChip}
                            accessibilityRole="button"
                            accessibilityLabel="Use your own wallpaper"
                        >
                            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                            <ImagePlus size={15} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.wallpaperChipText}>Use your wallpaper</Text>
                        </Pressable>
                    </Animated.View>
                ) : null}

                <View style={[styles.grid, { paddingHorizontal: SIDE_PADDING }]} pointerEvents="none">
                    {GRID_APPS.map((app, index) => (
                        <View key={`${app.label}-${index}`} style={[styles.cell, { width: cellWidth }]}>
                            <FakeAppIcon app={app} size={iconSize} now={now} />
                            <Text style={styles.cellLabel} numberOfLines={1}>
                                {app.label}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.flex} pointerEvents="none" />

                <View style={styles.searchPill} pointerEvents="none">
                    <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                    {swipeHint ? (
                        <ChevronUp size={13} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                        <Search size={12} color="#FFFFFF" strokeWidth={3} />
                    )}
                    <Text style={styles.searchText}>{swipeHint ?? 'Search'}</Text>
                </View>

                <View style={[styles.dock, { marginBottom: Math.max(insets.bottom - 12, 10) }]} pointerEvents="none">
                    <BlurView intensity={44} tint="light" style={StyleSheet.absoluteFill} />
                    {DOCK_APPS.map((app) => (
                        <FakeAppIcon key={app.label} app={app} size={iconSize} now={now} />
                    ))}
                </View>
            </View>
        </Pressable>
    );
}

function FakeAppIcon({ app, size, now }: { app: FakeApp; size: number; now: Date }) {
    const radius = size * 0.225;
    const frame = { width: size, height: size, borderRadius: radius };

    if (app.kind === 'calendar') {
        return (
            <View style={[styles.icon, styles.calendar, frame]}>
                <Text style={[styles.calendarDay, { fontSize: size * 0.16 }]}>
                    {now.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
                </Text>
                <Text style={[styles.calendarDate, { fontSize: size * 0.48, lineHeight: size * 0.54 }]}>
                    {now.getDate()}
                </Text>
            </View>
        );
    }

    if (app.kind === 'image') {
        return <Image source={APP_ICON} style={[styles.icon, frame]} contentFit="cover" />;
    }

    const { Icon, colors, glyph } = app;
    return (
        <LinearGradient colors={colors} style={[styles.icon, styles.iconCenter, frame]}>
            <Icon size={size * 0.5} color={glyph ?? '#FFFFFF'} strokeWidth={2.1} />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    widget: {
        height: 150,
        borderRadius: 24,
        borderCurve: 'continuous',
        overflow: 'hidden',
        paddingHorizontal: 20,
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    widgetTime: {
        fontSize: 64,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -2,
        fontVariant: ['tabular-nums'],
    },
    widgetDate: {
        marginTop: -2,
        fontSize: 15,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.82)',
    },
    wallpaperChip: {
        alignSelf: 'center',
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    wallpaperChipText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    grid: {
        marginTop: 22,
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 18,
    },
    cell: {
        alignItems: 'center',
    },
    cellLabel: {
        marginTop: 6,
        fontSize: 11.5,
        fontWeight: '600',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    icon: {
        borderCurve: 'continuous',
        overflow: 'hidden',
    },
    iconCenter: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendar: {
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarDay: {
        fontWeight: '700',
        color: '#EF4444',
        marginTop: 2,
    },
    calendarDate: {
        fontWeight: '400',
        color: '#111827',
    },
    searchPill: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 14,
    },
    searchText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    dock: {
        marginHorizontal: 12,
        height: 94,
        borderRadius: 34,
        borderCurve: 'continuous',
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
});
