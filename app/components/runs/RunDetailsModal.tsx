import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react-native';
import { getRunMeta, getPlanSessionStartLabel } from '@/constants/runDetails';
import { usePaceProfile } from '@/hooks/usePaceProfile';
import {
  formatPaceRange,
  getPaceRange,
  getPaceStateForWorkout,
  getPaceStatusText,
  getPaceTargetKey,
} from '@/lib/pace-personalization';

const COLORS = {
  textMain: '#1A1C1E',
  textSub: '#6C757D',
  success: '#00B894',
};

type RunDetailsModalProps = {
  visible: boolean;
  runType: string | null;
  runKm: number;
  onClose: () => void;
  onStart: () => void;
};

export function RunDetailsModal({
  visible,
  runType,
  runKm,
  onClose,
  onStart,
}: RunDetailsModalProps) {
  const [expanded, setExpanded] = useState({
    benefits: true,
    experts: false,
    phases: false,
    tips: false,
  });

  const runMeta = useMemo(() => getRunMeta(runType), [runType]);
  const runInfo = runMeta.details;
  const paceTargetKey = getPaceTargetKey(runType);
  const supportsPersonalPace = paceTargetKey !== null;
  const { profile: paceProfile, loading: paceLoading } = usePaceProfile(visible && supportsPersonalPace);
  const paceRange = getPaceRange(paceProfile, paceTargetKey);
  const paceState = getPaceStateForWorkout(paceProfile, paceTargetKey);
  const paceStatusText = getPaceStatusText(paceState);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.dragHandle} />
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.preTitle}>RUN DETAILS</Text>
              <Text style={styles.title}>{runInfo.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={16} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>{runInfo.description}</Text>

            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>DISTANCE</Text>
                <Text style={styles.statValue}>{runKm.toFixed(1)} KM</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>INTENSITY</Text>
                <Text style={[styles.statValue, { color: runInfo.color }]}>{runInfo.intensity}</Text>
              </View>
            </View>

            {supportsPersonalPace ? (
              <View style={[styles.paceCard, { borderColor: `${runInfo.color}2E` }]}>
                <View style={styles.paceCardTopRow}>
                  <Text style={styles.paceCardLabel}>SUGGESTED PACE FOR THIS SESSION</Text>
                  <View style={[styles.paceDot, { backgroundColor: runInfo.color }]} />
                </View>
                <Text style={[styles.paceCardValue, { color: runInfo.color }]}>
                  {paceLoading && !paceRange ? 'Loading pace' : formatPaceRange(paceRange)}
                </Text>
                {paceStatusText ? <Text style={styles.paceCardStatus}>{paceStatusText}</Text> : null}
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setExpanded((prev) => ({ ...prev, benefits: !prev.benefits }))}
            >
              <Text style={styles.sectionTitle}>Benefits</Text>
              {expanded.benefits ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
            </TouchableOpacity>
            {expanded.benefits && runInfo.benefits.map((item, i) => (
              <View key={`benefit-${i}`} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: runInfo.color }]} />
                <Text style={styles.rowText}>{item}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setExpanded((prev) => ({ ...prev, experts: !prev.experts }))}
            >
              <Text style={styles.sectionTitle}>Experts Say</Text>
              {expanded.experts ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
            </TouchableOpacity>
            {expanded.experts && runInfo.expertOpinions.map((item, i) => (
              <View key={`expert-${i}`} style={styles.row}>
                <Check size={14} color={COLORS.success} />
                <Text style={styles.rowText}>{item}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setExpanded((prev) => ({ ...prev, phases: !prev.phases }))}
            >
              <Text style={styles.sectionTitle}>Phases</Text>
              {expanded.phases ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
            </TouchableOpacity>
            {expanded.phases && runInfo.phases.map((phase, i) => (
              <View key={`phase-${i}`} style={styles.phaseRow}>
                <Text style={styles.rowText}>{phase.name}</Text>
                <Text style={styles.phasePct}>{phase.duration}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setExpanded((prev) => ({ ...prev, tips: !prev.tips }))}
            >
              <Text style={styles.sectionTitle}>Tips</Text>
              {expanded.tips ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
            </TouchableOpacity>
            {expanded.tips && runInfo.tips.map((item, i) => (
              <View key={`tip-${i}`} style={styles.row}>
                <Check size={14} color={COLORS.success} />
                <Text style={styles.rowText}>{item}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: runInfo.color }]}
            onPress={onStart}
          >
            <Activity size={16} color="#FFF" />
            <Text style={styles.startBtnText}>
              {getPlanSessionStartLabel(runType, runKm)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  scroll: {
    maxHeight: 460,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  preTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F6F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMain,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDF1F5',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 0.8,
  },
  statValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  paceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paceCardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paceCardLabel: {
    color: COLORS.textSub,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  paceDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  paceCardValue: {
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    marginTop: 5,
  },
  paceCardStatus: {
    color: COLORS.textSub,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMain,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMain,
    lineHeight: 19,
    fontWeight: '600',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  phasePct: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF4757',
  },
  startBtn: {
    height: 46,
    borderRadius: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
