import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    useWindowDimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bookmark, Droplets, Flame, Footprints, Heart, ImagePlus, Pencil, Send, Trash2 } from 'lucide-react-native';
import { getDisplayContent } from '@/components/chat/partnerNoteShared';
import { ReminderPartnerCardPreview } from '@/components/partner/ReminderPartnerCardPreview';
import { ReminderPartnerPreviewModal } from '@/components/partner/ReminderPartnerPreviewModal';
import { PartnerReminderPartnerViewPreview } from '@/components/partner/PartnerReminderPartnerViewPreview';
import { buildPartnerCelebrationRequest } from '@/components/partner/buildPartnerCelebrationRequest';
import { CustomReminderEditorSheet } from '@/components/partner/CustomReminderEditorSheet';
import {
    PARTNER_REMINDER_CATEGORIES,
    mergePartnerReminderCategories,
    resolveReminderSendMessage,
    getReminderAssetsForCategory,
    photoReminderOption,
    REMINDER_ASSETS,
    REMINDER_ASSET_BY_ID,
    REMINDER_CAT_IMAGE,
    type PartnerReminderCategory,
    type PartnerReminderOption,
    type ReminderDelivery,
} from '@/components/partner/reminderAssets';
import type { UserCustomReminder } from '@/utils/customReminderStorage';
import { useCustomReminders } from '@/hooks/useCustomReminders';

type CustomRemindersApi = Pick<
    ReturnType<typeof useCustomReminders>,
    'reminders' | 'createReminder' | 'updateReminder' | 'deleteReminder'
>;
import {
    INTERVENE_ANIMATION_COST,
    formatPointsAlert,
} from '@/components/home/InterveneBottomSheet';

export type { PartnerReminderOption, ReminderDelivery } from '@/components/partner/reminderAssets';

export {
    PARTNER_REMINDER_CATEGORIES,
    mergePartnerReminderCategories,
    REMINDER_CAT_IMAGE,
    REMINDER_ASSETS,
    REMINDER_ASSET_BY_ID,
    getReminderAssetsForCategory,
    photoReminderOption,
} from '@/components/partner/reminderAssets';

const COLORS = {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    subtle: '#94A3B8',
    accent: '#FF6B6B',
    fill: '#F4F4F5',
};

const HORIZONTAL_PAD = 20;
const CARD_GAP = 10;

type PreviewState = {
    key: string;
    option: PartnerReminderOption;
    messagePreview: string;
};

export type ReminderPartnerOptionsProps = {
    partnerName: string;
    categories?: PartnerReminderCategory[];
    customReminders?: CustomRemindersApi;
    pointsBalance?: number;
    pointsLoading?: boolean;
    chatConnected?: boolean;
    devPartnerPreviewEnabled?: boolean;
    onSendReminder: (message: string, label: string) => void;
    onSendPremiumReminder?: (
        option: PartnerReminderOption,
        message: string,
    ) => Promise<boolean>;
    onAfterSend?: (label: string) => void;
    onCreateCustomReminder?: () => void;
    onEditCustomReminder?: (option: PartnerReminderOption) => void;
    onDeleteCustomReminder?: (option: PartnerReminderOption) => void;
};

type ReminderPartnerProps = ReminderPartnerOptionsProps & {
    onBack: () => void;
};

function CategoryIcon({ type }: { type: 'steps' | 'calories' | 'hydration' | 'custom' }) {
    if (type === 'calories') return <Flame size={15} color="#EA580C" strokeWidth={2.2} />;
    if (type === 'hydration') return <Droplets size={15} color="#2563EB" strokeWidth={2.2} />;
    if (type === 'custom') return <Bookmark size={15} color="#FF6B6B" strokeWidth={2.2} />;
    return <Footprints size={15} color="#0D9488" strokeWidth={2.2} />;
}

function PointsBadge({
    cost,
    loading,
    affordable,
}: {
    cost: number;
    loading?: boolean;
    affordable: boolean;
}) {
    return (
        <View style={[styles.pointsBadge, !affordable && styles.pointsBadgeLocked]}>
            <Heart
                size={11}
                color={affordable ? COLORS.accent : COLORS.subtle}
                fill={affordable ? COLORS.accent : COLORS.subtle}
            />
            <Text style={[styles.pointsBadgeText, !affordable && styles.pointsBadgeTextLocked]}>
                {loading ? '—' : `${cost} pts`}
            </Text>
        </View>
    );
}


function CreateReminderCard({
    cardWidth,
    onPress,
}: {
    cardWidth: number;
    onPress: () => void;
}) {
    return (
        <View style={[styles.cardWrap, { width: cardWidth }]}>
            <TouchableOpacity style={styles.createCard} activeOpacity={0.88} onPress={onPress}>
                <View style={styles.createIconWrap}>
                    <ImagePlus size={20} color="#FF6B6B" strokeWidth={2.4} />
                </View>
                <Text style={styles.createTitle}>New reminder</Text>
                <Text style={styles.createSubtitle}>Pick a photo and write your message.</Text>
            </TouchableOpacity>
        </View>
    );
}

function ReminderCarouselCard({
    option,
    partnerName,
    cardWidth,
    busy,
    sent,
    disabled,
    pointsLoading,
    devPartnerPreviewEnabled = false,
    onSend,
    onPreview,
    onDevPartnerPreview,
    onEditCustomReminder,
    onDeleteCustomReminder,
}: {
    option: PartnerReminderOption;
    partnerName: string;
    cardWidth: number;
    busy: boolean;
    sent: boolean;
    disabled: boolean;
    pointsLoading?: boolean;
    devPartnerPreviewEnabled?: boolean;
    onSend: () => void;
    onPreview: () => void;
    onDevPartnerPreview?: (option: PartnerReminderOption) => void;
    onEditCustomReminder?: () => void;
    onDeleteCustomReminder?: () => void;
}) {
    const messagePreview = useMemo(() => {
        const raw = option.buildMessage(partnerName);
        if (option.isUserCustom) {
            return raw.trim();
        }
        return getDisplayContent(raw);
    }, [option, partnerName]);

    return (
        <View style={[styles.cardWrap, { width: cardWidth }]}>
            <View style={styles.carouselCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{option.label}</Text>
                    <PointsBadge cost={option.pointsCost} loading={pointsLoading} affordable={!disabled} />
                </View>

                <TouchableOpacity
                    style={styles.previewShell}
                    activeOpacity={0.88}
                    onPress={onPreview}
                    onLongPress={option.isUserCustom ? onEditCustomReminder : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${option.label}`}
                >
                    <ReminderPartnerCardPreview option={option} messagePreview={messagePreview} />
                </TouchableOpacity>

                {__DEV__ &&
                devPartnerPreviewEnabled &&
                option.delivery === 'fullscreen' &&
                option.mode &&
                onDevPartnerPreview ? (
                    <TouchableOpacity
                        style={styles.devPartnerButton}
                        activeOpacity={0.85}
                        onPress={() => onDevPartnerPreview(option)}
                    >
                        <Text style={styles.devPartnerButtonText}>Partner view</Text>
                    </TouchableOpacity>
                ) : null}

                {option.isUserCustom ? (
                    <View style={styles.customActionsRow}>
                        <TouchableOpacity
                            style={styles.customActionBtn}
                            activeOpacity={0.85}
                            onPress={onEditCustomReminder}
                        >
                            <Pencil size={12} color={COLORS.text} strokeWidth={2.3} />
                            <Text style={styles.customActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.customActionBtn, styles.customDeleteBtn]}
                            activeOpacity={0.85}
                            onPress={onDeleteCustomReminder}
                        >
                            <Trash2 size={12} color="#DC2626" strokeWidth={2.3} />
                            <Text style={styles.customDeleteText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (disabled || busy) && styles.sendButtonDisabled,
                        sent && styles.sendButtonSent,
                    ]}
                    activeOpacity={0.85}
                    disabled={disabled || busy}
                    onPress={onSend}
                >
                    {busy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Send size={12} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.sendButtonText}>{sent ? 'Sent' : 'Send'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

function CategoryCarousel({
    categoryId,
    options,
    partnerName,
    cardWidth,
    snapInterval,
    busyId,
    sentId,
    pointsLoading,
    canAfford,
    devPartnerPreviewEnabled = false,
    onSend,
    onPreview,
    onDevPartnerPreview,
    onCreateCustomReminder,
    onEditCustomReminder,
    onDeleteCustomReminder,
}: {
    categoryId: string;
    options: PartnerReminderOption[];
    partnerName: string;
    cardWidth: number;
    snapInterval: number;
    busyId: string | null;
    sentId: string | null;
    pointsLoading?: boolean;
    canAfford: (cost: number) => boolean;
    devPartnerPreviewEnabled?: boolean;
    onSend: (option: PartnerReminderOption) => void;
    onPreview: (option: PartnerReminderOption) => void;
    onDevPartnerPreview?: (option: PartnerReminderOption) => void;
    onCreateCustomReminder?: () => void;
    onEditCustomReminder?: (option: PartnerReminderOption) => void;
    onDeleteCustomReminder?: (option: PartnerReminderOption) => void;
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const showCreateCard = categoryId === 'custom' && !!onCreateCustomReminder;
    const slideCount = options.length + (showCreateCard ? 1 : 0);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / snapInterval);
        setActiveIndex(Math.max(0, Math.min(index, slideCount - 1)));
    };

    return (
        <View style={styles.carouselSection}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={snapInterval}
                snapToAlignment="start"
                disableIntervalMomentum
                removeClippedSubviews={false}
                style={styles.carouselScroll}
                contentContainerStyle={styles.carouselContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {showCreateCard ? (
                    <CreateReminderCard
                        cardWidth={cardWidth}
                        onPress={onCreateCustomReminder}
                    />
                ) : null}
                {options.map((option) => {
                    const disabled = option.pointsCost > 0 && !canAfford(option.pointsCost);
                    return (
                        <ReminderCarouselCard
                            key={`${categoryId}-${option.id}`}
                            option={option}
                            partnerName={partnerName}
                            cardWidth={cardWidth}
                            busy={busyId === option.id}
                            sent={sentId === option.id}
                            disabled={disabled}
                            pointsLoading={pointsLoading}
                            devPartnerPreviewEnabled={devPartnerPreviewEnabled}
                            onSend={() => onSend(option)}
                            onPreview={() => onPreview(option)}
                            onDevPartnerPreview={onDevPartnerPreview}
                            onEditCustomReminder={
                                option.isUserCustom && onEditCustomReminder
                                    ? () => onEditCustomReminder(option)
                                    : undefined
                            }
                            onDeleteCustomReminder={
                                option.isUserCustom && onDeleteCustomReminder
                                    ? () => onDeleteCustomReminder(option)
                                    : undefined
                            }
                        />
                    );
                })}
            </ScrollView>

            {slideCount > 1 ? (
                <View style={styles.dotsRow}>
                    {Array.from({ length: slideCount }).map((_, index) => (
                        <View
                            key={`${categoryId}-dot-${index}`}
                            style={[styles.dot, index === activeIndex && styles.dotActive]}
                        />
                    ))}
                </View>
            ) : null}
        </View>
    );
}

export function ReminderPartnerOptions({
    partnerName,
    categories,
    customReminders,
    pointsBalance = 0,
    pointsLoading = false,
    chatConnected = true,
    devPartnerPreviewEnabled = false,
    onSendReminder,
    onSendPremiumReminder,
    onAfterSend,
    onCreateCustomReminder,
    onEditCustomReminder,
    onDeleteCustomReminder,
}: ReminderPartnerOptionsProps) {
    const { width: windowWidth } = useWindowDimensions();
    const resolvedCategories = useMemo(
        () => categories ?? mergePartnerReminderCategories(customReminders?.reminders ?? []),
        [categories, customReminders?.reminders],
    );
    const [busyId, setBusyId] = useState<string | null>(null);
    const [sentId, setSentId] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewState | null>(null);
    const [partnerViewPreview, setPartnerViewPreview] =
        useState<ReturnType<typeof buildPartnerCelebrationRequest>>(null);

    const cardWidth = useMemo(() => Math.round(windowWidth * 0.54), [windowWidth]);
    const snapInterval = cardWidth + CARD_GAP;

    const canAfford = useCallback(
        (cost: number) => pointsBalance >= cost,
        [pointsBalance],
    );

    const flashSent = useCallback((id: string) => {
        setSentId(id);
        setTimeout(() => {
            setSentId((current) => (current === id ? null : current));
        }, 2000);
    }, []);

    const handlePreview = useCallback(
        (option: PartnerReminderOption) => {
            setPreview({
                key: `${option.id}-${Date.now()}`,
                option,
                messagePreview: option.isUserCustom
                    ? option.buildMessage(partnerName)
                    : getDisplayContent(option.buildMessage(partnerName)),
            });
        },
        [partnerName],
    );

    const sendOption = useCallback(
        async (option: PartnerReminderOption): Promise<boolean> => {
            try {
                setBusyId(option.id);
                const message = await resolveReminderSendMessage(option, partnerName);

                if (option.pointsCost > 0) {
                    if (!canAfford(option.pointsCost)) {
                        Alert.alert('Not enough points', formatPointsAlert(option.pointsCost));
                        return false;
                    }
                    if (!onSendPremiumReminder) return false;

                    const ok = await onSendPremiumReminder(option, message);
                    if (ok) {
                        flashSent(option.id);
                        onAfterSend?.(option.label);
                    }
                    return ok;
                }

                onSendReminder(message, option.label);
                flashSent(option.id);
                onAfterSend?.(option.label);
                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Try again.';
                Alert.alert('Could not send', message);
                return false;
            } finally {
                setBusyId(null);
            }
        },
        [
            canAfford,
            flashSent,
            onAfterSend,
            onSendPremiumReminder,
            onSendReminder,
            partnerName,
        ],
    );

    const handleSendFromPreview = useCallback(async () => {
        if (!preview) return;
        if (!chatConnected) {
            Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
            return;
        }

        const ok = await sendOption(preview.option);
        if (ok) {
            setPreview(null);
        }
    }, [chatConnected, preview, sendOption]);

    const handleSend = useCallback(
        (option: PartnerReminderOption) => {
            if (!chatConnected) {
                Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
                return;
            }

            const isFullscreen = option.delivery === 'fullscreen' && !!option.mode;

            Alert.alert(
                `Send to ${partnerName}?`,
                isFullscreen
                    ? 'Your partner will see this fullscreen on their home screen.'
                    : 'This sends as a chat note.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Send', onPress: () => void sendOption(option) },
                ],
            );
        },
        [chatConnected, partnerName, sendOption],
    );

    const handleDevPartnerPreview = useCallback(
        (option: PartnerReminderOption) => {
            const request = buildPartnerCelebrationRequest(
                option,
                partnerName,
                `dev-${option.id}-${Date.now()}`,
            );
            if (request) {
                setPartnerViewPreview(request);
            }
        },
        [partnerName],
    );

    const previewCanSend = useMemo(() => {
        if (!preview || !chatConnected) return false;
        return !(preview.option.pointsCost > 0 && !canAfford(preview.option.pointsCost));
    }, [canAfford, chatConnected, preview]);

    const previewBusy = preview ? busyId === preview.option.id : false;

    return (
        <>
            {resolvedCategories.map((category) => (
                <View key={category.id} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIcon}>
                            <CategoryIcon type={category.icon} />
                        </View>
                        <Text style={styles.sectionTitle}>{category.title}</Text>
                    </View>

                    <CategoryCarousel
                        categoryId={category.id}
                        options={category.options}
                        partnerName={partnerName}
                        cardWidth={cardWidth}
                        snapInterval={snapInterval}
                        busyId={busyId}
                        sentId={sentId}
                        pointsLoading={pointsLoading}
                        canAfford={canAfford}
                        devPartnerPreviewEnabled={devPartnerPreviewEnabled}
                        onSend={handleSend}
                        onPreview={handlePreview}
                        onDevPartnerPreview={handleDevPartnerPreview}
                        onCreateCustomReminder={
                            category.id === 'custom' ? onCreateCustomReminder : undefined
                        }
                        onEditCustomReminder={
                            category.id === 'custom' ? onEditCustomReminder : undefined
                        }
                        onDeleteCustomReminder={
                            category.id === 'custom' ? onDeleteCustomReminder : undefined
                        }
                    />
                </View>
            ))}

            <ReminderPartnerPreviewModal
                visible={!!preview}
                option={preview?.option ?? null}
                messagePreview={preview?.messagePreview ?? ''}
                partnerName={partnerName}
                busy={previewBusy}
                canSend={previewCanSend}
                onClose={() => setPreview(null)}
                onSend={() => void handleSendFromPreview()}
            />

            <PartnerReminderPartnerViewPreview
                request={partnerViewPreview}
                onFinish={() => setPartnerViewPreview(null)}
            />
        </>
    );
}

export function DevPartnerPreviewToggle({
    enabled,
    onToggle,
    style,
}: {
    enabled: boolean;
    onToggle: () => void;
    style?: object;
}) {
    if (!__DEV__) {
        return null;
    }

    return (
        <TouchableOpacity
            onPress={onToggle}
            style={[styles.devToggle, enabled && styles.devToggleActive, style]}
            activeOpacity={0.85}
        >
            <Text style={[styles.devToggleText, enabled && styles.devToggleTextActive]}>
                {enabled ? 'Dev preview on' : 'Dev preview'}
            </Text>
        </TouchableOpacity>
    );
}

export function ReminderPartner({
    partnerName,
    categories,
    customReminders,
    pointsBalance = 0,
    pointsLoading = false,
    chatConnected = true,
    onBack,
    onSendReminder,
    onSendPremiumReminder,
}: ReminderPartnerProps) {
    const insets = useSafeAreaInsets();
    const [devPartnerPreviewEnabled, setDevPartnerPreviewEnabled] = useState(false);
    const [editorVisible, setEditorVisible] = useState(false);
    const [editingReminder, setEditingReminder] = useState<UserCustomReminder | null>(null);
    const [savingCustom, setSavingCustom] = useState(false);

    const resolvedCategories = useMemo(
        () => categories ?? mergePartnerReminderCategories(customReminders?.reminders ?? []),
        [categories, customReminders?.reminders],
    );

    const headerPoints = useMemo(() => {
        if (pointsLoading) return '—';
        return pointsBalance.toLocaleString();
    }, [pointsBalance, pointsLoading]);

    const openCreateEditor = useCallback(() => {
        setEditingReminder(null);
        setEditorVisible(true);
    }, []);

    const openEditEditor = useCallback(
        (option: PartnerReminderOption) => {
            const reminder = customReminders?.reminders.find((item) => item.id === option.id);
            if (!reminder) {
                return;
            }
            setEditingReminder(reminder);
            setEditorVisible(true);
        },
        [customReminders?.reminders],
    );

    const closeEditor = useCallback(() => {
        setEditorVisible(false);
        setEditingReminder(null);
    }, []);

    const handleDeleteCustomReminder = useCallback(
        (option: PartnerReminderOption) => {
            if (!customReminders) {
                return;
            }

            Alert.alert('Delete reminder?', `"${option.label}" will be removed from your list.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            const result = await customReminders.deleteReminder(option.id);
                            if (!result.success) {
                                Alert.alert('Could not delete', result.error ?? 'Try again.');
                            }
                        })();
                    },
                },
            ]);
        },
        [customReminders],
    );

    return (
        <View style={styles.root}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top + 4, 16) }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                    <ArrowLeft size={20} color={COLORS.text} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reminders</Text>
                <View style={styles.headerPoints}>
                    <Heart size={12} color={COLORS.accent} fill={COLORS.accent} />
                    <Text style={styles.headerPointsText}>{headerPoints}</Text>
                </View>
            </View>

            <Text style={styles.headerSubtitle}>Send a nudge to {partnerName}</Text>

            <DevPartnerPreviewToggle
                enabled={devPartnerPreviewEnabled}
                onToggle={() => setDevPartnerPreviewEnabled((current) => !current)}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom + 28, 36) },
                ]}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
            >
                <ReminderPartnerOptions
                    partnerName={partnerName}
                    categories={resolvedCategories}
                    customReminders={customReminders}
                    pointsBalance={pointsBalance}
                    pointsLoading={pointsLoading}
                    chatConnected={chatConnected}
                    devPartnerPreviewEnabled={devPartnerPreviewEnabled}
                    onSendReminder={onSendReminder}
                    onSendPremiumReminder={onSendPremiumReminder}
                    onCreateCustomReminder={customReminders ? openCreateEditor : undefined}
                    onEditCustomReminder={customReminders ? openEditEditor : undefined}
                    onDeleteCustomReminder={customReminders ? handleDeleteCustomReminder : undefined}
                />
            </ScrollView>

            {customReminders ? (
                <CustomReminderEditorSheet
                    visible={editorVisible}
                    initialReminder={editingReminder}
                    saving={savingCustom}
                    onClose={closeEditor}
                    onSave={async (draft) => {
                        setSavingCustom(true);
                        try {
                            if (editingReminder) {
                                return customReminders.updateReminder(editingReminder.id, draft);
                            }
                            return customReminders.createReminder(draft);
                        } finally {
                            setSavingCustom(false);
                        }
                    }}
                    onDelete={
                        editingReminder
                            ? async () => customReminders.deleteReminder(editingReminder.id)
                            : undefined
                    }
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: HORIZONTAL_PAD,
        gap: 8,
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.4,
    },
    headerPoints: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: COLORS.fill,
    },
    headerPointsText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
        fontVariant: ['tabular-nums'],
    },
    headerSubtitle: {
        paddingHorizontal: HORIZONTAL_PAD,
        marginTop: 2,
        marginBottom: 8,
        fontSize: 14,
        color: COLORS.muted,
    },
    devToggle: {
        alignSelf: 'flex-start',
        marginHorizontal: HORIZONTAL_PAD,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: COLORS.fill,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    devToggleActive: {
        backgroundColor: '#ECFEFF',
        borderColor: '#67E8F9',
    },
    devToggleText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.muted,
    },
    devToggleTextActive: {
        color: '#0E7490',
    },
    scrollContent: {
        gap: 20,
        overflow: 'visible',
    },
    section: {
        gap: 8,
        overflow: 'visible',
    },
    carouselSection: {
        overflow: 'visible',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: HORIZONTAL_PAD,
    },
    sectionIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: COLORS.fill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.2,
    },
    carouselContent: {
        paddingHorizontal: HORIZONTAL_PAD,
        paddingVertical: 12,
        gap: CARD_GAP,
    },
    carouselScroll: {
        overflow: 'visible',
    },
    cardWrap: {
        paddingVertical: 6,
    },
    createCard: {
        flex: 1,
        minHeight: 260,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        gap: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    createIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFF1F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    createTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
        textAlign: 'center',
    },
    createSubtitle: {
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '600',
        color: COLORS.muted,
        textAlign: 'center',
    },
    customActionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    customActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: COLORS.fill,
    },
    customActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.text,
    },
    customDeleteBtn: {
        backgroundColor: '#FEF2F2',
    },
    customDeleteText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DC2626',
    },
    carouselCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 10,
        gap: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.2,
    },
    pointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: COLORS.fill,
    },
    pointsBadgeLocked: {
        backgroundColor: COLORS.fill,
        opacity: 0.6,
    },
    pointsBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.accent,
        fontVariant: ['tabular-nums'],
    },
    pointsBadgeTextLocked: {
        color: COLORS.subtle,
    },
    previewShell: {
        height: 100,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: COLORS.fill,
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingVertical: 9,
    },
    sendButtonDisabled: {
        opacity: 0.45,
    },
    sendButtonSent: {
        backgroundColor: '#059669',
    },
    sendButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    devPartnerButton: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        paddingVertical: 8,
        backgroundColor: '#ECFEFF',
        borderWidth: 1,
        borderColor: '#A5F3FC',
    },
    devPartnerButtonText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0E7490',
        letterSpacing: 0.2,
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        marginTop: 8,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(15, 23, 42, 0.12)',
    },
    dotActive: {
        width: 14,
        backgroundColor: COLORS.accent,
    },
});
