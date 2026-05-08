export interface BotDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tags: string[];
  filter?: (body: string) => string;
}

const SWEAR_PATTERN =
  /\b(shit|fuck|crap|ass|damn|bitch|bastard|piss|cock|cunt|dick|prick|twat|wanker|bollocks)\b/gi;

export const ALL_BOTS: BotDefinition[] = [
  {
    id: 'swear-filter-bot',
    name: 'SwearShield',
    description:
      'Automatically censors profanity in messages before they are sent. All room members see clean, filtered text.',
    emoji: '🛡️',
    tags: ['moderation', 'filter'],
    filter: (body) => body.replace(SWEAR_PATTERN, '***'),
  },
];

export function getBotById(id: string): BotDefinition | undefined {
  return ALL_BOTS.find((b) => b.id === id);
}
