import { suggestEmojis } from '../EmojiPicker';

describe('default WhatsApp emoji tags', () => {
  it('picks ❤️ / 😂 from the caption in both languages', () => {
    expect(suggestEmojis('Love you', undefined)).toEqual(['❤️']);
    expect(suggestEmojis('אוהבת אותך', undefined)).toEqual(['❤️']);
    expect(suggestEmojis('חחחח', undefined)).toEqual(['😂']);
    expect(suggestEmojis('LOL', undefined)).toEqual(['😂']);
  });

  it('falls back to a friendly default and includes a taggable corner emoji', () => {
    expect(suggestEmojis('', undefined)).toEqual(['❤️', '😊']);
    expect(suggestEmojis('', '🔥')).toEqual(['🔥']);
    expect(suggestEmojis('good night', '😂')).toEqual(['😴', '😂']);
  });
});
