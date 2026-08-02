import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';

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
type TransactionType = 'expense' | 'income' | 'transfer';
type Currency = 'UYU' | 'USD';
type VoiceState = 'idle' | 'requesting' | 'starting' | 'recording' | 'transcribing' | 'error';
type VoiceNoteNativeModule = {
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  cancel: () => Promise<boolean>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const voiceModule = Platform.OS === 'android' ? NativeModules.BrainIAVoiceNote as VoiceNoteNativeModule | undefined : undefined;

function appendTranscript(current: string, transcript: string) {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return current;
  const cleanCurrent = current.trimEnd();
  return cleanCurrent ? `${cleanCurrent} ${cleanTranscript}` : cleanTranscript;
}

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
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [destinationAmount, setDestinationAmount] = useState('');
  const [accountSelectorTarget, setAccountSelectorTarget] = useState<'source' | 'destination' | null>(null);
  const [categories, setCategories] = useState<FinancialCategories>({ expense: [], income: [] });
  const [category, setCategory] = useState('');
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voicePreview, setVoicePreview] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const pressActiveRef = useRef(false);
  const voiceSessionActiveRef = useRef(false);

  useEffect(() => {
    if (!voiceModule) return;
    const emitter = new NativeEventEmitter(voiceModule);
    const transcriptSubscription = emitter.addListener('BrainIAVoiceTranscript', ({ text, final }: { text?: string; final?: boolean }) => {
      const cleanText = text?.trim() ?? '';
      if (!cleanText) return;
      if (final) {
        setBody((current) => appendTranscript(current, cleanText));
        setVoicePreview('');
        setVoiceState('idle');
        setVoiceError(null);
        voiceSessionActiveRef.current = false;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setVoicePreview(cleanText);
      }
    });
    const stateSubscription = emitter.addListener('BrainIAVoiceState', ({ state, message }: { state?: string; message?: string }) => {
      if (state === 'listening') {
        setVoiceState(pressActiveRef.current ? 'recording' : 'transcribing');
      } else if (state === 'transcribing') {
        setVoiceState('transcribing');
      } else if (state === 'starting') {
        setVoiceState('starting');
      } else if (state === 'idle') {
        voiceSessionActiveRef.current = false;
        setVoiceState((current) => current === 'error' ? current : 'idle');
      } else if (state === 'error') {
        voiceSessionActiveRef.current = false;
        setVoiceState('error');
        setVoicePreview('');
        setVoiceError(message || 'Voice transcription failed. Try again.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    });
    return () => {
      transcriptSubscription.remove();
      stateSubscription.remove();
      pressActiveRef.current = false;
      if (voiceSessionActiveRef.current) void voiceModule.cancel().catch(() => undefined);
      voiceSessionActiveRef.current = false;
    };
  }, []);

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
  const transferAccounts = accounts.filter((account) => account.currency === 'UYU' || account.currency === 'USD');
  const selectedAccount = (transactionType === 'transfer' ? transferAccounts : compatibleAccounts).find((account) => account.id === accountId);
  const selectedDestinationAccount = transferAccounts.find((account) => account.id === destinationAccountId);
  const selectableAccounts = (transactionType === 'transfer' ? transferAccounts : compatibleAccounts)
    .filter((account) => account.id !== (accountSelectorTarget === 'destination' ? accountId : destinationAccountId));
  const categoryOptions = transactionType === 'transfer' ? [] : categories[transactionType];
  const sourceAmountNumber = Number(amount.replace(',', '.'));
  const destinationAmountNumber = Number(destinationAmount.replace(',', '.'));
  const transferRate = transactionType === 'transfer'
    && selectedAccount?.currency
    && selectedDestinationAccount?.currency
    && selectedAccount.currency !== selectedDestinationAccount.currency
    && Number.isFinite(sourceAmountNumber)
    && sourceAmountNumber > 0
    && Number.isFinite(destinationAmountNumber)
    && destinationAmountNumber > 0
      ? destinationAmountNumber / sourceAmountNumber
      : null;

  function changeCaptureKind(nextKind: CaptureKind) {
    if (nextKind !== 'note') {
      pressActiveRef.current = false;
      if (voiceSessionActiveRef.current) void voiceModule?.cancel().catch(() => undefined);
      voiceSessionActiveRef.current = false;
      setVoiceState('idle');
      setVoicePreview('');
      setVoiceError(null);
    }
    setKind(nextKind);
    setResult(null);
    void Haptics.selectionAsync();
  }

  async function startVoiceNote() {
    if (!voiceModule || ['requesting', 'starting', 'recording', 'transcribing'].includes(voiceState)) return;
    pressActiveRef.current = true;
    setResult(null);
    setVoiceError(null);
    setVoicePreview('');
    setVoiceState('requesting');
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        pressActiveRef.current = false;
        setVoiceState('error');
        setVoiceError('Microphone permission is required to record a voice note.');
        return;
      }
      if (!pressActiveRef.current) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('starting');
      await voiceModule.start();
      voiceSessionActiveRef.current = true;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!pressActiveRef.current) {
        setVoiceState('transcribing');
        await voiceModule.stop();
      } else {
        setVoiceState('recording');
      }
    } catch (error) {
      voiceSessionActiveRef.current = false;
      setVoiceState('error');
      setVoiceError(error instanceof Error ? error.message : 'Unable to start voice recognition.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function stopVoiceNote() {
    pressActiveRef.current = false;
    if (!voiceSessionActiveRef.current) return;
    setVoiceState('transcribing');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void voiceModule?.stop().catch((error) => {
      voiceSessionActiveRef.current = false;
      setVoiceState('error');
      setVoiceError(error instanceof Error ? error.message : 'Unable to finish the recording.');
    });
  }

  const voiceBusy = ['requesting', 'starting', 'recording', 'transcribing'].includes(voiceState);
  const voiceStatus = voiceState === 'requesting'
    ? 'Requesting microphone access…'
    : voiceState === 'starting'
      ? 'Preparing microphone…'
      : voiceState === 'recording'
        ? 'Listening… release to transcribe'
        : voiceState === 'transcribing'
          ? 'Transcribing your voice note…'
          : voiceState === 'error'
            ? 'Hold to try again'
            : 'Hold to record a voice note';

  const kindCopy = useMemo(() => {
    switch (kind) {
      case 'wallet':
        return 'Record money in, money out, or a transfer between your accounts.';
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
    const parsedSourceAmount = Number(amount.replace(',', '.'));
    const parsedDestinationAmount = Number(destinationAmount.replace(',', '.'));
    if (kind === 'wallet' && (!Number.isFinite(parsedSourceAmount) || parsedSourceAmount <= 0)) {
      setResult({ ok: false, message: 'Add an amount before saving this transaction.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && !accountId) {
      setResult({ ok: false, message: 'Choose the account the transfer is coming from.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && !destinationAccountId) {
      setResult({ ok: false, message: 'Choose the account receiving the transfer.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && accountId === destinationAccountId) {
      setResult({ ok: false, message: 'A transfer must use two different accounts.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && (!Number.isFinite(parsedDestinationAmount) || parsedDestinationAmount <= 0)) {
      setResult({ ok: false, message: 'Add the amount received by the destination account.' });
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
              title: title.trim() || merchant.trim() || (transactionType === 'income' ? 'Income' : transactionType === 'transfer' ? 'Transfer between accounts' : 'Expense'),
              body: body.trim() || undefined,
              amount: amount.trim() || undefined,
              currency,
              merchantLabel: transactionType === 'transfer' ? undefined : merchant.trim() || undefined,
              note: body.trim() || title.trim() || undefined,
              transactionType,
              accountId: accountId || undefined,
              destinationAccountId: transactionType === 'transfer' ? destinationAccountId || undefined : undefined,
              destinationAmount: transactionType === 'transfer' ? destinationAmount.trim() || undefined : undefined,
              destinationCurrency: transactionType === 'transfer' ? selectedDestinationAccount?.currency : undefined,
              category: transactionType === 'transfer' ? undefined : category || undefined,
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
      setDestinationAccountId(null);
      setDestinationAmount('');
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

      <Section title="Event type" subtitle="Money opens a focused form for expenses, income, and account transfers.">
        <SegmentedControl
          value={kind}
          onChange={changeCaptureKind}
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
                name={transactionType === 'income' ? 'arrow-down-left' : transactionType === 'transfer' ? 'repeat' : 'arrow-up-right'}
                size={21}
                color={transactionType === 'income' ? theme.status.income : transactionType === 'transfer' ? theme.colors.accentStrong : theme.status.expense}
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
              setDestinationAccountId(null);
              setDestinationAmount('');
              setAccountSelectorTarget(null);
              setResult(null);
              void Haptics.selectionAsync();
            }}
            options={[
              { value: 'expense', label: 'Expense', icon: <Feather name="arrow-up-right" size={16} color={transactionType === 'expense' ? theme.colors.onAccent : theme.status.expense} /> },
              { value: 'income', label: 'Income', icon: <Feather name="arrow-down-left" size={16} color={transactionType === 'income' ? theme.colors.onAccent : theme.status.income} /> },
              { value: 'transfer', label: 'Transfer', icon: <Feather name="repeat" size={16} color={transactionType === 'transfer' ? theme.colors.onAccent : theme.colors.accentStrong} /> },
            ]}
          />

          <Input
            label={transactionType === 'transfer' ? `From amount${selectedAccount?.currency ? ` (${selectedAccount.currency})` : ''}` : 'Amount'}
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              if (transactionType === 'transfer' && selectedAccount?.currency === selectedDestinationAccount?.currency) {
                setDestinationAmount(value);
              }
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            accessibilityLabel={`${transactionType === 'income' ? 'Income' : transactionType === 'transfer' ? 'Source transfer' : 'Expense'} amount`}
            style={[theme.typography.numeral, { minHeight: 64, fontSize: 28 }]}
          />
          <ListRow
            title={selectedAccount?.name ?? `Select a ${currency} account`}
            subtitle={transactionType === 'income' ? 'To account' : 'From account'}
            description={selectedAccount ? `${selectedAccount.type} · ${selectedAccount.currency}` : 'Choose an existing account from your portfolio.'}
            leading={<AccountIcon color={selectedAccount?.color} />}
            trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
            onPress={() => setAccountSelectorTarget('source')}
          />
          {transactionType === 'transfer' ? (
            <ListRow
              title={selectedDestinationAccount?.name ?? 'Select a destination account'}
              subtitle="To account"
              description={selectedDestinationAccount ? `${selectedDestinationAccount.type} · ${selectedDestinationAccount.currency}` : 'UYU and USD accounts are available.'}
              leading={<AccountIcon color={selectedDestinationAccount?.color} />}
              trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
              onPress={() => setAccountSelectorTarget('destination')}
            />
          ) : (
            <>
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
            </>
          )}
          {transactionType === 'transfer' ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Input
                label={`To amount${selectedDestinationAccount?.currency ? ` (${selectedDestinationAccount.currency})` : ''}`}
                value={destinationAmount}
                onChangeText={setDestinationAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                accessibilityLabel="Destination transfer amount"
                style={[theme.typography.numeral, { minHeight: 64, fontSize: 28 }]}
              />
              {transferRate && selectedAccount?.currency && selectedDestinationAccount?.currency ? (
                <View style={{ alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSubtle, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>1 {selectedAccount.currency} = {transferRate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedDestinationAccount.currency}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Input label="Description" value={title} onChangeText={setTitle} placeholder="What was this for?" />
          <Input label="Note" value={body} onChangeText={setBody} placeholder="Optional details" multiline />

          {transactionType !== 'transfer' ? <DisclosureSection title="More details" subtitle="Add a currency only when it helps.">
            <SegmentedControl
              value={currency}
              onChange={(nextCurrency) => {
                setCurrency(nextCurrency);
                setAccountId(null);
                setDestinationAccountId(null);
                void Haptics.selectionAsync();
              }}
              options={[
                { value: 'UYU', label: 'UYU' },
                { value: 'USD', label: 'USD' },
              ]}
            />
          </DisclosureSection> : null}

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
            {kind === 'note' ? (
              <View style={{ borderRadius: theme.radius.lg, borderWidth: 1, borderColor: voiceState === 'recording' ? theme.colors.danger + '88' : voiceState === 'error' ? theme.colors.danger + '66' : theme.colors.border, backgroundColor: voiceState === 'recording' ? theme.colors.danger + '12' : theme.colors.surfaceSubtle, overflow: 'hidden' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={voiceStatus}
                  disabled={voiceState === 'transcribing'}
                  onPressIn={() => { void startVoiceNote(); }}
                  onPressOut={stopVoiceNote}
                  style={{ minHeight: 74, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: voiceState === 'recording' ? theme.colors.danger + '22' : theme.colors.accentSoft }}>
                    {voiceState === 'transcribing' || voiceState === 'requesting' || voiceState === 'starting'
                      ? <ActivityIndicator size="small" color={theme.colors.accentStrong} />
                      : <Feather name="mic" size={22} color={voiceState === 'recording' ? theme.colors.danger : theme.colors.accentStrong} />}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[theme.typography.bodyStrong, { color: voiceState === 'error' ? theme.colors.danger : theme.colors.textPrimary }]}>{voiceStatus}</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                      {voiceState === 'transcribing' ? 'The transcript will appear in the text field when ready.' : 'Keep holding while you speak.'}
                    </Text>
                  </View>
                </Pressable>
                {voicePreview ? <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }]}>{voicePreview}</Text> : null}
                {voiceError ? <Text style={[theme.typography.caption, { color: theme.colors.danger, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }]}>{voiceError}</Text> : null}
              </View>
            ) : null}
            <Button label={voiceState === 'transcribing' ? 'Waiting for transcript…' : busy ? 'Capturing...' : 'Capture'} onPress={submit} loading={busy} disabled={voiceBusy} />
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
        visible={accountSelectorTarget !== null}
        title={accountSelectorTarget === 'destination' ? 'Select destination account' : transactionType === 'income' ? 'Select to account' : 'Select from account'}
        onClose={() => setAccountSelectorTarget(null)}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{transactionType === 'transfer' ? 'Choose any UYU or USD account. Source and destination currencies may differ.' : `Only accounts using ${currency} are available.`}</Text>
        {selectableAccounts.length ? selectableAccounts.map((account) => {
          const selectedId = accountSelectorTarget === 'destination' ? destinationAccountId : accountId;
          return (
          <ListRow
            key={account.id}
            title={account.name}
            subtitle={`${account.type} · ${account.currency}`}
            leading={<AccountIcon color={account.color} />}
            trailing={<Text style={[theme.typography.caption, { color: account.id === selectedId ? theme.colors.success : theme.colors.textMuted }]}>{account.id === selectedId ? 'Selected' : 'Use'}</Text>}
            onPress={() => {
              if (accountSelectorTarget === 'destination') {
                setDestinationAccountId(account.id);
                if (account.currency === selectedAccount?.currency) setDestinationAmount(amount);
                else setDestinationAmount('');
              } else {
                setAccountId(account.id);
                if (account.currency === 'UYU' || account.currency === 'USD') setCurrency(account.currency);
                if (account.currency === selectedDestinationAccount?.currency) setDestinationAmount(amount);
                else if (selectedDestinationAccount) setDestinationAmount('');
                if (destinationAccountId === account.id) setDestinationAccountId(null);
              }
              setAccountSelectorTarget(null);
              void Haptics.selectionAsync();
            }}
          />
          );
        }) : <EmptyState title={transactionType === 'transfer' ? 'No other accounts' : `No other ${currency} accounts`} description="Create another account in Money, then return here to complete the transfer." />}
        {(accountSelectorTarget === 'destination' ? destinationAccountId : accountId) ? <Button label="Clear selection" variant="secondary" onPress={() => {
          if (accountSelectorTarget === 'destination') setDestinationAccountId(null);
          else setAccountId(null);
          if (accountSelectorTarget === 'destination') setDestinationAmount('');
          setAccountSelectorTarget(null);
        }} /> : null}
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
