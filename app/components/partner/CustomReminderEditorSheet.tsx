import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { X, Trash2, ImagePlus } from 'lucide-react-native';
import type { ReminderPhotoAnimation } from '@/components/partner/reminderPhotoAnimations';
import type { UserCustomReminder } from '@/utils/customReminderStorage';
import { customReminderTextHasDash } from '@/utils/customReminderMessage';

const COLORS = {
    text: '#0F172A',
    muted: '#64748B',
    fill: '#F4F4F5',
    accent: '#FF6B6B',
    border: '#E2E8F0',
    danger: '#DC2626',
};

const ANIMATION_OPTIONS: { id: ReminderPhotoAnimation; label: string }[] = [
    { id: 'beg', label: 'Beg' },
    { id: 'bounce', label: 'Bounce' },
    { id: 'wiggle', label: 'Wiggle' },
    { id: 'pulse', label: 'Pulse' },
    { id: 'float', label: 'Float' },
    { id: 'sideToSide', label: 'Slide' },
    { id: 'pop', label: 'Pop' },
    { id: 'tilt', label: 'Tilt' },
];

type CustomReminderEditorSheetProps = {
    visible: boolean;
    initialReminder?: UserCustomReminder | null;
    saving?: boolean;
    onClose: () => void;
    onSave: (draft: {
        label: string;
        previewTitle: string;
        message: string;
        localImageUri: string;
        photoAnimation: ReminderPhotoAnimation;
    }) => Promise<{ success: boolean; error?: string }>;
    onDelete?: () => Promise<{ success: boolean; error?: string }>;
};

export function CustomReminderEditorSheet({
    visible,
    initialReminder = null,
    saving = false,
    onClose,
    onSave,
    onDelete,
}: CustomReminderEditorSheetProps) {
    const [label, setLabel] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [message, setMessage] = useState('');
    const [localImageUri, setLocalImageUri] = useState('');
    const [photoAnimation, setPhotoAnimation] = useState<ReminderPhotoAnimation>('beg');

    useEffect(() => {
        if (!visible) {
            return;
        }

        setLabel(initialReminder?.label ?? '');
        setPreviewTitle(initialReminder?.previewTitle ?? '');
        setMessage(initialReminder?.message ?? '');
        setLocalImageUri(initialReminder?.localImageUri ?? '');
        setPhotoAnimation(initialReminder?.photoAnimation ?? 'beg');
    }, [initialReminder, visible]);

    const isEditing = !!initialReminder;

    const canSave = useMemo(
        () =>
            !!label.trim()
            && !!previewTitle.trim()
            && !!message.trim()
            && !!localImageUri,
        [label, localImageUri, message, previewTitle],
    );

    const validateCopy = () => {
        if (customReminderTextHasDash(label)) {
            return 'Label cannot contain dashes.';
        }
        if (customReminderTextHasDash(previewTitle)) {
            return 'Title cannot contain dashes.';
        }
        if (customReminderTextHasDash(message)) {
            return 'Message cannot contain dashes.';
        }
        return null;
    };

    const pickImage = async () => {
        let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        }

        if (!permission.granted) {
            Alert.alert('Photos needed', 'Allow photo access to choose a reminder image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });

        if (!result.canceled && result.assets[0]?.uri) {
            setLocalImageUri(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        const validationError = validateCopy();
        if (validationError) {
            Alert.alert('Check your text', validationError);
            return;
        }

        if (!canSave) {
            Alert.alert('Missing details', 'Add a label, title, message, and photo.');
            return;
        }

        const result = await onSave({
            label,
            previewTitle,
            message,
            localImageUri,
            photoAnimation,
        });

        if (!result.success) {
            Alert.alert('Could not save', result.error ?? 'Try again.');
            return;
        }

        onClose();
    };

    const handleDelete = () => {
        if (!onDelete) {
            return;
        }

        Alert.alert('Delete reminder?', 'This removes it from your saved reminders.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        const result = await onDelete();
                        if (!result.success) {
                            Alert.alert('Could not delete', result.error ?? 'Try again.');
                            return;
                        }
                        onClose();
                    })();
                },
            },
        ]);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.root}>
                <View style={styles.header}>
                    <Text style={styles.title}>{isEditing ? 'Edit reminder' : 'New reminder'}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                        <X size={18} color={COLORS.muted} strokeWidth={2.2} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.label}>Card label</Text>
                    <TextInput
                        style={styles.input}
                        value={label}
                        onChangeText={setLabel}
                        placeholder="Morning nudge"
                        placeholderTextColor={COLORS.muted}
                    />

                    <Text style={styles.label}>Fullscreen title</Text>
                    <TextInput
                        style={styles.input}
                        value={previewTitle}
                        onChangeText={setPreviewTitle}
                        placeholder="Drink some water"
                        placeholderTextColor={COLORS.muted}
                    />

                    <Text style={styles.label}>Message</Text>
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        value={message}
                        onChangeText={setMessage}
                        placeholder="Drink some water when you can."
                        placeholderTextColor={COLORS.muted}
                        multiline
                    />

                    <Text style={styles.label}>Photo</Text>
                    <TouchableOpacity style={styles.photoPicker} activeOpacity={0.85} onPress={() => void pickImage()}>
                        {localImageUri ? (
                            <Image source={{ uri: localImageUri }} style={styles.photoPreview} resizeMode="cover" />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <ImagePlus size={24} color={COLORS.accent} strokeWidth={2.2} />
                                <Text style={styles.photoPlaceholderText}>Choose photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.label}>Animation</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {ANIMATION_OPTIONS.map((option) => {
                            const active = photoAnimation === option.id;
                            return (
                                <Pressable
                                    key={option.id}
                                    style={[styles.chip, active && styles.chipActive]}
                                    onPress={() => setPhotoAnimation(option.id)}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </ScrollView>

                <View style={styles.footer}>
                    {isEditing && onDelete ? (
                        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
                            <Trash2 size={16} color={COLORS.danger} strokeWidth={2.2} />
                            <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                    ) : (
                        <View />
                    )}

                    <TouchableOpacity
                        style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
                        onPress={() => void handleSave()}
                        disabled={!canSave || saving}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveBtnText}>{isEditing ? 'Save changes' : 'Save reminder'}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.fill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 24,
        gap: 8,
    },
    label: {
        marginTop: 12,
        marginBottom: 6,
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: COLORS.text,
        backgroundColor: '#FFFFFF',
    },
    inputMultiline: {
        minHeight: 96,
        textAlignVertical: 'top',
    },
    photoPicker: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: COLORS.fill,
    },
    photoPreview: {
        width: '100%',
        height: 220,
    },
    photoPlaceholder: {
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    photoPlaceholderText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.accent,
    },
    chipRow: {
        gap: 8,
        paddingVertical: 4,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: COLORS.fill,
    },
    chipActive: {
        backgroundColor: '#FFF1F2',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.muted,
    },
    chipTextActive: {
        color: COLORS.accent,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    deleteBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.danger,
    },
    saveBtn: {
        minWidth: 148,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.45,
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
