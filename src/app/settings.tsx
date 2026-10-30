import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { toFilePart } from '@/ai/filePart';
import { makeProvider } from '@/ai/service';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Banner, Card, Chip, Divider, Row, Segmented, SectionTitle } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { estimateCostUsd, IMAGE_MODEL_PRESETS, PRICING } from '@/config/ai';
import { loadDemoPacks } from '@/dev/demoData';
import { runSelfTest, type SelfTestReport } from '@/dev/selfTest';
import type { ImageQuality, Language, ThemeMode } from '@/domain/types';
import { applyLayoutDirection } from '@/i18n/direction';
import { useI18n } from '@/i18n/useI18n';
import { describeError } from '@/lib/errors';
import { OUTLINE_CHOICES } from '@/state/defaults';
import { useAppStore } from '@/state/appStore';
import { clearApiKey, getApiKey, setApiKey } from '@/storage/secrets';
import { spacing } from '@/theme';

export default function SettingsScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const settings = useAppStore((s) => s.data.settings);
  const update = useAppStore((s) => s.updateSettings);

  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyStatus, setKeyStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [modelDraft, setModelDraft] = useState(settings.model);
  const [publisherDraft, setPublisherDraft] = useState(settings.publisher);
  const [selfTest, setSelfTest] = useState<SelfTestReport | 'running' | null>(null);

  useEffect(() => {
    void getApiKey().then(setSavedKey);
  }, []);

  const saveKey = async () => {
    if (!keyDraft.trim()) return;
    await setApiKey(keyDraft);
    setSavedKey(keyDraft.trim());
    setKeyDraft('');
    setKeyStatus({ tone: 'success', text: t('settings.apiKeySaved') });
  };

  const testKey = async () => {
    setTesting(true);
    setKeyStatus(null);
    try {
      const key = keyDraft.trim() || savedKey;
      await makeProvider(key, settings, toFilePart).verify();
      setKeyStatus({ tone: 'success', text: t('settings.apiKeyOk', { model: settings.model }) });
    } catch (e) {
      setKeyStatus({ tone: 'danger', text: describeError(e, i18n, settings.model) });
    } finally {
      setTesting(false);
    }
  };

  const changeLanguage = async (language: Language) => {
    if (language === settings.language) return;
    await update({ language });
    await applyLayoutDirection(language, null, (lang) => update({ directionReloadFor: lang }));
  };

  const masked = savedKey ? `${savedKey.slice(0, 7)}…${savedKey.slice(-4)}` : null;
  const cost = estimateCostUsd(settings.quality, settings.variants);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.title') }} />

      <SectionTitle>{t('settings.ai')}</SectionTitle>
      <Card style={styles.card}>
        <AppText variant="label">{t('settings.apiKey')}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('settings.apiKeyBody')}
        </AppText>
        <AppText variant="body" color={masked ? 'text' : 'textMuted'} style={{ writingDirection: 'ltr' }}>
          {masked ?? t('settings.apiKeyMissing')}
        </AppText>
        <TextField
          ltr
          value={keyDraft}
          onChangeText={setKeyDraft}
          placeholder={t('settings.apiKeyPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType="password"
          accessibilityLabel={t('settings.apiKey')}
          onSubmitEditing={saveKey}
        />
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          <Button size="md" label={t('common.save')} onPress={saveKey} disabled={!keyDraft.trim()} style={{ flexGrow: 1 }} />
          <Button
            size="md"
            variant="secondary"
            label={testing ? t('settings.apiKeyTesting') : t('settings.apiKeyTest')}
            loading={testing}
            onPress={testKey}
            disabled={!keyDraft.trim() && !savedKey}
            style={{ flexGrow: 1 }}
          />
        </Row>
        {savedKey ? (
          <Button
            size="md"
            variant="ghost"
            label={t('settings.apiKeyRemove')}
            onPress={async () => {
              await clearApiKey();
              setSavedKey(null);
              setKeyStatus(null);
            }}
          />
        ) : null}
        {keyStatus ? <Banner tone={keyStatus.tone}>{keyStatus.text}</Banner> : null}

        <Divider />
        <AppText variant="label">{t('settings.quality')}</AppText>
        <Segmented<ImageQuality>
          value={settings.quality}
          onChange={(quality) => update({ quality })}
          options={(['low', 'medium', 'high'] as const).map((q) => ({ value: q, label: t(`settings.quality.${q}`) }))}
        />
        <AppText variant="label">{t('settings.variants')}</AppText>
        <Segmented<1 | 2> value={settings.variants} onChange={(variants) => update({ variants })} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
        <Banner tone="info" title={t('settings.cost', { cost: cost.toFixed(3) })}>
          {t('settings.costNote', { date: PRICING.asOf })}
        </Banner>

        <Divider />
        <TextField
          ltr
          label={t('settings.model')}
          hint={t('settings.modelHint')}
          value={modelDraft}
          onChangeText={setModelDraft}
          onEndEditing={() => modelDraft.trim() && update({ model: modelDraft.trim() })}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {IMAGE_MODEL_PRESETS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={settings.model === m}
              onPress={() => {
                setModelDraft(m);
                void update({ model: m });
              }}
            />
          ))}
        </Row>
      </Card>

      <SectionTitle>{t('settings.stickers')}</SectionTitle>
      <Card style={styles.card}>
        <AppText variant="label">{t('settings.outline')}</AppText>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {OUTLINE_CHOICES.map((o) => (
            <Chip key={o} label={o === 0 ? t('common.none') : `${Math.round(o * 100)}%`} selected={settings.outlinePct === o} onPress={() => update({ outlinePct: o })} />
          ))}
        </Row>
        <AppText variant="label">{t('settings.shadow')}</AppText>
        <Segmented<'on' | 'off'>
          value={settings.shadow ? 'on' : 'off'}
          onChange={(v) => update({ shadow: v === 'on' })}
          options={[
            { value: 'on', label: t('common.on') },
            { value: 'off', label: t('common.off') },
          ]}
        />
        <TextField
          label={t('settings.publisher')}
          hint={t('settings.publisherHint')}
          value={publisherDraft}
          maxLength={128}
          onChangeText={setPublisherDraft}
          onEndEditing={() => publisherDraft.trim() && update({ publisher: publisherDraft.trim() })}
        />
      </Card>

      <SectionTitle>{t('settings.appearance')}</SectionTitle>
      <Card style={styles.card}>
        <AppText variant="label">{t('settings.language')}</AppText>
        <Segmented<Language>
          value={settings.language}
          onChange={changeLanguage}
          options={[
            { value: 'he', label: 'עברית' },
            { value: 'en', label: 'English' },
          ]}
        />
        <AppText variant="caption" color="textMuted">
          {t('settings.languageRestart')}
        </AppText>
        <AppText variant="label">{t('settings.theme')}</AppText>
        <Segmented<ThemeMode>
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={(['system', 'light', 'dark'] as const).map((m) => ({ value: m, label: t(`settings.theme.${m}`) }))}
        />
      </Card>

      <Banner tone="info">{t('settings.privacy')}</Banner>

      <SectionTitle>{t('settings.diagnostics')}</SectionTitle>
      <Card style={styles.card}>
        <AppText variant="caption" color="textMuted">
          {t('settings.selfTestBody')}
        </AppText>
        <Button
          size="md"
          variant="secondary"
          icon="flask-outline"
          label={selfTest === 'running' ? t('settings.selfTestRunning') : t('settings.selfTest')}
          loading={selfTest === 'running'}
          onPress={async () => {
            setSelfTest('running');
            setSelfTest(await runSelfTest());
          }}
        />
        {selfTest && selfTest !== 'running' ? (
          <Banner tone={selfTest.ok ? 'success' : 'danger'}>
            <View style={{ gap: 2 }}>
              {selfTest.lines.map((line) => (
                <AppText key={line} variant="caption" style={{ writingDirection: 'ltr', textAlign: 'left' }}>
                  {line}
                </AppText>
              ))}
            </View>
          </Banner>
        ) : null}
        {__DEV__ || Platform.OS === 'web' ? (
          <Button size="md" variant="ghost" label={t('settings.loadDemo')} onPress={() => loadDemoPacks({ full: t('new.save.defaultName'), partial: 'Luna' })} />
        ) : null}
      </Card>

      <AppText variant="caption" color="textMuted" align="center">
        {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
