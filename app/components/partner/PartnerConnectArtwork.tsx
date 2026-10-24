import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Heart } from 'lucide-react-native';
import { normalizeGender } from '@/utils/genderMascot';

const FEMALE_SOURCE = require('../../assets/imagechat-female.png');
const MALE_SOURCE = require('../../assets/imagechat-male.png');
const AVATAR_ASPECT_RATIO = 941 / 836;
const AVATAR_HEIGHT_SCALE = 0.72;

const COLORS = {
    you: '#FF6B6B',
    youSoft: '#FFF1F2',
    youGlow: 'rgba(255, 107, 107, 0.20)',
    partner: '#2EC4B6',
    partnerSoft: '#E8F6F4',
    partnerGlow: 'rgba(46, 196, 182, 0.20)',
    text: '#0F172A',
    partnerLabel: '#E24C5B',
    partnerRule: 'rgba(226, 76, 91, 0.28)',
    pointsHeart: '#EF4444',
};

type PartnerConnectArtworkProps = {
    width: number;
    leftName?: string;
    rightName?: string;
    leftGender?: string | null;
    rightGender?: string | null;
    leftPoints?: number | null;
    rightPoints?: number | null;
};

type AvatarAccent = {
    accent: string;
    accentSoft: string;
    accentGlow: string;
};

function getAvatarSource(gender: 'female' | 'male') {
    return gender === 'female' ? FEMALE_SOURCE : MALE_SOURCE;
}

function PartnerHeartConnector({
    width,
    top,
}: {
    width: number;
    top: number;
}) {
    const connectorHeight = 44;
    const heartSize = Math.min(width * 0.052, 20);
    const badgeSize = heartSize + 14;
    const centerX = width / 2;
    const centerY = connectorHeight * 0.54;
    const lineReach = Math.min(width * 0.055, 22);
    const leftStart = centerX - badgeSize / 2 - lineReach;
    const leftEnd = centerX - badgeSize / 2 + 1;
    const rightStart = centerX + badgeSize / 2 + lineReach;
    const rightEnd = centerX + badgeSize / 2 - 1;
    const leftMidX = (leftStart + leftEnd) / 2;
    const rightMidX = (rightStart + rightEnd) / 2;

    return (
        <>
            <View
                style={[
                    styles.connectorLayer,
                    { top, height: connectorHeight },
                ]}
                pointerEvents="none"
            >
                <Svg width={width} height={connectorHeight}>
                    <Path
                        d={`M ${leftStart} ${centerY} Q ${leftMidX} ${centerY - 7} ${leftEnd} ${centerY}`}
                        stroke={COLORS.you}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                    />
                    <Path
                        d={`M ${rightStart} ${centerY} Q ${rightMidX} ${centerY - 7} ${rightEnd} ${centerY}`}
                        stroke={COLORS.partner}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                    />
                </Svg>
            </View>

            <View
                style={[
                    styles.heartLayer,
                    {
                        top: top + (connectorHeight - badgeSize) / 2,
                        width: badgeSize,
                        height: badgeSize,
                        borderRadius: badgeSize / 2,
                        marginLeft: -badgeSize / 2,
                    },
                ]}
                pointerEvents="none"
            >
                <Heart
                    size={heartSize}
                    color={COLORS.you}
                    fill={COLORS.you}
                    strokeWidth={0}
                />
            </View>
        </>
    );
}

export function PartnerConnectArtwork({
    width,
    leftName,
    rightName,
    leftGender,
    rightGender,
    leftPoints,
    rightPoints,
}: PartnerConnectArtworkProps) {
    const halfWidth = width / 2;
    const imageHeight = halfWidth * AVATAR_ASPECT_RATIO * AVATAR_HEIGHT_SCALE;
    const hasNames = Boolean(leftName || rightName);
    const resolvedLeftGender = normalizeGender(leftGender) === 'male' ? 'male' : 'female';
    const normalizedRightGender = normalizeGender(rightGender);
    const resolvedRightGender = normalizedRightGender === 'female' || normalizedRightGender === 'male'
        ? normalizedRightGender
        : resolvedLeftGender === 'female' ? 'male' : 'female';

    const leftAccent: AvatarAccent = {
        accent: COLORS.you,
        accentSoft: COLORS.youSoft,
        accentGlow: COLORS.youGlow,
    };
    const rightAccent: AvatarAccent = {
        accent: COLORS.partner,
        accentSoft: COLORS.partnerSoft,
        accentGlow: COLORS.partnerGlow,
    };

    return (
        <View
            style={[styles.artwork, { width }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${leftName || 'User'} and ${rightName || 'partner'} standing together`}
        >
            <View style={[styles.avatarRow, { height: imageHeight }]}>
                <PartnerHeartConnector width={width} top={imageHeight * 0.34} />

                <AvatarSide
                    source={getAvatarSource(resolvedLeftGender)}
                    width={halfWidth}
                    imageHeight={imageHeight}
                    mirrored={false}
                    {...leftAccent}
                />
                <AvatarSide
                    source={getAvatarSource(resolvedRightGender)}
                    width={halfWidth}
                    imageHeight={imageHeight}
                    mirrored
                    {...rightAccent}
                />
            </View>

            <View style={styles.partnerLabelRow}>
                <View style={styles.partnerRule} />
                <Text style={styles.partnerLabel}>PARTNER SPACE</Text>
                <View style={styles.partnerRule} />
            </View>

            {hasNames ? (
                <View style={styles.footerRow}>
                    <PersonColumn
                        name={leftName}
                        accent={COLORS.you}
                        accentSoft={COLORS.youSoft}
                        points={leftPoints}
                    />
                    <PersonColumn
                        name={rightName}
                        accent={COLORS.partner}
                        accentSoft={COLORS.partnerSoft}
                        points={rightPoints}
                    />
                </View>
            ) : null}
        </View>
    );
}

function normalizePoints(value?: number | null): number | null {
    if (value == null) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function PersonColumn({
    name,
    accent,
    accentSoft,
    points,
}: {
    name?: string;
    accent: string;
    accentSoft: string;
    points?: number | null;
}) {
    if (!name) {
        return <View style={styles.columnSlot} />;
    }

    const resolvedPoints = normalizePoints(points);

    return (
        <View style={styles.columnSlot}>
            <View style={[styles.namePill, { backgroundColor: accentSoft }]}>
                <View style={[styles.nameDot, { backgroundColor: accent }]} />
                <Text style={styles.nameText} numberOfLines={1}>
                    {name}
                </Text>
            </View>

            {resolvedPoints !== null ? (
                <View style={[styles.pointsBlock, { backgroundColor: accentSoft }]}>
                    <Heart size={9} color={COLORS.pointsHeart} fill={COLORS.pointsHeart} strokeWidth={0} />
                    <Text style={styles.pointsValue}>
                        {resolvedPoints.toLocaleString()}
                    </Text>
                    <Text style={styles.pointsLabel}>pts</Text>
                </View>
            ) : null}
        </View>
    );
}

function AvatarSide({
    source,
    width,
    imageHeight,
    mirrored,
    accentGlow,
}: {
    source: number;
    width: number;
    imageHeight: number;
    mirrored: boolean;
    accent: string;
    accentSoft: string;
    accentGlow: string;
}) {
    const glowSize = width * 0.52;

    return (
        <View style={[styles.avatarSlot, { width, height: imageHeight }]}>
            <View
                style={[
                    styles.avatarGlow,
                    {
                        width: glowSize,
                        height: glowSize,
                        borderRadius: glowSize / 2,
                        backgroundColor: accentGlow,
                        bottom: imageHeight * 0.06,
                    },
                ]}
                pointerEvents="none"
            />
            <View style={[styles.imageWrap, mirrored && styles.imageWrapMirrored]}>
                <Image
                    source={source}
                    style={[styles.image, { height: imageHeight }]}
                    resizeMode="contain"
                    accessible={false}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    artwork: {
        alignSelf: 'center',
        gap: 6,
    },
    avatarRow: {
        flexDirection: 'row',
        position: 'relative',
        overflow: 'visible',
    },
    partnerLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 6,
    },
    partnerRule: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.partnerRule,
    },
    partnerLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.partnerLabel,
        letterSpacing: 2.2,
        textAlign: 'center',
    },
    connectorLayer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 0,
    },
    heartLayer: {
        position: 'absolute',
        left: '50%',
        zIndex: 3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(226, 76, 91, 0.18)',
        borderCurve: 'continuous',
        boxShadow: '0 4px 12px rgba(226, 76, 91, 0.14)',
    },
    avatarSlot: {
        zIndex: 2,
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'visible',
    },
    avatarGlow: {
        position: 'absolute',
        alignSelf: 'center',
    },
    imageWrap: {
        width: '100%',
        zIndex: 1,
    },
    imageWrapMirrored: {
        transform: [{ scaleX: -1 }],
    },
    image: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    footerRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 4,
    },
    columnSlot: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    namePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        maxWidth: '100%',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderCurve: 'continuous',
    },
    pointsBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderCurve: 'continuous',
    },
    pointsValue: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        fontVariant: ['tabular-nums'],
        letterSpacing: -0.1,
    },
    pointsLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: '#94A3B8',
    },
    nameDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    nameText: {
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
});
