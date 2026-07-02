import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated, PanResponder, Dimensions } from 'react-native';
import { MessageCircle, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useChat } from '../../contexts/ChatContext';

const COLORS = {
    coral: '#FF6B6B',
    dark: '#1E293B',
};

export function GlobalChatNotification() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const { unreadCount, latestMessage } = useChat();
    const [showPopup, setShowPopup] = useState(false);
    const [currentLatestId, setCurrentLatestId] = useState<string | null>(null);
    const isRaceScreen = pathname === '/Race' || pathname === '/(tabs)/Race';
    const isOnboardingScreen =
        pathname === '/Onboarding' ||
        pathname === '/(tabs)/Onboarding' ||
        pathname.startsWith('/Onboarding/') ||
        pathname.startsWith('/(tabs)/Onboarding/');
    const isWelcomeScreen =
        pathname === '/welcome' ||
        pathname.startsWith('/welcome/');
    const isPartnerScreen =
        pathname === '/Partner' ||
        pathname === '/(tabs)/Partner' ||
        pathname.startsWith('/Partner/') ||
        pathname.startsWith('/(tabs)/Partner/');
    const isRunScreen =
        pathname === '/runs/runscreen' ||
        pathname.startsWith('/runs/runscreen/');
    const isIntervalRunScreen =
        pathname === '/runs/interval-run' ||
        pathname.startsWith('/runs/interval-run/');
    const windowDims = Dimensions.get('window');
    const bubbleHeight = 55;
    const minY = insets.top + 12;
    const maxY = Math.max(minY, windowDims.height - insets.bottom - bubbleHeight - 100);
    const initialY = Math.min(maxY, Math.max(minY, windowDims.height * 0.45));
    const bubbleTop = useRef(new RNAnimated.Value(initialY)).current;
    const lastTop = useRef(initialY);

    useEffect(() => {
        const clampedTop = Math.min(maxY, Math.max(minY, lastTop.current));
        lastTop.current = clampedTop;
        bubbleTop.setValue(clampedTop);
    }, [bubbleTop, maxY, minY]);

    useEffect(() => {
        console.log('[GlobalChatNotification] State update:', { unreadCount, latestId: latestMessage?.id, showPopup });
        if (latestMessage && latestMessage.id !== currentLatestId) {
            setCurrentLatestId(latestMessage.id);
            setShowPopup(true);
            const timer = setTimeout(() => setShowPopup(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [latestMessage, currentLatestId]);

    const handleNavigate = () => {
        setShowPopup(false);
        router.push({
            pathname: '/(tabs)',
            params: {
                openChat: '1',
                chatJump: String(Date.now()),
            },
        });
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    Math.abs(gestureState.dy) > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
                onPanResponderGrant: () => {
                    bubbleTop.stopAnimation((value: number) => {
                        lastTop.current = value;
                    });
                },
                onPanResponderMove: (_, gestureState) => {
                    const nextTop = Math.min(maxY, Math.max(minY, lastTop.current + gestureState.dy));
                    bubbleTop.setValue(nextTop);
                },
                onPanResponderRelease: (_, gestureState) => {
                    const releasedTop = Math.min(maxY, Math.max(minY, lastTop.current + gestureState.dy));
                    lastTop.current = releasedTop;
                    RNAnimated.spring(bubbleTop, {
                        toValue: releasedTop,
                        useNativeDriver: false,
                        tension: 140,
                        friction: 14,
                    }).start();
                },
            }),
        [bubbleTop, maxY, minY]
    );

    if (isRaceScreen || isOnboardingScreen || isWelcomeScreen || isPartnerScreen || isRunScreen || isIntervalRunScreen) {
        return null;
    }

    return (
        <>
            {/* TOP POPUP */}
            {showPopup && latestMessage && unreadCount > 0 && (
                <Animated.View 
                    entering={FadeInDown.duration(400)}
                    exiting={FadeOut.duration(300)}
                    style={[styles.notificationPopup, { top: insets.top + 10 }]}
                >
                    <TouchableOpacity 
                        style={styles.notificationInner} 
                        activeOpacity={0.9}
                        onPress={handleNavigate}
                    >
                        <View style={styles.notifIcon}>
                            <MessageCircle size={18} color="#FFF" />
                        </View>
                        <View style={styles.notifContent}>
                            <Text style={styles.notifName}>{latestMessage.fromName}</Text>
                            <Text style={styles.notifText} numberOfLines={1}>{latestMessage.content}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowPopup(false)} style={styles.closeBtn}>
                            <X size={14} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* FLOATING SIDE BUBBLE */}
            <RNAnimated.View
                {...panResponder.panHandlers}
                style={[
                    styles.sideBubbleContainer,
                    {
                        top: bubbleTop,
                    },
                ]}
            >
                <TouchableOpacity 
                    style={styles.sideBubble} 
                    activeOpacity={0.8}
                    onPress={handleNavigate}
                >
                    <LinearGradient
                        colors={[COLORS.coral, '#F43F5E']}
                        style={styles.sideBubbleGradient}
                    >
                        <MessageCircle size={24} color="#FFF" />
                        {unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </RNAnimated.View>
        </>
    );
}

const styles = StyleSheet.create({
    notificationPopup: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 10000,
    },
    notificationInner: {
        backgroundColor: COLORS.dark,
        borderRadius: 20,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    notifIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.coral,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    notifContent: {
        flex: 1,
    },
    notifName: {
        fontSize: 12,
        fontWeight: '900',
        color: COLORS.coral,
        textTransform: 'uppercase',
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    notifText: {
        fontSize: 14,
        color: '#FFF',
        fontWeight: '600',
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    },
    sideBubbleContainer: {
        position: 'absolute',
        right: 0,
        zIndex: 9999,
    },
    sideBubble: {
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    sideBubbleGradient: {
        width: 65,
        height: 55,
        borderTopLeftRadius: 30,
        borderBottomLeftRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 8,
    },
    unreadBadge: {
        position: 'absolute',
        top: 6,
        left: 14,
        backgroundColor: '#FFF',
        paddingHorizontal: 6,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.coral,
        minWidth: 20,
    },
    unreadBadgeText: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.coral,
    },
});
