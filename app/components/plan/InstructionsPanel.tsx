import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const COLORS = {
    bg: '#F7F8FA',
    card: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    line: '#EEF0F3',
};

type Props = {
    title?: string;
    instructions?: string[];
    singleInstruction?: string;
    accentColor: string;
    borderColor?: string;
    defaultOpen?: boolean;
    embedded?: boolean;
};

export function InstructionsPanel({
    title = 'How to perform',
    instructions,
    singleInstruction,
    accentColor,
    borderColor = COLORS.line,
    defaultOpen = false,
    embedded = false,
}: Props) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const stepCount = instructions?.length ?? (singleInstruction ? 1 : 0);

    const toggle = () => {
        Haptics.selectionAsync();
        setIsOpen((value) => !value);
    };

    const content = (
        <>
            <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
                <View style={styles.headerText}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>
                        {isOpen ? 'Tap to hide' : `${stepCount} step${stepCount === 1 ? '' : 's'}`}
                    </Text>
                </View>
                <ChevronDown
                    size={20}
                    color={COLORS.textSub}
                    strokeWidth={2.5}
                    style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                />
            </TouchableOpacity>

            {isOpen && (
                <View style={[styles.instructionBox, { borderColor }]}>
                    {instructions ? (
                        instructions.map((step, idx) => (
                            <View
                                key={idx}
                                style={[styles.instructionRow, idx > 0 && styles.instructionRowSpaced]}
                            >
                                <Text style={[styles.instructionNumber, { color: accentColor }]}>
                                    {idx + 1}.
                                </Text>
                                <Text style={styles.instructionText}>{step}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.instructionText}>{singleInstruction}</Text>
                    )}
                </View>
            )}
        </>
    );

    if (embedded) {
        return <View style={styles.embedded}>{content}</View>;
    }

    return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 20,
        backgroundColor: COLORS.card,
        borderRadius: 24,
        borderCurve: 'continuous',
        padding: 22,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    embedded: {
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    headerText: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 13,
        color: COLORS.textSub,
        fontWeight: '500',
    },
    instructionBox: {
        marginTop: 14,
        padding: 16,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: COLORS.bg,
        borderWidth: 1,
    },
    instructionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    instructionRowSpaced: {
        marginTop: 10,
    },
    instructionNumber: {
        width: 20,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    instructionText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.textMain,
        fontWeight: '600',
    },
});
