import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AskComposer } from '@/components/ask/AskComposer';
import { AskEmpty } from '@/components/ask/AskEmpty';
import { AssistantMessage, UserBubble } from '@/components/ask/AskMessage';
import { Button, SegmentedControl, Tag } from '@/components/controls';
import { MapExplorer } from '@/components/explore/MapExplorer';
import { Screen } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import type { AskSource } from '@/lib/ask';
import { useAskChat } from '@/lib/use-ask-chat';
import { isVoiceAvailable } from '@/lib/use-voice-input';

type Mode = 'ask' | 'map';

const modes = [
  { value: 'ask' as const, label: 'Preguntar', icon: 'message-circle' as const },
  { value: 'map' as const, label: 'Mapa', icon: 'share-2' as const },
];

type MapHeader = { overline: string; refreshing: boolean; refresh: () => void; status: { label: string; tone: 'warning' | 'neutral'; live: boolean } };

/**
 * Explorar is AI-first: a grounded chat over the user's own data, with the
 * knowledge map one segment away. Answers stream from POST /api/v1/ask; money
 * figures come from server-side SQL and every claim cites its sources.
 */
export default function ExploreScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [mode, setMode] = useState<Mode>('ask');
  const [mapVisited, setMapVisited] = useState(false);
  const [mapHeader, setMapHeader] = useState<MapHeader | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [voiceAvailable] = useState(isVoiceAvailable);
  const chat = useAskChat(client);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScroll = useRef(0);

  // Follow the conversation: jump to a new question, then keep the streaming answer in view.
  const last = chat.messages.at(-1);
  const followKey = `${chat.messages.length}:${last?.role === 'assistant' ? `${last.status}:${last.cards.length}:${Math.floor(last.text.length / 80)}` : ''}`;
  useEffect(() => {
    if (mode !== 'ask' || !chat.messages.length) return;
    const now = Date.now();
    const delay = now - lastScroll.current < 250 ? 250 : 60;
    const timer = setTimeout(() => {
      lastScroll.current = Date.now();
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [chat.messages.length, followKey, mode]);

  const changeMode = (value: Mode) => {
    setMode(value);
    if (value === 'map') setMapVisited(true);
  };

  const onHeaderChange = useCallback((header: MapHeader) => setMapHeader(header), []);

  const onCitation = useCallback((source: AskSource) => {
    setHighlighted(source.id);
    if (source.route) router.push(source.route as never);
  }, []);

  const send = useCallback((text: string, via: 'text' | 'voice' = 'text') => {
    setHighlighted(null);
    void chat.send(text, via);
  }, [chat]);

  const askActions = chat.messages.length ? (
    <Button
      iconOnly
      variant="ghost"
      size="sm"
      accessibilityLabel="Nueva conversación"
      icon={<Feather name="edit" size={17} color={theme.colors.textPrimary} />}
      onPress={() => { chat.reset(); setFocusKey((key) => key + 1); }}
    />
  ) : undefined;

  return (
    <Screen
      title="Explorar"
      overline={mode === 'ask' ? 'Pregúntale a tu BrainIA' : mapHeader?.overline ?? 'Mapa de conocimiento'}
      subtitle={mode === 'map' ? 'Explora conexiones o busca una persona, comercio, tema o actividad.' : undefined}
      actions={mode === 'ask' ? askActions : mapHeader ? <Tag label={mapHeader.status.label} tone={mapHeader.status.tone} live={mapHeader.status.live} /> : undefined}
      refreshing={mode === 'map' ? mapHeader?.refreshing ?? false : false}
      onRefresh={mode === 'map' ? mapHeader?.refresh : undefined}
      bar={mode === 'ask' ? <AskComposer busy={chat.busy} onSend={send} onStop={chat.stop} autoFocusKey={focusKey} /> : undefined}
      scrollRef={scrollRef}
    >
      <SegmentedControl items={modes} value={mode} onChange={changeMode} accessibilityLabel="Modo de Explorar" />

      <View style={{ display: mode === 'ask' ? 'flex' : 'none', gap: 26 }}>
        {chat.messages.length ? chat.messages.map((message) => message.role === 'user'
          ? <UserBubble key={message.id} message={message} />
          : (
            <AssistantMessage
              key={message.id}
              message={message}
              highlighted={highlighted}
              onCitation={onCitation}
              onRetry={() => chat.retry(message.id)}
              onFeedback={(value) => chat.giveFeedback(message.id, value)}
            />
          )) : <AskEmpty client={client} onAsk={(text) => send(text)} voiceAvailable={voiceAvailable} />}
      </View>

      {mapVisited ? (
        <View style={{ display: mode === 'map' ? 'flex' : 'none', gap: 22 }}>
          <MapExplorer onHeaderChange={onHeaderChange} />
        </View>
      ) : null}
    </Screen>
  );
}
