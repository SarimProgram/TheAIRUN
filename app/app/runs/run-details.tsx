import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Check, Play, X } from 'lucide-react-native';
import { getRunMeta } from '@/constants/runDetails';
import { getIntervalWorkoutRouteFromTemplateId } from '@/lib/interval-workout';

export default function RunDetailsScreen() {
  const params = useLocalSearchParams<{
    runType?: string;
    runKm?: string;
    sessionId?: string;
    weekContext?: string;
  }>();

  const runType = params.runType || 'Easy Run';
  const runKm = Number.isFinite(parseFloat(params.runKm || '')) ? parseFloat(params.runKm || '0') : 0;
  const weekContext = params.weekContext || 'Week 1';
  const sessionId = params.sessionId || '';
  const runMeta = useMemo(() => getRunMeta(runType), [runType]);
  const runInfo = runMeta.details;

  const startRun = () => {
    if (runMeta.launchMode === 'interval') {
      router.push({
        pathname: getIntervalWorkoutRouteFromTemplateId(runMeta.templateId),
        params: {
          sessionId,
          source: 'plan',
          distanceKm: String(runKm || 0),
          weekContext,
        },
      });
      return;
    }

    router.push({
      pathname: '/runs/runscreen',
      params: {
        sessionId,
        templateId: runMeta.templateId,
        distanceKm: String(runKm || 5),
        weekContext,
      },
    });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.preTitle}>MISSION BRIEFING</Text>
          <Text style={styles.title}>{runInfo.title}</Text>
          <Text style={styles.weekText}>{weekContext}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <X size={20} color="#6C757D" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>{runInfo.description}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={styles.statValue}>{runKm.toFixed(1)} KM</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>INTENSITY</Text>
            <Text style={[styles.statValue, { color: runInfo.color }]}>{runInfo.intensity}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KEY BENEFITS</Text>
          {runInfo.benefits.map((benefit, i) => (
            <View key={`${benefit}-${i}`} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: runInfo.color }]} />
              <Text style={styles.rowText}>{benefit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRO TIPS</Text>
          {runInfo.tips.map((tip, i) => (
            <View key={`${tip}-${i}`} style={styles.row}>
              <Check size={14} color="#00B894" />
              <Text style={styles.rowText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={[styles.cta, { backgroundColor: runInfo.color }]} onPress={startRun}>
        <Play size={20} color="#FFF" fill="#FFF" />
        <Text style={styles.ctaText}>START TRAINING SESSION</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  preTitle: {
    fontSize: 11,
    color: '#6C757D',
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1A1C1E',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  weekText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '600',
    marginTop: 4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  statLabel: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '700',
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 6,
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    fontWeight: '600',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cta: {
    margin: 20,
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
