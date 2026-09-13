import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CaptureSuccess } from '@/components/forms';
import { AccountIcon } from '@/components/finance/AccountIcon';
import { CategoryPicker } from '@/components/review';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { AnimatedPressable, BottomSheet, Button, CommandPanel, DisclosureSection, Input, ListRow, Panel, SegmentedControl, StatusBadge } from '@/components/primitives';
import { EmptyState } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import type { FinancialAccount, FinancialCategories } from '@/lib/domain';

const captureKinds = [
  { value: 'note', label: 'Note', icon: 'edit-3' },
  { value: 'wallet', label: 'Money', icon: 'dollar-sign' },
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

function VoiceRecordButton({
  state,
  label,
  onPressIn,
  onPressOut,
}: {
  state: VoiceState;
  label: string;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const theme = useTheme();
  const pulse = useSharedValue(0);
  const recording = state === 'recording';
  const processing = state === 'requesting' || state === 'starting' || state === 'transcribing';
  const disabled = !voiceModule || state === 'transcribing';

  useEffect(() => {
    if (recording) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 720 }), withTiming(0, { duration: 720 })),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: theme.motion.fast });
    }
    return () => cancelAnimation(pulse);
  }, [pulse, recording, theme.motion.fast]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.28 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.42 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={voiceModule ? label : 'Voice capture is available on Android'}
      accessibilityHint={voiceModule ? 'Press and hold while speaking, then release to transcribe.' : undefined}
      accessibilityState={{ disabled, busy: processing || recording }}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      scaleTo={0.92}
      style={{
        width: 52,
        height: 48,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        backgroundColor: recording ? `${theme.colors.danger}18` : theme.colors.accentSoft,
        borderWidth: 1,
        borderColor: recording ? `${theme.colors.danger}99` : state === 'error' ? `${theme.colors.danger}66` : `${theme.colors.accentStrong}55`,
      }}
    >
      {recording ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: 46,
              height: 46,
              borderRadius: 23,
              borderWidth: 1,
              borderColor: theme.colors.danger,
            },
            pulseStyle,
          ]}
        />
      ) : null}
      {processing ? (
        <ActivityIndicator size="small" color={theme.colors.accentStrong} />
      ) : (
        <Feather name="mic" size={21} color={recording || state === 'error' ? theme.colors.danger : theme.colors.accentStrong} />
      )}
    </AnimatedPressable>
  );
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
    return kind === 'wallet'
      ? 'Registrá un ingreso, gasto o transferencia sin completar campos que no necesitás.'
      : 'Guardá una idea, recordatorio o detalle útil antes de que se pierda.';
  }, [kind]);

  async function submit() {
    const parsedSourceAmount = Number(amount.replace(',', '.'));
    const parsedDestinationAmount = Number(destinationAmount.replace(',', '.'));
    if (kind === 'wallet' && (!Number.isFinite(parsedSourceAmount) || parsedSourceAmount <= 0)) {
      setResult({ ok: false, message: 'Ingresá un monto antes de guardar el movimiento.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && !accountId) {
      setResult({ ok: false, message: 'Elegí la cuenta desde la que sale la transferencia.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && !destinationAccountId) {
      setResult({ ok: false, message: 'Elegí la cuenta que recibe la transferencia.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && accountId === destinationAccountId) {
      setResult({ ok: false, message: 'Una transferencia debe usar dos cuentas distintas.' });
      return;
    }

    if (kind === 'wallet' && transactionType === 'transfer' && (!Number.isFinite(parsedDestinationAmount) || parsedDestinationAmount <= 0)) {
      setResult({ ok: false, message: 'Ingresá el monto que recibe la cuenta de destino.' });
      return;
    }

    if (kind === 'note' && !body.trim()) {
      setResult({ ok: false, message: 'Escribí una nota antes de capturar.' });
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
              source: 'mobile',
              tags: ['mobile', 'finance', transactionType],
            }
          : {
              title: body.trim().slice(0, 64),
              body: body.trim(),
              source: 'mobile',
              tags: ['mobile', kind],
            };

      await client.capture(kind, payload);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, message: 'Guardado en BrainIA.' });
      setBody('');
      setTitle('');
      setAmount('');
      setCurrency('UYU');
      setMerchant('');
      setAccountId(null);
      setDestinationAccountId(null);
      setDestinationAmount('');
      setCategory('');
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ ok: false, message: error instanceof Error ? error.message : 'No se pudo guardar ahora. Revisá tu conexión e intentá de nuevo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen
      stickyFooter={kind === 'wallet' ? (
        <Button label={busy ? 'Guardando...' : `Guardar ${transactionType === 'expense' ? 'gasto' : transactionType === 'income' ? 'ingreso' : 'transferencia'}`} onPress={submit} loading={busy} size="lg" />
      ) : undefined}
    >
      <TopBar
        title="Capturar"
        subtitle="Convertí una idea o movimiento en información útil."
        secondaryAction={<StatusBadge label={busy ? 'Guardando' : 'Listo'} tone={busy ? 'warning' : 'positive'} />}
      />

      <Section title="¿Qué querés capturar?" subtitle="Elegí una nota rápida o un movimiento de dinero.">
        <SegmentedControl
          value={kind}
          onChange={changeCaptureKind}
          options={captureKinds.map((item) => ({
            value: item.value,
              label: item.value === 'note' ? 'Nota' : 'Dinero',
            icon: <Feather name={item.icon as never} size={15} color={kind === item.value ? theme.colors.textPrimary : theme.colors.textSecondary} />,
          }))}
        />
      </Section>

      {kind === 'wallet' ? (
        <Animated.View key="money-capture" entering={FadeInDown.duration(260)}>
        <CommandPanel style={{ borderColor: `${theme.status.income}38` }}>
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
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Nuevo movimiento</Text>
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
              { value: 'expense', label: 'Gasto', icon: <Feather name="arrow-up-right" size={16} color={transactionType === 'expense' ? theme.colors.onAccent : theme.status.expense} /> },
              { value: 'income', label: 'Ingreso', icon: <Feather name="arrow-down-left" size={16} color={transactionType === 'income' ? theme.colors.onAccent : theme.status.income} /> },
              { value: 'transfer', label: 'Transferir', icon: <Feather name="repeat" size={16} color={transactionType === 'transfer' ? theme.colors.onAccent : theme.colors.accentStrong} /> },
            ]}
          />

          <Input
            label={transactionType === 'transfer' ? `Monto de origen${selectedAccount?.currency ? ` (${selectedAccount.currency})` : ''}` : 'Monto'}
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
            title={selectedAccount?.name ?? `Elegir cuenta en ${currency}`}
            subtitle={transactionType === 'income' ? 'Cuenta destino' : 'Cuenta de origen'}
            description={selectedAccount ? `${selectedAccount.type} · ${selectedAccount.currency}` : 'Opcional para ingresos y gastos; requerida para transferencias.'}
            leading={<AccountIcon color={selectedAccount?.color} />}
            trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
            onPress={() => setAccountSelectorTarget('source')}
          />
          {transactionType === 'transfer' ? (
            <ListRow
              title={selectedDestinationAccount?.name ?? 'Elegir cuenta destino'}
              subtitle="Cuenta destino"
              description={selectedDestinationAccount ? `${selectedDestinationAccount.type} · ${selectedDestinationAccount.currency}` : 'Hay cuentas UYU y USD disponibles.'}
              leading={<AccountIcon color={selectedDestinationAccount?.color} />}
              trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
              onPress={() => setAccountSelectorTarget('destination')}
            />
          ) : (
            <DisclosureSection title="Agregar contexto" subtitle="Categoría, comercio y notas son opcionales.">
              <ListRow
                title={category || `Elegir categoría de ${transactionType === 'income' ? 'ingreso' : 'gasto'}`}
                subtitle="Categoría"
                description="Podés crear una nueva sin salir de este movimiento."
                leading={<Feather name="tag" size={20} color={theme.colors.accentStrong} />}
                trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />}
                onPress={() => setCategorySelectorOpen(true)}
              />
              <Input
                label={transactionType === 'income' ? 'De quién viene' : 'Comercio o destinatario'}
                value={merchant}
                onChangeText={setMerchant}
                placeholder={transactionType === 'income' ? 'Sueldo, cliente, reembolso' : 'Supermercado, alquiler, farmacia'}
              />
              <Input label="Descripción" value={title} onChangeText={setTitle} placeholder="¿Para qué fue?" returnKeyType="next" />
              <Input label="Nota" value={body} onChangeText={setBody} placeholder="Detalles opcionales" multiline />
              <SegmentedControl
                value={currency}
                onChange={(nextCurrency) => {
                  setCurrency(nextCurrency);
                  setAccountId(null);
                  setDestinationAccountId(null);
                  void Haptics.selectionAsync();
                }}
                options={[{ value: 'UYU', label: 'UYU' }, { value: 'USD', label: 'USD' }]}
              />
            </DisclosureSection>
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
        </CommandPanel>
        </Animated.View>
      ) : (
        <Animated.View key="note-capture" entering={FadeInDown.duration(260)}>
          <Panel tone="finance" padding="lg" style={{ gap: theme.spacing.lg, overflow: 'hidden' }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 132,
                height: 132,
                borderRadius: 66,
                right: -62,
                top: -70,
                backgroundColor: `${theme.status.income}0C`,
                borderWidth: 1,
                borderColor: `${theme.status.income}16`,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${theme.status.income}16`,
                  borderWidth: 1,
                  borderColor: `${theme.status.income}30`,
                }}
              >
                <Feather name="edit-3" size={20} color={theme.status.income} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.overline, { color: theme.status.income }]}>Quick note</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Capture a thought</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{kindCopy}</Text>
              </View>
            </View>
            <Input
              value={body}
              onChangeText={setBody}
              placeholder="What do you want to remember?"
              multiline
              accessibilityLabel="Quick capture text"
              style={{ minHeight: 168, textAlignVertical: 'top' }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label={voiceState === 'transcribing' ? 'Transcribing...' : busy ? 'Capturing...' : 'Capture note'} onPress={submit} loading={busy} disabled={voiceBusy} size="lg" />
              </View>
              <VoiceRecordButton state={voiceState} label={voiceStatus} onPressIn={() => { void startVoiceNote(); }} onPressOut={stopVoiceNote} />
            </View>
            {voiceState !== 'idle' || voicePreview || voiceError ? (
              <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOut.duration(140)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 5, backgroundColor: voiceState === 'error' || voiceState === 'recording' ? theme.colors.danger : theme.status.income }} />
                <Text numberOfLines={2} accessibilityLiveRegion="polite" style={[theme.typography.caption, { flex: 1, color: voiceState === 'error' ? theme.colors.danger : theme.colors.textSecondary }]}>
                  {voiceError || voicePreview || voiceStatus}
                </Text>
              </Animated.View>
            ) : null}
          </Panel>
        </Animated.View>
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

      <BottomSheet visible={categorySelectorOpen} title={`Categoría de ${transactionType === 'income' ? 'ingreso' : 'gasto'}`} onClose={() => setCategorySelectorOpen(false)}>
        <CategoryPicker
          categories={categoryOptions}
          selectedCategory={category}
          onSelect={(value) => {
            setCategory(value);
            setCategorySelectorOpen(false);
            void Haptics.selectionAsync();
          }}
          onCreate={(value) => {
            const categoryKind = transactionType === 'income' ? 'income' : 'expense';
            setCategory(value);
            setCategories((current) => ({
              ...current,
              [categoryKind]: Array.from(new Set([...current[categoryKind], value])),
            }));
            setCategorySelectorOpen(false);
            void Haptics.selectionAsync();
            void client.createFinancialCategory({ kind: categoryKind, name: value }).catch(() => {
              setResult({ ok: false, message: 'La categoría quedó seleccionada para este movimiento, pero no se pudo guardar para próximos usos.' });
            });
          }}
        />
      </BottomSheet>
    </AppScreen>
  );
}
