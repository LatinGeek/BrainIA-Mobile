import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { CaptureSuccess } from '@/components/forms';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { Button, CommandPanel, DisclosureSection, Input, SegmentedControl, StatusBadge } from '@/components/primitives';
import { EmptyState } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';

const captureKinds = [
  { value: 'note', label: 'Note', icon: 'edit-3' },
  { value: 'wallet', label: 'Expense', icon: 'credit-card' },
  { value: 'notification', label: 'Alert', icon: 'bell' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'event', label: 'Event', icon: 'box' },
] as const;

type CaptureKind = (typeof captureKinds)[number]['value'];

export default function CaptureScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [kind, setKind] = useState<CaptureKind>('note');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const kindCopy = useMemo(() => {
    switch (kind) {
      case 'wallet':
        return 'Add an expense or wallet notification with amount and merchant context.';
      case 'email':
        return 'Save email-like content with a subject and sender if useful.';
      case 'notification':
        return 'Preserve the notification text before it disappears.';
      case 'event':
        return 'Use this only for generic activity that does not fit another type.';
      default:
        return 'Drop a thought, reminder, receipt note, or useful detail.';
    }
  }, [kind]);

  async function submit() {
    if (!body.trim() && !title.trim()) {
      setResult({ ok: false, message: 'Add a note or title before capturing.' });
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const payload =
        kind === 'wallet'
          ? {
              title: title.trim() || merchant.trim() || 'Expense',
              body: body.trim(),
              amount: amount.trim() || undefined,
              merchantLabel: merchant.trim() || undefined,
              source: source.trim() || 'mobile',
              tags: ['mobile', 'finance'],
            }
          : {
              title: title.trim() || body.trim().slice(0, 64),
              body: body.trim(),
              source: source.trim() || 'mobile',
              tags: ['mobile', kind],
            };

      await client.capture(kind, payload);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, message: 'Saved to BrainIA.' });
      setBody('');
      setTitle('');
      setAmount('');
      setMerchant('');
      setSource('');
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ ok: false, message: error instanceof Error ? error.message : 'Unable to capture this right now.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <TopBar
        title="Capture"
        subtitle="Save something quickly, then let BrainIA classify it."
        secondaryAction={<StatusBadge label={busy ? 'Saving' : 'Ready'} tone={busy ? 'warning' : 'positive'} />}
      />

      <CommandPanel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Feather name="zap" size={20} color={theme.colors.accentStrong} />
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Quick capture</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{kindCopy}</Text>
          </View>
        </View>
        <Input
          value={body}
          onChangeText={setBody}
          placeholder="What do you want to remember?"
          multiline
          accessibilityLabel="Quick capture text"
        />
        <Button label={busy ? 'Capturing...' : 'Capture'} onPress={submit} loading={busy} />
      </CommandPanel>

      <Section title="Type" subtitle="Keep the default as Note unless the content is clearly a source payload.">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={captureKinds.map((item) => ({
            value: item.value,
            label: item.label,
            icon: <Feather name={item.icon as never} size={15} color={kind === item.value ? theme.colors.textPrimary : theme.colors.textSecondary} />,
          }))}
        />
      </Section>

      <Section title="Details" subtitle="Optional fields improve search and finance summaries.">
        <DisclosureSection title="Optional capture details" subtitle="Open when the source needs structure.">
          <Input label={kind === 'email' ? 'Subject' : 'Title'} value={title} onChangeText={setTitle} placeholder="Short label" />
          {kind === 'wallet' ? (
            <>
              <Input label="Amount" value={amount} onChangeText={setAmount} placeholder="$12.50" keyboardType="decimal-pad" />
              <Input label="Merchant" value={merchant} onChangeText={setMerchant} placeholder="Spotify, groceries, pharmacy" />
            </>
          ) : null}
          {kind === 'email' || kind === 'notification' || kind === 'event' ? (
            <Input label={kind === 'email' ? 'From' : 'Source'} value={source} onChangeText={setSource} placeholder="Email, app, automation, mobile" />
          ) : null}
        </DisclosureSection>
      </Section>

      {result?.ok ? (
        <CaptureSuccess message={result.message} onCaptureAnother={() => setResult(null)} />
      ) : result ? (
        <EmptyState title="Capture failed" description={result.message} primaryActionLabel="Try again" onPrimaryAction={() => setResult(null)} />
      ) : null}
    </AppScreen>
  );
}
