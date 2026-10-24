import React from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Droplets, Heart, Swords } from 'lucide-react-native';
import { COLORS as NOTE_COLORS, mono } from '@/components/chat/partnerNoteShared';
import type { PartnerReminderOption } from '@/components/partner/ReminderPartner';
import { AnimatedBeggingCat } from '@/components/partner/AnimatedBeggingCat';

type ReminderPartnerCardPreviewProps = {
    option: PartnerReminderOption;
    messagePreview: string;
    variant?: 'compact' | 'large';
    fillFrame?: boolean;
};

function isPersonalReminderEyebrow(eyebrow?: string) {
    return eyebrow?.includes('YOUR REMINDER') || eyebrow?.includes('CUSTOM');
}

function FullscreenMiniPreview({
    option,
    messagePreview,
    large = false,
    fillFrame = false,
}: {
    option: PartnerReminderOption;
    messagePreview: string;
    large?: boolean;
    fillFrame?: boolean;
}) {
    const isAngry = option.mode === 'angry';
    const isPhoto = option.mode === 'cat' || option.mode === 'photo';
    const gradientColors = isAngry
        ? (['#450A0A', '#991B1B', '#DC2626'] as const)
        : isPhoto
          ? isPersonalReminderEyebrow(option.previewEyebrow)
              ? (['#881337', '#FF6B6B', '#FECDD3'] as const)
              : option.previewEyebrow.includes('HYDRATION')
              ? (['#0C4A6E', '#0369A1', '#7DD3FC'] as const)
              : option.previewEyebrow.includes('CALORIE')
                ? (['#431407', '#9A3412', '#FB923C'] as const)
                : (['#14532D', '#15803D', '#4ADE80'] as const)
          : (['#831843', '#BE185D', '#FB7185'] as const);

    return (
        <View style={[styles.fullscreenFrame, fillFrame && styles.fullscreenFrameFill]}>
            <LinearGradient
                colors={gradientColors}
                style={[
                    styles.fullscreenGradient,
                    large && styles.fullscreenGradientLarge,
                    fillFrame && styles.fullscreenGradientFill,
                ]}
            >
                <View style={styles.fullscreenBody}>
                    {isPhoto && option.previewImage ? (
                        <AnimatedBeggingCat
                            source={option.previewImage}
                            animation={option.photoAnimation}
                            style={[styles.catHero, large && styles.catHeroLarge, fillFrame && styles.catHeroFill]}
                        />
                    ) : isAngry ? (
                        <Text style={[styles.heroEmoji, large && styles.heroEmojiLarge]}>😠</Text>
                    ) : (
                        <Heart size={large ? 40 : 16} color="#FFFFFF" fill="#FFFFFF" />
                    )}
                    <Text style={[styles.fullscreenEyebrow, large && styles.fullscreenEyebrowLarge]} numberOfLines={1}>
                        {option.previewEyebrow}
                    </Text>
                    <Text
                        style={[
                            styles.fullscreenTitle,
                            isAngry && styles.fullscreenTitleAngry,
                            large && styles.fullscreenTitleLarge,
                            large && isAngry && styles.fullscreenTitleAngryLarge,
                        ]}
                        numberOfLines={large ? 3 : 2}
                    >
                        {option.previewTitle}
                    </Text>
                    {option.isUserCustom && messagePreview.trim() ? (
                        <Text
                            style={[
                                styles.fullscreenMessage,
                                large && styles.fullscreenMessageLarge,
                            ]}
                            numberOfLines={large ? 4 : 2}
                        >
                            {messagePreview}
                        </Text>
                    ) : null}
                    <Text style={[styles.fullscreenFrom, large && styles.fullscreenFromLarge]}>From your partner</Text>
                </View>
            </LinearGradient>
            {!large && !fillFrame ? (
                <View style={styles.fullscreenBadge}>
                    <Text style={styles.fullscreenBadgeText}>Fullscreen</Text>
                </View>
            ) : null}
        </View>
    );
}

function NotificationCardMiniPreview({
    option,
    messagePreview,
    large = false,
    fillFrame = false,
}: {
    option: PartnerReminderOption;
    messagePreview: string;
    large?: boolean;
    fillFrame?: boolean;
}) {
    return (
        <View style={[styles.notifFrame, fillFrame && styles.notifFrameFill]}>
            <LinearGradient
                colors={['#E0F2FE', '#BAE6FD', '#7DD3FC']}
                style={[
                    styles.notifGradient,
                    large && styles.notifGradientLarge,
                    fillFrame && styles.notifGradientFill,
                ]}
            >
                {option.previewImage ? (
                    <Image
                        source={option.previewImage}
                        style={[
                            styles.notifImage,
                            large && styles.notifImageLarge,
                            fillFrame && styles.notifImageFill,
                        ]}
                        resizeMode="contain"
                    />
                ) : null}
                <View style={styles.notifCopy}>
                    <View style={styles.notifEyebrowRow}>
                        <Droplets size={large ? 12 : 8} color="#0369A1" strokeWidth={2.4} />
                        <Text
                            style={[styles.notifEyebrow, large && styles.notifEyebrowLarge]}
                            numberOfLines={1}
                        >
                            {option.previewEyebrow}
                        </Text>
                    </View>
                    <Text
                        style={[styles.notifTitle, large && styles.notifTitleLarge]}
                        numberOfLines={large ? 3 : 2}
                    >
                        {option.previewTitle}
                    </Text>
                    {large ? (
                        <Text style={styles.notifMessageLarge} numberOfLines={4}>
                            {messagePreview}
                        </Text>
                    ) : null}
                </View>
            </LinearGradient>
            {!large && !fillFrame ? (
                <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>Reminder</Text>
                </View>
            ) : null}
        </View>
    );
}

function ChatMiniPreview({
    text,
    tag,
    large = false,
    fillFrame = false,
}: {
    text: string;
    tag?: 'steps' | 'kcal';
    large?: boolean;
    fillFrame?: boolean;
}) {
    return (
        <View style={[styles.chatFrame, large && styles.chatFrameLarge, fillFrame && styles.chatFrameFill]}>
            <View style={[styles.chatTape, large && styles.chatTapeLarge]} />
            <View style={[styles.chatNote, large && styles.chatNoteLarge]}>
                <Text style={[styles.chatSender, large && styles.chatSenderLarge]}>You</Text>
                <Text style={[styles.chatBody, large && styles.chatBodyLarge]} numberOfLines={large ? 6 : 3}>
                    {text}
                </Text>
                {tag === 'steps' ? (
                    <View style={styles.chatTag}>
                        <Swords size={large ? 10 : 8} color={NOTE_COLORS.inkFaded} strokeWidth={3} />
                        <Text style={[styles.chatTagText, large && styles.chatTagTextLarge]}>STEP BATTLE</Text>
                    </View>
                ) : null}
                {tag === 'kcal' ? (
                    <View style={[styles.chatTag, styles.chatTagKcal]}>
                        <AlertTriangle size={large ? 10 : 8} color="#B45309" strokeWidth={3} />
                        <Text style={[styles.chatTagText, styles.chatTagTextKcal, large && styles.chatTagTextLarge]}>
                            CALORIE CHECK
                        </Text>
                    </View>
                ) : null}
            </View>
            {!large ? (
                <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>Chat note</Text>
                </View>
            ) : null}
        </View>
    );
}

export function ReminderPartnerCardPreview({
    option,
    messagePreview,
    variant = 'compact',
    fillFrame = false,
}: ReminderPartnerCardPreviewProps) {
    const large = variant === 'large' || fillFrame;

    if (option.delivery === 'notification-card') {
        return (
            <NotificationCardMiniPreview
                option={option}
                messagePreview={messagePreview}
                large={large}
                fillFrame={fillFrame}
            />
        );
    }

    if (option.delivery === 'fullscreen' && option.mode) {
        return (
            <FullscreenMiniPreview
                option={option}
                messagePreview={messagePreview}
                large={large}
                fillFrame={fillFrame}
            />
        );
    }

    return <ChatMiniPreview text={messagePreview} tag={option.chatTag} large={large} fillFrame={fillFrame} />;
}

const styles = StyleSheet.create({
    fullscreenFrame: {
        flex: 1,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 0,
    },
    fullscreenFrameFill: {
        borderRadius: 0,
    },
    fullscreenGradient: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenGradientLarge: {
        paddingHorizontal: 24,
        paddingVertical: 24,
    },
    fullscreenGradientFill: {
        paddingHorizontal: 28,
        paddingVertical: 40,
    },
    fullscreenBody: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    heroEmoji: {
        fontSize: 20,
    },
    heroEmojiLarge: {
        fontSize: 48,
    },
    catHero: {
        width: 72,
        height: 72,
        marginBottom: 2,
    },
    catHeroLarge: {
        width: 160,
        height: 160,
        marginBottom: 8,
    },
    catHeroFill: {
        width: 200,
        height: 200,
    },
    fullscreenEyebrow: {
        fontSize: 6,
        fontWeight: '900',
        letterSpacing: 1,
        color: 'rgba(255,255,255,0.78)',
        textAlign: 'center',
    },
    fullscreenEyebrowLarge: {
        fontSize: 10,
        letterSpacing: 2,
        marginTop: 8,
    },
    fullscreenTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: -0.2,
        lineHeight: 14,
        paddingHorizontal: 2,
    },
    fullscreenTitleLarge: {
        fontSize: 28,
        lineHeight: 32,
        marginTop: 4,
    },
    fullscreenTitleAngry: {
        textTransform: 'uppercase',
        fontSize: 11,
    },
    fullscreenTitleAngryLarge: {
        fontSize: 24,
    },
    fullscreenMessage: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.88)',
        textAlign: 'center',
        lineHeight: 12,
        paddingHorizontal: 4,
        marginTop: 2,
    },
    fullscreenMessageLarge: {
        fontSize: 16,
        lineHeight: 22,
        marginTop: 8,
        paddingHorizontal: 12,
    },
    fullscreenFrom: {
        fontSize: 7,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
    },
    fullscreenFromLarge: {
        fontSize: 12,
        marginTop: 10,
    },
    fullscreenBadge: {
        position: 'absolute',
        top: 5,
        right: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    fullscreenBadgeText: {
        fontSize: 7,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    chatFrame: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 6,
        paddingVertical: 4,
    },
    chatFrameLarge: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    chatFrameFill: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    chatTape: {
        position: 'absolute',
        top: 8,
        left: 16,
        width: 26,
        height: 7,
        backgroundColor: NOTE_COLORS.tapeColor,
        borderRadius: 1,
        zIndex: 2,
    },
    chatTapeLarge: {
        top: 18,
        left: 28,
        width: 44,
        height: 12,
    },
    chatNote: {
        backgroundColor: NOTE_COLORS.noteYellow,
        borderColor: NOTE_COLORS.noteYellowDark,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        paddingTop: 10,
        minHeight: 72,
        ...Platform.select({
            ios: {
                shadowColor: '#5C4033',
                shadowOffset: { width: 1, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: { elevation: 2 },
            default: {},
        }),
    },
    chatNoteLarge: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingTop: 20,
        minHeight: 140,
        borderRadius: 6,
    },
    chatSender: {
        fontFamily: mono,
        fontSize: 7,
        fontWeight: '800',
        color: NOTE_COLORS.inkFaded,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    chatSenderLarge: {
        fontSize: 10,
        marginBottom: 6,
    },
    chatBody: {
        fontFamily: mono,
        fontSize: 10,
        lineHeight: 14,
        color: NOTE_COLORS.inkDark,
        fontWeight: '600',
    },
    chatBodyLarge: {
        fontSize: 15,
        lineHeight: 22,
    },
    chatTag: {
        marginTop: 4,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
        backgroundColor: 'rgba(92, 64, 51, 0.08)',
    },
    chatTagKcal: {
        backgroundColor: 'rgba(180, 83, 9, 0.1)',
    },
    chatTagText: {
        fontFamily: mono,
        fontSize: 6,
        fontWeight: '800',
        letterSpacing: 0.6,
        color: NOTE_COLORS.inkFaded,
    },
    chatTagTextLarge: {
        fontSize: 8,
    },
    chatTagTextKcal: {
        color: '#B45309',
    },
    chatBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    chatBadgeText: {
        fontSize: 7,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.1,
    },
    notifFrame: {
        flex: 1,
        borderRadius: 10,
        overflow: 'hidden',
    },
    notifFrameFill: {
        borderRadius: 0,
    },
    notifGradient: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    notifGradientLarge: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        justifyContent: 'center',
        gap: 16,
    },
    notifGradientFill: {
        paddingHorizontal: 24,
        paddingVertical: 28,
    },
    notifImage: {
        width: '100%',
        height: 52,
        marginBottom: 4,
    },
    notifImageLarge: {
        height: 180,
        marginBottom: 0,
    },
    notifImageFill: {
        height: 220,
    },
    notifCopy: {
        width: '100%',
        alignItems: 'center',
        gap: 2,
    },
    notifEyebrowRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    notifEyebrow: {
        fontSize: 6,
        fontWeight: '900',
        letterSpacing: 0.8,
        color: '#0369A1',
        textAlign: 'center',
    },
    notifEyebrowLarge: {
        fontSize: 10,
        letterSpacing: 1.2,
    },
    notifTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0C4A6E',
        textAlign: 'center',
        letterSpacing: -0.2,
        lineHeight: 13,
        paddingHorizontal: 2,
    },
    notifTitleLarge: {
        fontSize: 24,
        lineHeight: 28,
        marginTop: 4,
    },
    notifMessageLarge: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '600',
        color: '#0F172A',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    notifBadge: {
        position: 'absolute',
        top: 5,
        right: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    notifBadgeText: {
        fontSize: 7,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
});
