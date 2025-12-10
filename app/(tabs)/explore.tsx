import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const insightStacks = [
  {
    title: 'Focus Sprint',
    description: '25-minute deep work block. Preload 3 tabs, mute pings, surface one brief.',
    checklist: ['Launch Nimbus Home', 'Queue AI Brief', 'Enable reader filter'],
    accent: '#f472b6',
  },
  {
    title: 'Exploration Jam',
    description: 'Open inspiration feeds, pin sketches, and create a scrap stack.',
    checklist: ['Behance inspiration', 'Pinterest board', 'Open Miro scratch'],
    accent: '#38bdf8',
  },
  {
    title: 'Ship Review',
    description: 'Load analytics, Notion timeline, and release checklist for review.',
    checklist: ['Growth dashboard', 'Retro template', 'Launch tweet draft'],
    accent: '#a3e635',
  },
];

const automationIdeas = [
  {
    title: 'Morning brief',
    detail: '7am push summary sourced from three saved queries and calendar events.',
  },
  {
    title: 'Context link copy',
    detail: 'Whenever you copy a URL, auto-append a summary sentence.',
  },
  {
    title: 'Zen tab',
    detail: 'Detect Slack keyword “focus” and collapse all media-heavy tabs.',
  },
];

const toggleDefaults: Record<string, boolean> = {
  reader: true,
  analytics: false,
  offline: true,
};

export default function AdvisoryScreen() {
  const [toggles, setToggles] = useState(toggleDefaults);

  const activeCount = useMemo(() => Object.values(toggles).filter(Boolean).length, [toggles]);

  const handleToggle = (key: string) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Advisory deck</ThemedText>
      <ThemedText style={styles.description}>
        Curated rituals, automations, and guardrails to help your React Native browser concept feel
        intentional on every platform.
      </ThemedText>

      <ThemedView style={styles.summaryCard}>
        <ThemedText type="subtitle">Session builder</ThemedText>
        <ThemedText style={styles.summaryCopy}>
          {activeCount} / {Object.keys(toggleDefaults).length} rituals enabled.
        </ThemedText>
        <View style={styles.toggleRow}>
          <ToggleRow
            label="Reader mode"
            detail="Auto declutter newsletters and research notes"
            value={toggles.reader}
            onToggle={() => handleToggle('reader')}
          />
          <ToggleRow
            label="Telemetry"
            detail="Collect minimal analytics for UX decisions"
            value={toggles.analytics}
            onToggle={() => handleToggle('analytics')}
          />
          <ToggleRow
            label="Offline sync"
            detail="Cache saved reads before takeoff"
            value={toggles.offline}
            onToggle={() => handleToggle('offline')}
          />
        </View>
      </ThemedView>

      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">Suggested stacks</ThemedText>
        <ThemedText style={styles.sectionLabel}>Tap a card to send to the browser tab.</ThemedText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
        snapToAlignment="start"
        decelerationRate="fast">
        {insightStacks.map((stack) => (
          <Pressable
            key={stack.title}
            style={[styles.stackCard, { borderColor: stack.accent }]}
            onPress={() =>
              Alert.alert('Stack queued', `${stack.title} pushed to Nimbus for the next session.`)
            }>
            <View style={[styles.stackAccent, { backgroundColor: stack.accent }]} />
            <View style={styles.stackBody}>
              <ThemedText type="subtitle">{stack.title}</ThemedText>
              <ThemedText style={styles.stackDescription}>{stack.description}</ThemedText>
              {stack.checklist.map((item) => (
                <View key={item} style={styles.checkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={stack.accent} />
                  <ThemedText style={styles.checkText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">Automation ideas</ThemedText>
        <ThemedText style={styles.sectionLabel}>Mini roadmap for future builds.</ThemedText>
      </View>

      <ThemedView style={styles.automationList}>
        {automationIdeas.map((idea) => (
          <View key={idea.title} style={styles.ideaRow}>
            <View style={styles.ideaCopy}>
              <ThemedText type="defaultSemiBold">{idea.title}</ThemedText>
              <ThemedText style={styles.ideaDetail}>{idea.detail}</ThemedText>
            </View>
            <Pressable
              style={styles.ideaButton}
              onPress={() =>
                Alert.alert('Draft created', 'Automation added to the prototype backlog.')
              }>
              <ThemedText style={styles.ideaButtonText}>Draft</ThemedText>
            </Pressable>
          </View>
        ))}
      </ThemedView>
    </ScrollView>
  );
}

type ToggleRowProps = {
  label: string;
  detail: string;
  value: boolean;
  onToggle: () => void;
};

function ToggleRow({ label, detail, value, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.toggleItem}>
      <View style={{ flex: 1 }}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText style={styles.toggleDetail}>{detail}</ThemedText>
      </View>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 20,
  },
  description: {
    fontSize: 15,
    color: '#475569',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    gap: 16,
  },
  summaryCopy: {
    fontSize: 16,
    color: '#4338ca',
  },
  toggleRow: {
    gap: 16,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleDetail: {
    fontSize: 13,
    color: '#475569',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cardRow: {
    gap: 16,
  },
  stackCard: {
    width: 280,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  stackAccent: {
    width: 6,
    borderRadius: 999,
  },
  stackBody: {
    flex: 1,
    gap: 8,
  },
  stackDescription: {
    fontSize: 14,
    color: '#475569',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    fontSize: 13,
  },
  automationList: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ideaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  ideaCopy: {
    flex: 1,
    gap: 4,
  },
  ideaDetail: {
    fontSize: 13,
    color: '#475569',
  },
  ideaButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  ideaButtonText: {
    color: '#fff',
    fontSize: 13,
  },
});
