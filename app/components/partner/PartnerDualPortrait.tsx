import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { normalizeGender } from '@/utils/genderMascot';

const FEMALE_PORTRAIT = require('../../assets/partner-portrait-female.png');
const MALE_PORTRAIT = require('../../assets/partner-portrait-male.png');

type PartnerDualPortraitProps = {
    leftGender?: string | null;
    rightGender?: string | null;
    leftName?: string;
    rightName?: string;
    compact?: boolean;
};

function formatGenderLabel(gender?: string | null) {
    const normalized = normalizeGender(gender);
    if (normalized === 'female') return 'Female';
    if (normalized === 'male') return 'Male';
    return 'Partner';
}

function getMiddleName(displayName?: string) {
    const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
        return parts.slice(1, -1).join(' ');
    }
    return parts[0] ?? 'Partner';
}

function getPortraitSource(gender?: string | null): ImageSourcePropType {
    return normalizeGender(gender) === 'female' ? FEMALE_PORTRAIT : MALE_PORTRAIT;
}

function PortraitSide({
    gender,
    name,
    align,
    compact,
}: {
    gender?: string | null;
    name?: string;
    align: 'left' | 'right';
    compact?: boolean;
}) {
    const portraitHeight = compact ? 132 : 168;

    return (
        <View style={[styles.side, align === 'left' ? styles.sideLeft : styles.sideRight]}>
            <View style={[styles.headerCopy, align === 'left' ? styles.headerCopyLeft : styles.headerCopyRight]}>
                <Text style={styles.genderLabel}>{formatGenderLabel(gender)}</Text>
                <Text style={styles.nameLabel} numberOfLines={1}>
                    {getMiddleName(name)}
                </Text>
            </View>
            <View style={[styles.portraitFrame, { height: portraitHeight }]}>
                <Image
                    source={getPortraitSource(gender)}
                    style={styles.portraitImage}
                    resizeMode="contain"
                />
            </View>
        </View>
    );
}

export function PartnerDualPortrait({
    leftGender,
    rightGender,
    leftName,
    rightName,
    compact = false,
}: PartnerDualPortraitProps) {
    const resolvedRightGender =
        rightGender ??
        (normalizeGender(leftGender) === 'female' ? 'male' : leftGender ? 'female' : 'male');

    return (
        <View style={[styles.row, compact && styles.rowCompact]}>
            <PortraitSide gender={leftGender} name={leftName} align="left" compact={compact} />
            <View style={styles.divider} />
            <PortraitSide gender={resolvedRightGender} name={rightName} align="right" compact={compact} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        width: '100%',
        gap: 10,
    },
    rowCompact: {
        gap: 8,
    },
    side: {
        flex: 1,
        minWidth: 0,
    },
    sideLeft: {
        alignItems: 'flex-start',
    },
    sideRight: {
        alignItems: 'flex-end',
    },
    headerCopy: {
        marginBottom: 10,
        gap: 2,
    },
    headerCopyLeft: {
        alignItems: 'flex-start',
    },
    headerCopyRight: {
        alignItems: 'flex-end',
    },
    genderLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    nameLabel: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    portraitFrame: {
        width: '100%',
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
        borderCurve: 'continuous',
    },
    portraitImage: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    divider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: '#E2E8F0',
        marginBottom: 12,
    },
});
