import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';

import { Button, Chip, Field, SegmentedControl } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Section } from '@/components/layout/Screen';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import type { FinancialAccount, FinancialCategories } from '@/lib/domain';
import { recordInteraction } from '@/lib/interaction-telemetry';

type CaptureKind = 'note' | 'wallet';
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

export type CaptureFormStatus = { busy: boolean; label: string };
export type CaptureFormHandle = { submit: () => void };

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

const voiceModule = Platform.OS === 'android' ? NativeModules.BrainIAVoiceNote as VoiceNoteNativeModule | undefined : undefined;

function appendTranscript(current: string, transcript: string) {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return current;
  const cleanCurrent = current.trimEnd();
  return cleanCurrent ? `${cleanCurrent} ${cleanTranscript}` : cleanTranscript;
}

function VoiceRecordButton({ state, label, onPressIn, onPressOut }: { state: VoiceState; label: string; onPressIn: () => void; onPressOut: () => void }) {
  const theme = useTheme();
  const pulse = useSharedValue(0);
  const recording = state === 'recording';
  const processing = state === 'requesting' || state === 'starting' || state === 'transcribing';
  const disabled = !voiceModule || state === 'transcribing';

  useEffect(() => {
    if (recording) pulse.value = withRepeat(withSequence(withTiming(1, { duration: theme.motion.duration.count }), withTiming(0, { duration: theme.motion.duration.count })), -1);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: theme.motion.duration.press });
    }
    return () => cancelAnimation(pulse);
  }, [pulse, recording, theme.motion.duration.count, theme.motion.duration.press]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.28 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.42 }],
  }));

  return (
    <GlassPressable
      accessibilityRole="button"
      accessibilityLabel={voiceModule ? label : 'La captura de voz está disponible en Android'}
      accessibilityHint={voiceModule ? 'Mantén presionado mientras hablas y suelta para transcribir.' : undefined}
      accessibilityState={{ disabled, busy: processing || recording }}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      scaleTo={0.92}
      style={{ width: 52, height: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'visible', backgroundColor: recording ? `${theme.colors.danger}1F` : theme.glass.inner, borderWidth: 1, borderColor: recording ? `${theme.colors.danger}99` : theme.glass.divider }}
    >
      {recording ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: theme.colors.danger }, pulseStyle]} /> : null}
      {processing ? <ActivityIndicator size="small" color={theme.colors.accentStrong} /> : <Feather name="mic" size={21} color={recording || state === 'error' ? theme.colors.danger : theme.colors.accentStrong} />}
    </GlassPressable>
  );
}

export const CaptureForm = forwardRef<CaptureFormHandle, {
  initialMode?: CaptureKind;
  onStatusChange?: (status: CaptureFormStatus) => void;
  onSaved?: () => void;
}>(function CaptureForm({ initialMode = 'note', onStatusChange, onSaved }, ref) {
  const theme = useTheme();
  const client = useBrainIAClient();
  const { invalidateFinancialData } = useAppState();
  const [kind, setKind] = useState<CaptureKind>(initialMode);
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
  const [isPending, setIsPending] = useState(false);
  const [estimatedExecutionDate, setEstimatedExecutionDate] = useState(localDateInputValue());
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
      if (state === 'listening') setVoiceState(pressActiveRef.current ? 'recording' : 'transcribing');
      else if (state === 'transcribing') setVoiceState('transcribing');
      else if (state === 'starting') setVoiceState('starting');
      else if (state === 'idle') {
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
  const voiceBusy = ['requesting', 'starting', 'recording', 'transcribing'].includes(voiceState);
  const saveLabel = busy ? 'Guardando...' : kind === 'note' ? 'Capturar nota' : isPending ? 'Guardar pendiente' : `Guardar ${transactionType === 'expense' ? 'gasto' : transactionType === 'income' ? 'ingreso' : 'transferencia'}`;

  useEffect(() => {
    onStatusChange?.({ busy, label: saveLabel });
  }, [busy, onStatusChange, saveLabel]);

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
    if (kind === 'wallet' && isPending && !isCalendarDate(estimatedExecutionDate)) {
      setResult({ ok: false, message: 'Usa el formato AAAA-MM-DD para la fecha estimada.' });
      return;
    }
    if (kind === 'note' && !body.trim()) {
      setResult({ ok: false, message: 'Escribí una nota antes de capturar.' });
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const payload = kind === 'wallet'
        ? {
            title: title.trim() || merchant.trim() || (transactionType === 'income' ? 'Ingreso' : transactionType === 'transfer' ? 'Transferencia entre cuentas' : 'Gasto'),
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
        : { title: body.trim().slice(0, 64), body: body.trim(), source: 'mobile', tags: ['mobile', kind] };

      if (kind === 'wallet' && isPending) {
        await client.createPendingTransaction({
          title: title.trim() || merchant.trim() || (transactionType === 'income' ? 'Ingreso pendiente' : 'Gasto pendiente'),
          kind: transactionType as 'expense' | 'income',
          amount: parsedSourceAmount,
          currency,
          category: category || null,
          accountId: accountId || null,
          estimatedExecutionDate,
        });
        invalidateFinancialData();
      } else {
        await client.capture(kind, payload);
      }
      recordInteraction('capture', 'capture', 'success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, message: isPending ? 'Pendiente guardado. No afectará tu balance hasta ejecutarlo.' : 'Guardado en BrainIA.' });
      setBody('');
      setTitle('');
      setAmount('');
      setCurrency('UYU');
      setMerchant('');
      setAccountId(null);
      setDestinationAccountId(null);
      setDestinationAmount('');
      setCategory('');
      setIsPending(false);
      setEstimatedExecutionDate(localDateInputValue());
      onSaved?.();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ ok: false, message: error instanceof Error ? error.message : 'No se pudo guardar ahora. Revisá tu conexión e intentá de nuevo.' });
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({ submit: () => { void submit(); } }));

  return (
    <>
      <SegmentedControl
        items={[{ value: 'note', label: 'Nota', icon: 'edit-3' }, { value: 'wallet', label: 'Dinero', icon: 'dollar-sign' }]}
        value={kind}
        onChange={changeCaptureKind}
        accessibilityLabel="Capture type"
      />

      {kind === 'wallet' ? (
        <Animated.View key="money" entering={FadeInDown.duration(theme.motion.duration.quick)} style={{ gap: theme.spacing.md }}>
          <SegmentedControl
            items={[
              { value: 'expense', label: 'Gasto', icon: 'arrow-up-right' },
              { value: 'income', label: 'Ingreso', icon: 'arrow-down-left' },
              { value: 'transfer', label: 'Transferir', icon: 'repeat' },
            ]}
            value={transactionType}
            onChange={(nextType) => {
              setTransactionType(nextType);
              setCategory('');
              setDestinationAccountId(null);
              setDestinationAmount('');
              setAccountSelectorTarget(null);
              if (nextType === 'transfer') setIsPending(false);
              setResult(null);
              void Haptics.selectionAsync();
            }}
          />

          {transactionType !== 'transfer' ? (
            <SegmentedControl
              size="mini"
              items={[{ value: 'posted', label: 'Movimiento' }, { value: 'pending', label: 'Pendiente' }]}
              value={isPending ? 'pending' : 'posted'}
              onChange={(value) => setIsPending(value === 'pending')}
            />
          ) : null}

          <Field
            variant="amount"
            label={transactionType === 'transfer' ? `Monto de origen${selectedAccount?.currency ? ` (${selectedAccount.currency})` : ''}` : 'Monto'}
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              if (transactionType === 'transfer' && selectedAccount?.currency === selectedDestinationAccount?.currency) setDestinationAmount(value);
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            accessibilityLabel={transactionType === 'income' ? 'Monto del ingreso' : transactionType === 'transfer' ? 'Monto de origen de la transferencia' : 'Monto del gasto'}
          />

          {isPending ? (
            <Field label="Fecha estimada de ejecución" value={estimatedExecutionDate} onChangeText={setEstimatedExecutionDate} placeholder="AAAA-MM-DD" autoCapitalize="none" />
          ) : null}

          <Row
            title={selectedAccount?.name ?? `Elegir cuenta en ${currency}`}
            subtitle={transactionType === 'income' ? 'Cuenta destino' : 'Cuenta de origen'}
            description={selectedAccount ? `${selectedAccount.type} · ${selectedAccount.currency}` : 'Opcional para ingresos y gastos; requerida para transferencias.'}
            leading={<IconTile icon="credit-card" color={selectedAccount?.color} />}
            onPress={() => setAccountSelectorTarget('source')}
          />

          {transactionType === 'transfer' ? (
            <>
              <Row
                title={selectedDestinationAccount?.name ?? 'Elegir cuenta destino'}
                subtitle="Cuenta destino"
                description={selectedDestinationAccount ? `${selectedDestinationAccount.type} · ${selectedDestinationAccount.currency}` : 'Hay cuentas UYU y USD disponibles.'}
                leading={<IconTile icon="credit-card" color={selectedDestinationAccount?.color} />}
                onPress={() => setAccountSelectorTarget('destination')}
              />
              <Field
                variant="amount"
                label={`Monto de destino${selectedDestinationAccount?.currency ? ` (${selectedDestinationAccount.currency})` : ''}`}
                value={destinationAmount}
                onChangeText={setDestinationAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                accessibilityLabel="Monto de destino de la transferencia"
              />
              {transferRate && selectedAccount?.currency && selectedDestinationAccount?.currency ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>1 {selectedAccount.currency} = {transferRate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedDestinationAccount.currency}</Text>
              ) : null}
            </>
          ) : (
            <Section title="Add context" subtitle="Category, merchant and notes are optional." collapsible defaultOpen={false}>
              <Row
                title={category || `Elegir categoría de ${transactionType === 'income' ? 'ingreso' : 'gasto'}`}
                subtitle="Categoría"
                description="Podés crear una nueva sin salir de este movimiento."
                leading={<IconTile icon="tag" color={theme.colors.accent} />}
                onPress={() => setCategorySelectorOpen(true)}
              />
              <Field label={transactionType === 'income' ? 'De quién viene' : 'Comercio o destinatario'} value={merchant} onChangeText={setMerchant} placeholder={transactionType === 'income' ? 'Sueldo, cliente, reembolso' : 'Supermercado, alquiler, farmacia'} />
              <Field label="Descripción" value={title} onChangeText={setTitle} placeholder="¿Para qué fue?" returnKeyType="next" />
              <Field label="Nota" value={body} onChangeText={setBody} placeholder="Detalles opcionales" multiline />
              <SegmentedControl items={[{ value: 'UYU', label: 'UYU' }, { value: 'USD', label: 'USD' }]} value={currency} onChange={(nextCurrency) => { setCurrency(nextCurrency); setAccountId(null); setDestinationAccountId(null); void Haptics.selectionAsync(); }} />
            </Section>
          )}
        </Animated.View>
      ) : (
        <Animated.View key="note" entering={FadeInDown.duration(theme.motion.duration.quick)} style={{ gap: theme.spacing.md }}>
          <GlassSurface level="regular" tone="finance" padding="lg" contentStyle={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon="edit-3" size="lg" color={theme.status.income} tint={`${theme.status.income}1F`} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.overline, { color: theme.status.income }]}>Nota rápida</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Captura una idea</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Guardá una idea, recordatorio o detalle útil antes de que se pierda.</Text>
              </View>
            </View>
            <Field value={body} onChangeText={setBody} placeholder="¿Qué quieres recordar?" multiline accessibilityLabel="Texto para capturar" style={{ minHeight: 168, textAlignVertical: 'top' }} />
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={[theme.typography.caption, { color: voiceBusy ? theme.colors.warning : theme.colors.textMuted }]}>{voiceBusy ? 'Procesando voz…' : 'Usá Guardar abajo, o dictá la nota con el micrófono.'}</Text>
              </View>
              <VoiceRecordButton state={voiceState} label={voiceStatus} onPressIn={() => { void startVoiceNote(); }} onPressOut={stopVoiceNote} />
            </View>
            {voiceState !== 'idle' || voicePreview || voiceError ? (
              <Animated.View entering={FadeInUp.duration(theme.motion.duration.quick)} exiting={FadeOut.duration(theme.motion.duration.press)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 5, backgroundColor: voiceState === 'error' || voiceState === 'recording' ? theme.colors.danger : theme.status.income }} />
                <Text numberOfLines={2} accessibilityLiveRegion="polite" style={[theme.typography.caption, { flex: 1, color: voiceState === 'error' ? theme.colors.danger : theme.colors.textSecondary }]}>{voiceError || voicePreview || voiceStatus}</Text>
              </Animated.View>
            ) : null}
          </GlassSurface>
        </Animated.View>
      )}

      {result?.ok ? <StateView kind="success" title="Guardado en BrainIA" description={result.message} actionLabel="Capturar otra" onAction={() => setResult(null)} /> : result ? <StateView kind="error" title="No se pudo capturar" description={result.message} actionLabel="Reintentar" onAction={() => setResult(null)} /> : null}

      <BottomSheet visible={accountSelectorTarget !== null} title={accountSelectorTarget === 'destination' ? 'Select destination account' : transactionType === 'income' ? 'Select to account' : 'Select from account'} onClose={() => setAccountSelectorTarget(null)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{transactionType === 'transfer' ? 'Elige cualquier cuenta en UYU o USD. Las monedas de origen y destino pueden ser distintas.' : `Solo se muestran cuentas en ${currency}.`}</Text>
        {selectableAccounts.length ? selectableAccounts.map((account) => {
          const selectedId = accountSelectorTarget === 'destination' ? destinationAccountId : accountId;
          return (
            <Row
              key={account.id}
              title={account.name}
              subtitle={`${account.type} · ${account.currency}`}
              leading={<IconTile icon="credit-card" color={account.color} />}
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
        }) : <StateView title={transactionType === 'transfer' ? 'No hay otras cuentas' : `No hay otras cuentas en ${currency}`} description="Crea otra cuenta en Dinero y vuelve para completar la transferencia." />}
        {(accountSelectorTarget === 'destination' ? destinationAccountId : accountId) ? (
          <Button label="Quitar selección" variant="secondary" onPress={() => {
            if (accountSelectorTarget === 'destination') { setDestinationAccountId(null); setDestinationAmount(''); }
            else setAccountId(null);
            setAccountSelectorTarget(null);
          }} />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={categorySelectorOpen} title={`Categoría de ${transactionType === 'income' ? 'ingreso' : 'gasto'}`} onClose={() => setCategorySelectorOpen(false)}>
        <Chip label="Sin categoría" selected={!category} onPress={() => { setCategory(''); setCategorySelectorOpen(false); }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from(new Set(categoryOptions)).map((option) => (
            <Chip key={option} label={option} selected={category === option} onPress={() => { setCategory(option); setCategorySelectorOpen(false); void Haptics.selectionAsync(); }} />
          ))}
        </View>
        <Field label="Nueva categoría" placeholder="Comida / Viandas" onSubmitEditing={(event) => {
          const value = event.nativeEvent.text.trim();
          if (!value) return;
          const categoryKind = transactionType === 'income' ? 'income' : 'expense';
          setCategory(value);
          setCategories((current) => ({ ...current, [categoryKind]: Array.from(new Set([...current[categoryKind], value])) }));
          setCategorySelectorOpen(false);
          void client.createFinancialCategory({ kind: categoryKind, name: value }).catch(() => {
            setResult({ ok: false, message: 'La categoría quedó seleccionada para este movimiento, pero no se pudo guardar para próximos usos.' });
          });
        }} returnKeyType="done" />
      </BottomSheet>
    </>
  );
});
