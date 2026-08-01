import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';

import { CaptureSuccess } from '@/components/forms';
import { AccountIcon } from '@/components/finance/AccountIcon';
import { CategoryPicker } from '@/components/review';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { BottomSheet, Button, CommandPanel, DisclosureSection, Input, ListRow, SegmentedControl, StatusBadge } from '@/components/primitives';
import { EmptyState } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import type { FinancialAccount, FinancialCategories } from '@/lib/domain';

const captureKinds = [
  { value: 'note', label: 'Note', icon: 'edit-3' },
  { value: 'wallet', label: 'Money', icon: 'dollar-sign' },
  { value: 'notification', label: 'Alert', icon: 'bell' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'event', label: 'Event', icon: 'box' },
] as const;

type CaptureKind = (typeof captureKinds)[number]['value'];
type TransactionType = 'expense' | 'income';
type Currency = 'UYU' | 'USD';

export default function CaptureScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [kind, setKind] = useState<CaptureKind>('note');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('UYU');
  const [merchant, setMerchant] = useState('');
  const [source, setSource] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSelectorOpen, setAccountSelectorOpen] = useState(false);
  const [categories, setCategories] = useState<FinancialCategories>({ expense: [], income: [] });
  const [category, setCategory] = useState('');
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const voice = NativeModules.BrainIAVoiceNote;
  const transcript = useMemo(() => new NativeEventEmitter(voice).addListener('BrainIAVoiceTranscript', ({ text }: { text: string }) => setBody(text)), [voice]);
  useState(() => () => transcript.remove());
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([client.listFinancialAccounts(), client.listFinancialCategories()])
      .then(([items, categorySets]) => {
        if (!active) return;
        setAccounts(items);
        setCategories(categorySets);
      })
      .catch(() => {
        if (!active) return;
        setAccounts([]);
        setCategories({ expense: [], income: [] });
      });
    return () => { active = false; };
  }, [client]));

  const compatibleAccounts = accounts.filter((account) => account.currency === currency);
  const selectedAccount = compatibleAccounts.find((account) => account.id === accountId);
  const categoryOptions = categories[transactionType];

  async function startVoiceNote() {
    if (Platform.OS !== 'android' || !voice) { setResult({ ok: false, message: 'Voice notes are available in the Android app.' }); return; }
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) { setResult({ ok: false, message: 'Microphone permission is required to record a voice note.' }); return; }
    setRecording(true); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await voice.start();
  }
  function stopVoiceNote() { if (recording) { voice?.stop(); setRecording(false); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }

  const kindCopy = useMemo(() => {
    switch (kind) {
      case 'wallet':
        return 'Record money in or money out with the details that matter.';
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
    if (kind === 'wallet' && !amount.trim()) {
      setResult({ ok: false, message: 'Add an amount before saving this transaction.' });
      return;
    }

    if (kind !== 'wallet' && !body.trim() && !title.trim()) {
      setResult({ ok: false, message: 'Add a note or title before capturing.' });
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const payload =
        kind === 'wallet'
          ? {
              title: title.trim() || merchant.trim() || (transactionType === 'income' ? 'Income' : 'Expense'),
              body: body.trim() || undefined,
              amount: amount.trim() || undefined,
              currency,
              merchantLabel: merchant.trim() || undefined,
              note: body.trim() || title.trim() || undefined,
              transactionType,
              accountId: accountId || undefined,
              category: category || undefined,
              source: source.trim() || 'mobile',
              tags: ['mobile', 'finance', transactionType],
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
      setCurrency('UYU');
      setMerchant('');
      setSource('');
      setAccountId(null);
      setCategory('');
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
        title="New event"
        subtitle="Choose what you are adding, then save it in a few taps."
        secondaryAction={<StatusBadge label={busy ? 'Saving' : 'Ready'} tone={busy ? 'warning' : 'positive'} />}
      />

      <Section title="Event type" subtitle="Money opens a focused form for income and expenses.">
        <SegmentedControl
          value={kind}
          onChange={(nextKind) => {
            setKind(nextKind);
            setResult(null);
            void Haptics.selectionAsync();
          }}
          options={captureKinds.map((item) => ({
            value: item.value,
            label: item.label,
            icon: <Feather name={item.icon as never} size={15} color={kind === item.value ? theme.colors.textPrimary : theme.colors.textSecondary} />,
          }))}
        />
      </Section>

      {kind === 'wallet' ? (
        <CommandPanel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surfaceSubtle,
              }}
            >
              <Feather
                name={transactionType === 'income' ? 'arrow-down-left' : 'arrow-up-right'}
                size={21}
                color={transactionType === 'income' ? theme.status.income : theme.status.expense}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Add transaction</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{kindCopy}</Text>
            </View>
          </View>

          <SegmentedControl
            value={transactionType}
            onChange={(nextType) => {
              setTransactionType(nextType);
              setCategory('');
              setResult(null);
              void Haptics.selectionAsync();
            }}
            options={[
              { value: 'expense', label: 'Expense', icon: <Feather name="arrow-up-right" size={16} color={transactionType === 'expense' ? theme.colors.onAccent : theme.status.expense} /> },
              { value: 'income', label: 'Income', icon: <Feather name="arrow-down-left" size={16} color={transactionType === 'income' ? theme.colors.onAccent : theme.status.income} /> },
            ]}
          />

          <Input
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            accessibilityLabel={`${transactionType === 'income' ? 'Income' : 'Expense'} amount`}
            style={[theme.typography.numeral, { minHeight: 64, fontSize: 28 }]}
          />
          <ListRow
            title={selectedAccount?.name ?? `Select a ${currency} account`}
            subtitle={transactionType === 'income' ? 'To account' : 'From account'}
            description={selectedAccount ? `${selectedAccount.type} · ${selectedAccount.currency}` : 'Choose an existing account from your portfolio.'}
            leading={<AccountIcon color={selectedAccount?.color} />}
            trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
            onPress={() => setAccountSelectorOpen(true)}
          />
          <ListRow
            title={category || `Select an ${transactionType} category`}
            subtitle="Category"
            description="Categories are managed centrally by BrainIA."
            leading={<Feather name="tag" size={20} color={theme.colors.accentStrong} />}
            trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
            onPress={() => setCategorySelectorOpen(true)}
          />
          <Input
            label={transactionType === 'income' ? 'From' : 'Merchant or payee'}
            value={merchant}
            onChangeText={setMerchant}
            placeholder={transactionType === 'income' ? 'Salary, client, refund' : 'Groceries, rent, pharmacy'}
          />
          <Input label="Description" value={title} onChangeText={setTitle} placeholder="What was this for?" />
          <Input label="Note" value={body} onChangeText={setBody} placeholder="Optional details" multiline />

          <DisclosureSection title="More details" subtitle="Add a currency only when it helps.">
            <SegmentedControl
              value={currency}
              onChange={(nextCurrency) => {
                setCurrency(nextCurrency);
                setAccountId(null);
                void Haptics.selectionAsync();
              }}
              options={[
                { value: 'UYU', label: 'UYU' },
                { value: 'USD', label: 'USD' },
              ]}
            />
          </DisclosureSection>

          <Button
            label={busy ? 'Saving...' : `Save ${transactionType}`}
            onPress={submit}
            loading={busy}
          />
        </CommandPanel>
      ) : (
        <>
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
            {kind === 'note' ? <Pressable onPressIn={startVoiceNote} onPressOut={stopVoiceNote} style={{ alignItems: 'center', gap: 6, padding: 12 }}><Feather name="mic" size={26} color={recording ? theme.colors.danger : theme.colors.accentStrong} /><Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{recording ? 'Listening… release to finish' : 'Hold to record a voice note'}</Text></Pressable> : null}
            <Button label={busy ? 'Capturing...' : 'Capture'} onPress={submit} loading={busy} />
          </CommandPanel>

          <Section title="Details" subtitle="Optional fields improve search and summaries.">
            <DisclosureSection title="Optional capture details" subtitle="Open when the source needs structure.">
              <Input label={kind === 'email' ? 'Subject' : 'Title'} value={title} onChangeText={setTitle} placeholder="Short label" />
              {kind === 'email' || kind === 'notification' || kind === 'event' ? (
                <Input label={kind === 'email' ? 'From' : 'Source'} value={source} onChangeText={setSource} placeholder="Email, app, automation, mobile" />
              ) : null}
            </DisclosureSection>
          </Section>
        </>
      )}

      {result?.ok ? (
        <CaptureSuccess message={result.message} onCaptureAnother={() => setResult(null)} />
      ) : result ? (
        <EmptyState title="Capture failed" description={result.message} primaryActionLabel="Try again" onPrimaryAction={() => setResult(null)} />
      ) : null}

      <BottomSheet
        visible={accountSelectorOpen}
        title={transactionType === 'income' ? 'Select to account' : 'Select from account'}
        onClose={() => setAccountSelectorOpen(false)}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Only accounts using {currency} are available for this transaction.</Text>
        {compatibleAccounts.length ? compatibleAccounts.map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            subtitle={`${account.type} · ${account.currency}`}
            leading={<AccountIcon color={account.color} />}
            trailing={<Text style={[theme.typography.caption, { color: account.id === accountId ? theme.colors.success : theme.colors.textMuted }]}>{account.id === accountId ? 'Selected' : 'Use'}</Text>}
            onPress={() => {
              setAccountId(account.id);
              setAccountSelectorOpen(false);
              void Haptics.selectionAsync();
            }}
          />
        )) : <EmptyState title={`No ${currency} accounts`} description="Create an account in Money, then return here to select it." />}
        {accountId ? <Button label="Clear selection" variant="secondary" onPress={() => { setAccountId(null); setAccountSelectorOpen(false); }} /> : null}
      </BottomSheet>

      <BottomSheet visible={categorySelectorOpen} title={`${transactionType === 'income' ? 'Income' : 'Expense'} category`} onClose={() => setCategorySelectorOpen(false)}>
        {categoryOptions.length ? (
          <CategoryPicker
            categories={categoryOptions}
            selectedCategory={category}
            onSelect={(value) => {
              setCategory(value);
              setCategorySelectorOpen(false);
              void Haptics.selectionAsync();
            }}
          />
        ) : <EmptyState title="Categories unavailable" description="Connect to BrainIA and try again to load the current category set." />}
      </BottomSheet>
    </AppScreen>
  );
}
