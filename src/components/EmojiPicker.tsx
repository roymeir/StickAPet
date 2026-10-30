import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Chip } from './Primitives';

/**
 * Emojis that work well as WhatsApp search tags (from WhatsApp's tagging guide categories:
 * love, happy, sad, angry, greetings, celebration…) plus a few pet ones.
 */
export const TAG_EMOJIS = ['❤️', '😂', '😍', '😊', '🥰', '😘', '😎', '😢', '😭', '😡', '😮', '😴', '🤔', '👍', '🙏', '👋', '🎉', '🥳', '😋', '🤗', '🐶', '🐱', '🐾', '🔥'];

/** Corner decorations shown on the sticker art itself. */
export const CORNER_EMOJIS = ['❤️', '💕', '✨', '⭐', '🎉', '💤', '🔥', '😂', '🍖', '🦴', '🐟', '🎀', '👑', '💯'];

export function EmojiPicker({
  options,
  selected,
  onChange,
  max,
  allowNone,
  noneLabel,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Max number of selected emojis; 1 behaves like a radio group. */
  max: number;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const toggle = (e: string) => {
    if (selected.includes(e)) {
      const next = selected.filter((x) => x !== e);
      if (next.length === 0 && !allowNone && max > 1) return; // keep at least one tag
      onChange(next);
    } else if (max === 1) {
      onChange([e]);
    } else if (selected.length < max) {
      onChange([...selected, e]);
    } else {
      onChange([...selected.slice(1), e]);
    }
  };
  return (
    <View style={styles.wrap}>
      {allowNone ? <Chip big label={noneLabel ?? '—'} selected={selected.length === 0} onPress={() => onChange([])} /> : null}
      {options.map((e) => (
        <Chip key={e} big label={e} selected={selected.includes(e)} onPress={() => toggle(e)} />
      ))}
    </View>
  );
}

/** Default WhatsApp tags for a new sticker: ❤️ / 😂 from the caption, or a friendly default. */
export function suggestEmojis(caption: string | undefined, cornerEmoji: string | undefined): string[] {
  const text = (caption ?? '').toLowerCase();
  const tags: string[] = [];
  if (/(love|❤|💕|אוהב|אהבה|לב|מתגעגע|נשיקה|kiss|miss you)/.test(text)) tags.push('❤️');
  if (/(haha|lol|lmao|😂|חחח|צחוק|מצחיק|funny)/.test(text)) tags.push('😂');
  if (/(sleep|tired|night|ישן|לילה|עייף|💤)/.test(text)) tags.push('😴');
  if (/(hi|hello|hey|שלום|היי|בוקר טוב|morning)/.test(text)) tags.push('👋');
  if (/(angry|mad|כועס|עצבני)/.test(text)) tags.push('😡');
  if (/(sad|sorry|עצוב|סליחה)/.test(text)) tags.push('😢');
  if (cornerEmoji && TAG_EMOJIS.includes(cornerEmoji) && !tags.includes(cornerEmoji)) tags.push(cornerEmoji);
  if (tags.length === 0) tags.push('❤️', '😊');
  return tags.slice(0, 3);
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
