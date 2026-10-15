export interface SpeechPart {
  text: string;
  language: 'vi' | 'en';
}

// This dictionary affects audio only. The authoritative question remains unchanged.
const terms: Record<string, string> = {
  'dependency injection': 'dependency injection',
  'race condition': 'race condition',
  'eventual consistency': 'eventual consistency',
  'load balancing': 'load balancing',
  'design pattern': 'design pattern',
  microservices: 'microservices',
  postgresql: 'Postgres Q L',
  kubernetes: 'Kubernetes',
  redis: 'Redis',
  'next.js': 'Next J S',
  'node.js': 'Node J S',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  docker: 'Docker',
  graphql: 'Graph Q L',
  http: 'H T T P',
  https: 'H T T P S',
  api: 'A P I',
  jwt: 'J W T',
  sql: 'S Q L',
};

export function speechParts(text: string, language: string): SpeechPart[] {
  if (!language.startsWith('vi')) return [{ text, language: 'en' }];
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${Object.keys(terms)
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  );
  const parts: SpeechPart[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > end) parts.push({ text: text.slice(end, match.index), language: 'vi' });
    parts.push({ text: terms[match[0].toLowerCase()], language: 'en' });
    end = match.index! + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end), language: 'vi' });
  const grouped: SpeechPart[] = [];
  for (const part of parts) {
    const previous = grouped[grouped.length - 1];
    if (!/[\p{L}\p{N}]/u.test(part.text) && previous) previous.text += part.text;
    else if (previous?.language === part.language) previous.text += ` ${part.text}`;
    else if (part.text.trim()) grouped.push({ ...part, text: part.text.trim() });
  }
  return grouped;
}
