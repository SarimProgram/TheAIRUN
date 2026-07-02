import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  PanResponder,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePoints } from '../../hooks/usePoints';
import { useMarketplace, MarketplaceItem } from '../../hooks/useMarketplace';
import { useAuth } from '@/src/auth/authContext';
import HowToEarn, { HowToEarnButton } from '../../components/marketplace/HowToEarn';

// --- Theme Colors ---
const COLORS = {
  primary: '#FF6B6B',      // Coral Red (Main Theme)
  secondary: '#2EC4B6',    // Teal (Secondary Theme)
  accent: '#10B981',       // Emerald (Success)
  bg: '#F8FAFC',           // Soft Slate BG
  surface: '#FFFFFF',
  text: '#0F172A',         // Deep Navy
  textMuted: '#64748B',    // Slate Muted
  border: '#E2E8F0',       // Slate Border
  primaryLight: '#FFF1F2', // Coral 50
  secondaryLight: '#F0FDFA', // Teal 50
  accentLight: '#ECFDF5',   // Emerald 50
  white: '#FFFFFF',
  successBg: '#ECFDF4',
  successText: '#059669',
  warningBg: '#FFF7ED',
  warningText: '#D97706',
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width / 2) - 24;
const CATEGORY_TABS = ['All', 'Romantic', 'Fun', 'Chore', 'Relaxation'] as const;
const CATEGORY_OPTIONS = ['Romantic', 'Fun', 'Chore', 'Relaxation'] as const;

type StoredMarketplaceCategory = 'Romantic' | 'Fun' | 'Chore' | 'Spicy';
type DisplayMarketplaceCategory = typeof CATEGORY_OPTIONS[number];
type MarketplaceTab = typeof CATEGORY_TABS[number];

const toDisplayCategory = (category: string): DisplayMarketplaceCategory | string =>
  category === 'Spicy' ? 'Relaxation' : category;

const toStoredCategory = (category: DisplayMarketplaceCategory): StoredMarketplaceCategory =>
  category === 'Relaxation' ? 'Spicy' : category;

export default function ModernMarketplace() {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('All');
  const [manageStoreVisible, setManageStoreVisible] = useState(false);
  const [howToEarnVisible, setHowToEarnVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [walletFilter, setWalletFilter] = useState<'rewards' | 'owe'>('rewards');
  const [walletActionId, setWalletActionId] = useState<string | null>(null);

  const [customItem, setCustomItem] = useState({
    title: '',
    emoji: '\u{1F381}',
    category: 'Fun' as DisplayMarketplaceCategory,
    cost: '500', // Default points
    description: '',
  });
  const [creatingItem, setCreatingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [sliderWidth, setSliderWidth] = useState(width - 80);
  const sliderWidthRef = React.useRef(width - 80);
  const costRef = React.useRef(500);
  const animCost = React.useRef(new Animated.Value(500)).current;
  const costAtStart = React.useRef(500);

  // Sync refs and animated value when modal/cost changes
  useEffect(() => {
    sliderWidthRef.current = sliderWidth;
  }, [sliderWidth]);

  useEffect(() => {
    costRef.current = parseInt(customItem.cost) || 100;
  }, [customItem.cost]);

  useEffect(() => {
    if (manageStoreVisible) {
      const currentCost = parseInt(customItem.cost) || 100;
      animCost.setValue(currentCost);
      costAtStart.current = currentCost;
    }
  }, [manageStoreVisible, editingItemId]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gs) => Math.abs(gs.dx) > 2,
      onPanResponderGrant: () => {
        costAtStart.current = costRef.current;
      },
      onPanResponderMove: (evt, gs) => {
        const sw = sliderWidthRef.current;
        if (sw <= 0) return;
        
        const pointRange = 4900; 
        const deltaPoints = (gs.dx / sw) * pointRange;
        const rawNewVal = costAtStart.current + deltaPoints;
        const clampedRaw = Math.min(5000, Math.max(100, rawNewVal));
        
        animCost.setValue(clampedRaw);
        const snappedVal = Math.round(clampedRaw / 100) * 100;
        
        if (costRef.current !== snappedVal) {
          setCustomItem(prev => ({ ...prev, cost: String(snappedVal) }));
        }
      },
      onPanResponderRelease: () => {
        const finalCost = costRef.current;
        Animated.spring(animCost, {
          toValue: finalCost,
          useNativeDriver: false,
          friction: 7,
          tension: 50
        }).start();
      }
    })
  ).current;

  // Calculate thumb position dynamically from Animated.Value
  const thumbLeft = animCost.interpolate({
    inputRange: [100, 5000],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp'
  });

  const { accessToken } = useAuth();
  const { balance: points, refetch: refetchPoints } = usePoints({ accessToken });
  const {
    items, wallet, history, loading, error, redeem, createItem, updateItem, deleteItem, refetchItems,
    refetchHistory, completeWalletItem, undoWalletItem, deleteWalletItem
  } = useMarketplace({ accessToken });

  const filteredItems = activeTab === 'All'
    ? items
    : items.filter(item => toDisplayCategory(item.category) === activeTab);
  const youOweItems = wallet.filter((item) => item.by === 'partner');
  const owedToYouItems = wallet.filter((item) => item.by !== 'partner');
  
  const filteredWallet = walletFilter === 'rewards' ? owedToYouItems : youOweItems;
  const walletSorted = [...filteredWallet];

  const handleBuy = async (item: MarketplaceItem) => {
    if (points >= item.cost) {
      const result = await redeem(item.id);
      if (result.success) {
        await refetchPoints();
        Alert.alert("🎉 Redeemed!", `You got ${item.title}.`);
      } else {
        Alert.alert("❌ Error", result.error || "Failed to complete purchase.");
      }
    } else {
      Alert.alert("📉 Not enough points", "Keep saving up!");
    }
  };

  const resetCustomItem = () => {
    setCustomItem({
      title: '',
      emoji: '\u{1F381}',
      category: 'Fun',
      cost: '',
      description: '',
    });
    setEditingItemId(null);
  };

  const handleCreateOrUpdateItem = async () => {
    const title = customItem.title.trim();
    const costNum = parseInt(customItem.cost, 10);
    if (!title) {
      Alert.alert('Missing title', 'Please enter a reward title.');
      return;
    }
    if (!Number.isFinite(costNum) || costNum <= 0) {
      Alert.alert('Invalid cost', 'Please enter a valid points cost.');
      return;
    }

    setCreatingItem(true);
    try {
      const payload = {
        title,
        emoji: customItem.emoji,
        category: toStoredCategory(customItem.category),
        cost: costNum,
        description: customItem.description.trim() || null,
      };

      const result = editingItemId
        ? await updateItem(editingItemId, payload)
        : await createItem(payload);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to save item');
        return;
      }
      await refetchItems();
      setManageStoreVisible(false);
      resetCustomItem();
      Alert.alert('Success', editingItemId ? 'Reward updated.' : 'Reward created and shared.');
    } finally {
      setCreatingItem(false);
    }
  };

  const handleEditItem = (item: MarketplaceItem) => {
    setEditingItemId(item.id);
    setCustomItem({
      title: item.title,
      emoji: item.emoji,
      category: toDisplayCategory(item.category) as DisplayMarketplaceCategory,
      cost: String(item.cost),
      description: item.description || '',
    });
    setManageStoreVisible(true);
  };

  const handleDeleteItem = (item: MarketplaceItem) => {
    Alert.alert('Delete reward', `Delete "${item.title}" for both partners?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingItemId(item.id);
          try {
            const result = await deleteItem(item.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete item');
              return;
            }
            await refetchItems();
          } finally {
            setDeletingItemId(null);
          }
        }
      }
    ]);
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return String(iso);
    }
  };

  const handleCompleteReward = async (walletItemId: string) => {
    setWalletActionId(walletItemId);
    try {
      const ok = await completeWalletItem(walletItemId);
      if (!ok) Alert.alert('Error', 'Failed to mark reward as fulfilled.');
    } finally {
      setWalletActionId(null);
    }
  };

  const handleUndoReward = async (walletItemId: string) => {
    setWalletActionId(walletItemId);
    try {
      const result = await undoWalletItem(walletItemId);
      if (!result.success) {
        Alert.alert('Undo failed', result.error || 'Could not undo reward');
        return;
      }
      await refetchPoints();
      Alert.alert('Undone', `Reward removed and ${result.refundedPoints ?? 0} points refunded.`);
    } finally {
      setWalletActionId(null);
    }
  };

  const handleDeleteReward = async (walletItemId: string) => {
    setWalletActionId(walletItemId);
    try {
      const ok = await deleteWalletItem(walletItemId);
      if (!ok) Alert.alert('Error', 'Failed to delete reward.');
    } finally {
      setWalletActionId(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>

        {/* --- Header --- */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Marketplace</Text>
          </View>

          <View style={styles.headerRight}>
            <HowToEarnButton onPress={() => setHowToEarnVisible(true)} />
            <View style={styles.pointsBadge}>
              <Ionicons name="heart" size={16} color={COLORS.primary} />
              <Text style={styles.pointsText}>{points.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.warningText} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topSummaryRow}>
            <TouchableOpacity 
              style={[styles.topSummaryCard, walletFilter === 'rewards' && styles.topSummaryCardActive]}
              onPress={() => setWalletFilter('rewards')}
            >
              <View style={styles.topSummaryHeader}>
                <Ionicons name="gift" size={18} color={walletFilter === 'rewards' ? COLORS.white : COLORS.primary} />
                <Text style={[styles.topSummaryLabel, walletFilter === 'rewards' && styles.topSummaryLabelActive]}>Your Rewards</Text>
              </View>
              <Text style={[styles.topSummaryCount, walletFilter === 'rewards' && styles.topSummaryCountActive]}>{owedToYouItems.length}</Text>
              <Text style={[styles.topSummarySub, walletFilter === 'rewards' && styles.topSummarySubActive]}>Active & Ready</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.topSummaryCard, walletFilter === 'owe' && styles.topSummaryCardActive, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}
              onPress={() => setWalletFilter('owe')}
            >
              <View style={styles.topSummaryHeader}>
                <Ionicons name="receipt" size={18} color={walletFilter === 'owe' ? COLORS.white : COLORS.secondary} />
                <Text style={[styles.topSummaryLabel, walletFilter === 'owe' && styles.topSummaryLabelActive]}>You Owe</Text>
              </View>
              <Text style={[styles.topSummaryCount, walletFilter === 'owe' && styles.topSummaryCountActive]}>{youOweItems.length}</Text>
              <Text style={[styles.topSummarySub, walletFilter === 'owe' && styles.topSummarySubActive]}>Pending Tasks</Text>
            </TouchableOpacity>
          </View>

          {/* --- Section 1: Active Wallet --- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Wallet</Text>
            <TouchableOpacity onPress={async () => { await refetchHistory(); setHistoryVisible(true); }}>
              <Text style={styles.seeAll}>History</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletScroll}>
            {walletSorted.map((item) => {
              const isOwed = item.by === 'partner';
              return (
                <View key={item.id} style={[
                  styles.walletCard,
                  isOwed ? { backgroundColor: COLORS.secondaryLight } : { backgroundColor: COLORS.primaryLight }
                ]}>
                  <View style={styles.walletTop}>
                    <Text style={styles.walletEmoji}>{item.icon}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: COLORS.white }]}>
                      <Text style={[styles.statusText, { color: isOwed ? COLORS.secondary : COLORS.primary }]}>
                        {isOwed ? 'OWED' : 'READY'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.walletTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.walletSub}>{item.status}</Text>
                  <View style={styles.walletActionRow}>
                    <TouchableOpacity
                      style={[styles.walletActionBtn, styles.walletActionPrimary]}
                      onPress={() => handleCompleteReward(item.id)}
                      disabled={walletActionId === item.id}
                    >
                      {walletActionId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                          <Text style={styles.walletActionPrimaryText}>Complete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {(item.canUndo || item.canDelete) && (
                      <TouchableOpacity
                        style={[styles.walletActionBtn, styles.walletActionSecondary]}
                        onPress={() => item.canUndo ? handleUndoReward(item.id) : handleDeleteReward(item.id)}
                        disabled={walletActionId === item.id}
                      >
                        <>
                          <Ionicons
                            name={item.canUndo ? "arrow-undo-outline" : "trash-outline"}
                            size={14}
                            color={item.canUndo ? COLORS.primary : COLORS.text}
                          />
                          <Text style={[styles.walletActionSecondaryText, item.canUndo && { color: COLORS.primary }]}>
                            {item.canUndo ? 'Undo' : 'Delete'}
                          </Text>
                        </>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {walletSorted.length === 0 && (
              <View style={styles.emptyWalletCard}>
                <Ionicons name="gift-outline" size={24} color={COLORS.textMuted} />
                <Text style={styles.walletSub}>No {walletFilter === 'rewards' ? 'ready rewards' : 'owed rewards'}</Text>
              </View>
            )}
          </ScrollView>

          {/* --- Section 2: Categories --- */}
          <View style={styles.categoryContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {CATEGORY_TABS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveTab(cat)}
                  style={[styles.categoryPill, activeTab === cat && styles.categoryPillActive]}
                >
                  <Text style={[styles.categoryText, activeTab === cat && styles.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* --- Section 3: Store Grid --- */}
          <View style={styles.gridContainer}>
            {/* Default "Create Your Own" Card (Always Visible) */}
            <TouchableOpacity
              style={[styles.itemCard, styles.defaultCard]}
              onPress={() => { resetCustomItem(); setManageStoreVisible(true); }}
            >
              <View style={styles.defaultEmojiBg}>
                <Ionicons name="add-circle-outline" size={40} color={COLORS.primary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.itemCategory}>CUSTOM</Text>
                <Text style={styles.itemTitle}>Create Reward</Text>
                <Text style={styles.priceText}>Free</Text>
              </View>
            </TouchableOpacity>

            {filteredItems.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => handleBuy(item)}>
                  <View style={styles.itemEmojiBg}>
                    <Text style={{ fontSize: 40 }}>{item.emoji}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.itemCategory}>{toDisplayCategory(item.category)}</Text>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceText}>{item.cost} <Text style={styles.ptsLabel}>pts</Text></Text>
                      <View style={styles.buyBtn}><Ionicons name="add" size={18} color={COLORS.white} /></View>
                    </View>
                  </View>
                </TouchableOpacity>
                {item.isCustom && item.canManage && (
                  <View style={styles.manageRow}>
                    <TouchableOpacity style={styles.manageBtn} onPress={() => handleEditItem(item)}>
                      <Ionicons name="create-outline" size={14} color={COLORS.text} />
                      <Text style={styles.manageBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.manageBtn} onPress={() => handleDeleteItem(item)} disabled={deletingItemId === item.id}>
                      {deletingItemId === item.id ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={14} color={COLORS.primary} />
                          <Text style={[styles.manageBtnText, { color: COLORS.primary }]}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* --- Floating FAB --- */}
        <TouchableOpacity style={styles.fab} onPress={() => setManageStoreVisible(true)}>
          <LinearGradient colors={[COLORS.primary, '#E35B5B']} style={styles.fabGradient}>
            <Ionicons name="settings-outline" size={20} color={COLORS.white} />
            <Text style={styles.fabText}>Manage Store</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* --- Manage Store Modal --- */}
        <Modal visible={manageStoreVisible} animationType="slide" onRequestClose={() => setManageStoreVisible(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setManageStoreVisible(false)}><Ionicons name="close" size={28} color={COLORS.text} /></TouchableOpacity>
                <Text style={styles.modalTitle}>Manage Store</Text>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 24 }}>
                  <Text style={styles.label}>Choose Emoji</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow} contentContainerStyle={{ alignItems: 'center' }}>
                      {[
                        '\u{1F381}', '\u{1F49D}', '\u{1F339}', '\u{1F3AC}', '\u{1F37D}\u{FE0F}',
                        '\u{1F486}', '\u{1F6C1}', '\u{1F3AE}', '\u{1F382}', '\u{2728}',
                      ].map((e) => (
                        <TouchableOpacity key={e} style={[styles.emojiPicker, customItem.emoji === e && styles.emojiPickerActive]} onPress={() => setCustomItem({ ...customItem, emoji: e })}>
                          <Text style={{ fontSize: 24 }}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={styles.customEmojiInputWrapper}>
                        <TextInput 
                          style={styles.customEmojiInput}
                          placeholder="➕"
                          placeholderTextColor={COLORS.textMuted}
                          maxLength={2}
                          value={customItem.emoji}
                          onChangeText={(e) => setCustomItem({ ...customItem, emoji: e })}
                        />
                        <Text style={styles.customEmojiLabel}>Custom</Text>
                      </View>
                    </ScrollView>

                    <Text style={styles.label}>Title</Text>
                    <TextInput style={styles.input} placeholder="Surprise Gift" value={customItem.title} onChangeText={(t) => setCustomItem({ ...customItem, title: t })} />

                    <View style={styles.pointsHeader}>
                      <Text style={styles.label}>Cost: {customItem.cost} pts</Text>
                      <View style={styles.daysBadge}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.daysBadgeText}>{Math.floor(parseInt(customItem.cost) / 100)} Days</Text>
                      </View>
                    </View>

                    <View style={styles.modernSliderContainer}>
                      <View 
                        style={styles.modernSliderTrack}
                        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                        {...panResponder.panHandlers}
                      >
                        <View style={styles.modernSliderBar} />
                        <Animated.View style={[styles.modernSliderFill, { width: thumbLeft }]} />
                        <Animated.View style={[styles.modernSliderThumb, { left: thumbLeft, marginLeft: -16 }]} />
                      </View>
                      <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabelCurrent}>100 pts</Text>
                        <Text style={styles.sliderLabelCurrent}>{customItem.cost} PTS</Text>
                        <Text style={styles.sliderLabelCurrent}>5k pts</Text>
                      </View>
                    </View>

                    <View style={styles.achievementBar}>
                      <View style={styles.achievementInfo}>
                        <Text style={styles.achievementTitle}>Achievement Time</Text>
                        <Text style={styles.achievementSub}>Estimated effort to earn these points</Text>
                      </View>
                      <View style={styles.achievementDaysBox}>
                        <Text style={styles.achievementDaysText}>{Math.floor(parseInt(customItem.cost) / 100)}</Text>
                        <Text style={styles.achievementDaysUnit}>DAYS</Text>
                      </View>
                    </View>

                    <Text style={styles.label}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
                      {CATEGORY_OPTIONS.map((c) => (
                        <TouchableOpacity key={c} style={[styles.catPicker, customItem.category === c && styles.catPickerActive]} onPress={() => setCustomItem({ ...customItem, category: c })}>
                          <Text style={[styles.catPickerText, customItem.category === c && styles.catPickerTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: COLORS.secondary }]}
                      onPress={handleCreateOrUpdateItem}
                      disabled={creatingItem}
                    >
                      {creatingItem ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>{editingItemId ? 'Update Marketplace Item' : 'Create Marketplace Item'}</Text>
                      )}
                    </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <Modal visible={historyVisible} animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}><Ionicons name="close" size={28} color={COLORS.text} /></TouchableOpacity>
              <Text style={styles.modalTitle}>Reward History</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {history.length === 0 ? (
                <View style={styles.noWagerCard}>
                  <Ionicons name="time-outline" size={28} color={COLORS.textMuted} />
                  <Text style={styles.noWagerText}>No reward history yet</Text>
                </View>
              ) : (
                history.map((entry) => (
                  <View key={entry.id} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyEmoji}>{entry.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTitle}>{entry.title}</Text>
                        <Text style={styles.historyMeta}>Bought by {entry.boughtByName} • Owed by {entry.owedByName}</Text>
                      </View>
                      <View style={[styles.historyStatusBadge, entry.fulfilledAt ? styles.historyStatusDone : styles.historyStatusOpen]}>
                        <Text style={styles.historyStatusText}>{entry.fulfilledAt ? 'FULFILLED' : entry.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyLine}>Bought: {formatDateTime(entry.boughtAt)}</Text>
                    <Text style={styles.historyLine}>Fulfilled: {entry.fulfilledAt ? formatDateTime(entry.fulfilledAt) : 'Not yet'}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* --- How To Earn Modal --- */}
        <HowToEarn visible={howToEarnVisible} onClose={() => setHowToEarnVisible(false)} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary },
  pointsText: { marginLeft: 6, fontWeight: '800', color: COLORS.primary, fontSize: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginBottom: 8, backgroundColor: COLORS.warningBg, padding: 10, borderRadius: 10 },
  errorBannerText: { color: COLORS.warningText, fontSize: 12, fontWeight: '700', flex: 1 },
  scrollContent: { paddingBottom: 120 },
  topSummaryRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  topSummaryCard: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  topSummaryCardActive: {
    backgroundColor: COLORS.primary,
  },
  topSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  topSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topSummaryLabelActive: {
    color: COLORS.white,
    opacity: 0.8,
  },
  topSummaryCount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  topSummaryCountActive: {
    color: COLORS.white,
  },
  topSummarySub: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  topSummarySubActive: {
    color: COLORS.white,
    opacity: 0.9,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  walletScroll: { paddingLeft: 24, paddingRight: 12 },
  walletCard: { width: width * 0.68, padding: 16, borderRadius: 24, marginRight: 12, minHeight: 168, justifyContent: 'space-between' },
  emptyWalletCard: { width: width * 0.6, padding: 20, borderRadius: 24, marginRight: 12, height: 140, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  walletTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletEmoji: { fontSize: 32 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '800' },
  walletTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  walletSub: { fontSize: 12, color: COLORS.textMuted },
  walletActionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  walletActionBtn: { flex: 1, height: 32, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  walletActionPrimary: { backgroundColor: COLORS.secondary },
  walletActionSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  walletActionPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  walletActionSecondaryText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
  categoryContainer: { marginVertical: 24 },
  categoryPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.border, marginRight: 8 },
  categoryPillActive: { backgroundColor: COLORS.text },
  categoryText: { fontWeight: '600', color: COLORS.textMuted },
  categoryTextActive: { color: COLORS.white },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, justifyContent: 'space-between' },
  itemCard: { width: CARD_WIDTH, backgroundColor: COLORS.white, borderRadius: 24, marginBottom: 16, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  defaultCard: { borderStyle: 'dashed', borderColor: COLORS.primary, borderWidth: 2 },
  itemEmojiBg: { height: 110, backgroundColor: COLORS.primaryLight, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  defaultEmojiBg: { height: 110, backgroundColor: COLORS.secondaryLight, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardInfo: { padding: 4 },
  itemCategory: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, marginBottom: 4 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceText: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  ptsLabel: { fontSize: 12, fontWeight: '400', color: COLORS.textMuted },
  buyBtn: { backgroundColor: COLORS.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  manageRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingHorizontal: 4, paddingBottom: 4 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  manageBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  fab: { position: 'absolute', bottom: 30, alignSelf: 'center' },
  fabGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32 },
  fabText: { color: 'white', fontWeight: '700', marginLeft: 8 },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  historyCard: { backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 10 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  historyEmoji: { fontSize: 26 },
  historyTitle: { fontWeight: '800', color: COLORS.text, fontSize: 15 },
  historyMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  historyLine: { fontSize: 12, color: COLORS.text, marginTop: 2 },
  historyStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  historyStatusDone: { backgroundColor: COLORS.successBg },
  historyStatusOpen: { backgroundColor: COLORS.warningBg },
  historyStatusText: { fontSize: 10, fontWeight: '800', color: COLORS.text },
  noWagerCard: { padding: 30, alignItems: 'center', borderRadius: 16, backgroundColor: COLORS.border },
  noWagerText: { marginTop: 8, color: COLORS.textMuted, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 10 },
  input: { backgroundColor: COLORS.border, padding: 16, borderRadius: 12, marginBottom: 16 },
  emojiRow: { marginBottom: 16 },
  emojiPicker: { width: 50, height: 50, backgroundColor: COLORS.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  emojiPickerActive: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  catPicker: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.border, borderRadius: 20, marginRight: 8 },
  catPickerActive: { backgroundColor: COLORS.secondary },
  catPickerText: { fontWeight: '600', color: COLORS.textMuted },
  catPickerTextActive: { color: 'white' },
  primaryBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  primaryBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  pointsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  daysBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  daysBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  sliderWrapper: { marginBottom: 24, paddingHorizontal: 4 },
  sliderTrack: { height: 40, backgroundColor: COLORS.border, borderRadius: 12, overflow: 'hidden', justifyContent: 'center' },
  sliderFill: { position: 'absolute', left: 0, height: '100%', backgroundColor: 'rgba(255, 107, 107, 0.15)' },
  sliderScrollContent: { height: '100%', alignItems: 'center' },
  sliderCenterPointer: { position: 'absolute', alignSelf: 'center', width: 4, height: 24, backgroundColor: COLORS.primary, borderRadius: 2, zIndex: 10 },
  tick: { width: 2, height: 10, backgroundColor: COLORS.textMuted, opacity: 0.3, marginHorizontal: 8 },
  heavyTick: { height: 20, opacity: 0.6, backgroundColor: COLORS.text },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  sliderLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  achievementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    marginTop: 8,
  },
  achievementInfo: { flex: 1 },
  achievementTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  achievementSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  achievementDaysBox: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, alignItems: 'center' },
  achievementDaysText: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  achievementDaysUnit: { color: COLORS.white, fontSize: 8, fontWeight: '800', marginTop: -2, opacity: 0.8 },
  customEmojiInputWrapper: { marginLeft: 12, alignItems: 'center' },
  customEmojiInput: { width: 50, height: 50, backgroundColor: COLORS.white, borderRadius: 12, textAlign: 'center', fontSize: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.primary, color: COLORS.text },
  customEmojiLabel: { fontSize: 8, fontWeight: '800', color: COLORS.primary, marginTop: 4, textTransform: 'uppercase' },
  modernSliderContainer: { marginVertical: 35, paddingHorizontal: 4 },
  modernSliderTrack: { height: 40, backgroundColor: 'transparent', width: '100%', justifyContent: 'center', position: 'relative' },
  modernSliderBar: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, width: '100%', position: 'absolute' },
  modernSliderFill: { height: 10, backgroundColor: COLORS.primary, borderRadius: 5, position: 'absolute' },
  modernSliderThumb: { position: 'absolute', width: 32, height: 32, backgroundColor: COLORS.white, borderRadius: 16, elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, borderWidth: 4, borderColor: COLORS.primary },
  sliderLabelCurrent: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 0.5 },
});

