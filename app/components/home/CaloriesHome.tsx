import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Dumbbell, Flame, Swords, Users, UserCheck, UserX, Utensils } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { getOppositeGender, normalizeGender } from '@/utils/genderMascot';
import CalorieShowcase from './CalorieShowcase';

const COLORS = {
  primary: '#FF6B6B', // This is the Coral color
  primarySoft: '#FFF1F2',
  waveAccent: '#FF8E8E',
  textMain: '#1F2937',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  coral: '#FF6B6B',
};

export type PendingInvite = {
  id: string;
  code?: string;
  fromUser?: {
    id: string;
    displayName: string;
    email: string;
  };
  toEmail: string;
  status: string;
};

const UserCard = ({
  title,
  data,
  accent,
  isMain,
  onPress,
  showMotivate,
  onMotivate,
  motivateLabel,
}: {
  title: string;
  data: any;
  accent: string;
  isMain: boolean;
  onPress?: () => void;
  showMotivate?: boolean;
  onMotivate?: () => void;
  motivateLabel?: string;
}) => {
  const remaining = data.goal - (data.food - data.exercise);
  const isNegative = remaining < 0;
  const statusColor = isNegative ? '#EF4444' : accent;
  const progress = data.goal > 0 ? Math.min(1, Math.max(0, (data.food - data.exercise) / data.goal)) : 0;
  const circumference = 2 * Math.PI * 50;

  return (
    <View style={styles.cardOuter}>
      <TouchableOpacity 
        style={styles.cardInner} 
        activeOpacity={0.9} 
        onPress={onPress}
      >
        <View style={styles.nameBadge}><Text numberOfLines={1} style={styles.microTag}>{title}</Text></View>
        <View style={styles.calorieRing}>
          <Svg width="100%" height="100%" viewBox="0 0 112 112" style={StyleSheet.absoluteFill}>
            <Circle cx="56" cy="56" r="50" fill="none" stroke={COLORS.primarySoft} strokeWidth="6" />
            <Circle
              cx="56" cy="56" r="50" fill="none" stroke={statusColor} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - progress)}
              rotation="-90" origin="56, 56" opacity={progress > 0 ? 1 : 0}
            />
          </Svg>
          <View style={styles.mainStatRow}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bigNum, isNegative && { color: '#EF4444' }]}>{Math.round(remaining).toLocaleString()}</Text>
            <View>
              {isNegative ? (
                <AlertTriangle size={14} color="#EF4444" fill="#FEE2E2" />
              ) : (
                <Flame size={14} color={COLORS.primary} fill={COLORS.primary} />
              )}
            </View>
          </View>
          <Text style={styles.subLabel}>{isNegative ? 'KCAL OVER' : 'KCAL LEFT'}</Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.consistentRow}>
            <Utensils size={16} color="#DC2626" />
            <View style={styles.statText}>
              <Text style={[styles.statLabel, { color: '#DC2626' }]}>INTAKE</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: '#DC2626' }]}>-{data.food}</Text>
            </View>
          </View>
          <View style={styles.consistentRow}>
            <Dumbbell size={16} color="#15803D" />
            <View style={styles.statText}>
              <Text style={[styles.statLabel, { color: '#15803D' }]}>BURNED</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: '#15803D' }]}>+{data.exercise}</Text>
            </View>
          </View>
        </View>
        {!isMain && showMotivate && onMotivate && (
          <View style={styles.motivateButton}>
            <TouchableOpacity
              style={styles.motivateButtonPress}
              activeOpacity={0.85}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onMotivate();
              }}
            >
              <AlertTriangle size={13} color="#DC2626" fill="#FEE2E2" />
              <Text style={styles.motivateButtonText}>{motivateLabel || 'Intervene!'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const PartnerPlaceholderCard = ({ 
  onPress, 
  pendingInvite,
  onAccept,
  onDecline
}: { 
  onPress: () => void;
  pendingInvite?: PendingInvite;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}) => {
  if (pendingInvite && onAccept && onDecline) {
    return (
      <View style={styles.cardOuter}>
        <LinearGradient
          colors={['#FFFFFF', '#FFF5F5']}
          style={[styles.cardInner, styles.placeholderCardInner]}
        >
          <View style={styles.placeholderGlassOverlay} />
          <Text style={[styles.microTag, { color: COLORS.primary, opacity: 0.8, marginBottom: 6 }]}>INVITATION</Text>
          
          <View style={styles.partnerImageWrapper}>
            <Users size={28} color={COLORS.primary} strokeWidth={2.5} />
          </View>

          <Text style={styles.placeholderTitle} numberOfLines={1}>
            {pendingInvite.fromUser?.displayName || 'Partner'}
          </Text>
          <Text style={styles.placeholderBody} numberOfLines={1}>Sent you an invite</Text>
          
          <View style={styles.cardInviteActions}>
            <TouchableOpacity 
              style={styles.cardInviteDecline} 
              onPress={() => onDecline(pendingInvite.id)}
            >
              <UserX size={16} color="#EF4444" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cardInviteAccept} 
              onPress={() => onAccept(pendingInvite.id)}
            >
              <UserCheck size={16} color="#FFF" />
              <Text style={styles.cardInviteAcceptText}>ACCEPT</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.cardOuter} 
      activeOpacity={0.9} 
      onPress={onPress}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F4FBFB']}
        style={[styles.cardInner, styles.placeholderCardInner]}
      >
        <View style={styles.placeholderGlassOverlay} />
        <Text style={[styles.microTag, { color: '#1F938A', opacity: 0.8, marginBottom: 6 }]}>TEAM UP</Text>
        
        <View style={styles.partnerImageWrapper}>
          <Image 
            source={require('../../assets/connection.png')} 
            style={styles.partnerPlaceholderImg}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.placeholderTitle}>Link Partner</Text>
        <Text style={styles.placeholderBody} numberOfLines={2}>Sync progress and keep each other motivated.</Text>
        
        <View style={[styles.placeholderCta, { backgroundColor: '#1F938A' }]}>
          <Text style={styles.placeholderCtaText}>INVITE</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};
const firstName = (name?: string) => (name || '').trim().split(/\s+/)[0]?.toUpperCase() || '';

function CaloriePulleyCard({ myData, partnerData, partnerName, partnerGender, partnerIsNegative, nudgeSent, onMotivate, onPressMine, onPressPartner, calendar }: { myData: any; partnerData: any; partnerName?: string; partnerGender?: string | null; partnerIsNegative: boolean; nudgeSent: boolean; onMotivate: () => void; onPressMine: () => void; onPressPartner: () => void; calendar?: React.ReactNode }) {
  const { user } = useAuth();
  const gender = user?.gender;
  const myName = firstName(user?.displayName ?? user?.name) || 'YOU';
  const theirName = firstName(partnerName) || 'PARTNER';

  return <View style={styles.balanceCard}>
    <View style={styles.sceneBleed}>
      <CalorieShowcase mine={myData} partner={partnerData}
        gender={normalizeGender(gender) || 'male'} partnerGender={normalizeGender(partnerGender) || getOppositeGender(gender)}
        myName={myName} partnerName={theirName} onPressMine={onPressMine} onPressPartner={onPressPartner} />
    </View>
    {calendar && <View style={styles.calendarSlot}><View style={styles.calendarContent}>{calendar}</View></View>}
    {partnerIsNegative && <TouchableOpacity style={styles.scaleMotivate} activeOpacity={0.85} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onMotivate(); }}>
      <AlertTriangle size={13} color="#DC2626" fill="#FEE2E2" />
      <Text style={styles.motivateButtonText}>{nudgeSent ? 'Sent' : `${theirName} is over · Intervene`}</Text>
    </TouchableOpacity>}
  </View>;
}

type CaloriesHomeProps = {
  width?: number;
  calendar?: React.ReactNode;
  myData: any;
  partnerSummary: any;
  hasPartner: boolean;
  partnerName?: string;
  partnerGender?: string | null;
  partnerIsNegative: boolean;
  onMotivate: () => void;
  nudgeSent: boolean;
  pendingInvites: PendingInvite[];
  acceptInvite: (id: string) => void;
  declineInvite: (id: string) => void;
};

// Shared nutrition cards for the home calorie goal.
export default function CaloriesHome({ width: heroPageWidth, calendar, myData, partnerSummary, hasPartner, partnerName, partnerGender, partnerIsNegative, onMotivate: handleMotivatePartnerCalories, nudgeSent, pendingInvites, acceptInvite, declineInvite }: CaloriesHomeProps) {
  const router = useRouter();
  const openMine = () => router.push({ pathname: '/activity', params: { tab: 'NUTRITION' } });
  const openPartner = () => router.push({
    pathname: '/kcal-detail',
    params: { myData: JSON.stringify(myData), partnerData: JSON.stringify(partnerSummary), partnerName: partnerName || 'Partner' },
  });

  if (hasPartner && partnerSummary) {
    return (
      <View style={[styles.caloriesPage, { width: heroPageWidth }]}>
        <CaloriePulleyCard
          myData={myData}
          partnerData={partnerSummary}
          partnerName={partnerName}
          partnerGender={partnerGender}
          partnerIsNegative={partnerIsNegative}
          nudgeSent={nudgeSent}
          onMotivate={handleMotivatePartnerCalories}
          onPressMine={openMine}
          onPressPartner={openPartner}
          calendar={calendar}
        />
      </View>
    );
  }

  return (
<View style={[styles.caloriesPage, { width: heroPageWidth, minHeight: 286 }]}>
                  <View style={styles.grid}>

                    <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(200)}>
                          <UserCard
                            isMain={true}
                            onPress={() => router.push({ pathname: '/activity', params: { tab: 'NUTRITION' } })}
                            title="YOU"
                            data={myData}
                            accent={COLORS.primary}
                          />
                    </Animated.View>

                    <>
                      <View style={styles.vsFloating}>
                        <View style={styles.vsInner}><Swords size={12} color={COLORS.textMuted} /></View>
                      </View>
                      <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(400)}>
                        {hasPartner && partnerSummary ? (
                          <UserCard
                            isMain={false}
                            onPress={() => router.push({
                              pathname: '/kcal-detail',
                              params: {
                                myData: JSON.stringify(myData),
                                partnerData: JSON.stringify(partnerSummary),
                                partnerName: partnerName || 'Partner'
                              }
                            })}
                            title={partnerName || "PARTNER"}
                            data={partnerSummary}
                            accent={COLORS.primary}
                            showMotivate={partnerIsNegative}
                            onMotivate={handleMotivatePartnerCalories}
                            motivateLabel={nudgeSent ? 'Sent' : 'Intervene!'}
                          />
                        ) : (
                          <PartnerPlaceholderCard
                            onPress={() => router.push('/Partner')}
                            pendingInvite={pendingInvites[0]}
                            onAccept={acceptInvite}
                            onDecline={declineInvite}
                          />
                        )}
                      </Animated.View>
                    </>
                  </View>
                  {calendar && <View style={styles.calendarSlot}><View style={styles.calendarContent}>{calendar}</View></View>}
                </View>
  );
}

const styles = StyleSheet.create({
caloriesPage: { justifyContent: 'flex-start', gap: 16, paddingTop: 0, paddingBottom: 0 },
grid: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
cardOuter: {
    backgroundColor: '#FFFFFF', borderRadius: 26, borderCurve: 'continuous',
    borderWidth: 1, borderColor: '#F1F5F9',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
  },
cardInner: { paddingHorizontal: 8, paddingVertical: 12, borderRadius: 24, alignItems: 'center', minHeight: 260, justifyContent: 'center' },
nameBadge: { backgroundColor: COLORS.primarySoft, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 5, maxWidth: '100%', marginBottom: 12 },
microTag: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, color: COLORS.textMain },
statText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
statLabel: { flexShrink: 1, fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.2 },
calorieRing: { width: 120, maxWidth: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
mainStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, width: '84%' },
bigNum: { flexShrink: 1, fontSize: 28, fontWeight: '900', letterSpacing: -1.5, color: COLORS.textMain, fontVariant: ['tabular-nums'] },
subLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 0.5 },
statsContainer: { width: '100%', gap: 6 },
consistentRow: { flexDirection: 'row', minWidth: 0, alignItems: 'center', gap: 6, backgroundColor: COLORS.bg, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 12 },
statValue: { flexShrink: 1, color: COLORS.textMain, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
motivateButton: {
    position: 'absolute',
    bottom: -10,
    right: -5,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
motivateButtonPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 14,
  },
motivateButtonText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
placeholderCardInner: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
placeholderGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
partnerImageWrapper: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
cardInviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    width: '100%',
  },
cardInviteDecline: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
cardInviteAccept: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
cardInviteAcceptText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
partnerPlaceholderImg: {
    width: 60,
    height: 60,
  },
placeholderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 0,
    letterSpacing: -0.3,
  },
placeholderBody: {
    fontSize: 10,
    lineHeight: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 2,
  },
placeholderCta: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#1F938A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
placeholderCtaText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#FFF',
  },
balanceCard: { gap: 8 },
// Cancels the home sheet's 24pt horizontal padding so the scene reaches the screen edges.
sceneBleed: { marginHorizontal: -24 },
calendarSlot: { alignItems: 'center' },
calendarContent: { width: '100%' },
scaleMotivate: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#FCA5A5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14,
  },
vsFloating: { position: 'absolute', left: '50%', top: '35%', marginLeft: -14, zIndex: 10, padding: 3, backgroundColor: '#FFF', borderRadius: 20 },
vsInner: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }
});
