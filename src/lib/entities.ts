// Lightweight noun-phrase and entity extractor. No NLP deps - regex + stop-word filter.
// Results are explicitly heuristic - document this in README.

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "as","by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might","shall",
  "that","this","these","those","it","its","they","them","their","we","our",
  "you","your","he","his","she","her","i","me","my","we","us","no","not",
  "what","when","where","which","who","how","why","all","any","each","every",
  "both","few","more","most","other","some","such","than","too","very","just",
  "can","also","there","then","than","into","through","during","before","after",
  "above","below","between","about","against","along","among","around",
]);

function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase());
}

export interface ExtractedEntity {
  name: string;
  type: string | null;
  same_as: string[];
  mention_count: number;
  is_defined: boolean;
}

/** Extract entities from JSON-LD blocks (typed, with sameAs). */
export function extractJsonLdEntities(
  blocks: Array<{ parsed: Record<string, unknown>; types: string[] }>
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  for (const block of blocks) {
    const name = block.parsed["name"];
    if (typeof name !== "string" || !name.trim()) continue;
    const sameAs = block.parsed["sameAs"];
    const saList: string[] = Array.isArray(sameAs)
      ? (sameAs as string[])
      : typeof sameAs === "string"
      ? [sameAs]
      : [];
    entities.push({
      name: name.trim(),
      type: block.types[0] ?? null,
      same_as: saList,
      mention_count: 0, // will be updated by text pass
      is_defined: false,
    });
  }
  return entities;
}

/** Extract title-cased noun phrases from body text (heuristic). */
export function extractTextEntities(bodyText: string, minOccurrences = 2): ExtractedEntity[] {
  // Match: title-cased multi-word phrases, ALL-CAPS acronyms (2-10 chars), CamelCase tech names
  const patterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g,         // title-cased phrases
    /\b([A-Z]{2,10})\b/g,                                   // ALL-CAPS acronyms
    /\b([A-Z][a-z]+[A-Z][A-Za-z]*)\b/g,                    // CamelCase tech names
    /\b([A-Z][a-z]+-\d+)\b/g,                               // Names like GPT-4, Claude-3
  ];
  const counts = new Map<string, number>();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(bodyText)) !== null) {
      const phrase = match[1];
      const words = phrase.split(/\s+/);
      if (words.every(isStopWord)) continue;
      if (words.length === 1 && isStopWord(words[0])) continue;
      // Skip common short non-entity ALL-CAPS: I, A, IT, etc.
      if (/^[A-Z]{1,2}$/.test(phrase)) continue;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  const entities: ExtractedEntity[] = [];
  for (const [name, count] of counts.entries()) {
    if (count < minOccurrences) continue;

    // Check for inline definition: look for "X is a", "X refers to", "X means" within 100 chars after first mention
    const idx = bodyText.indexOf(name);
    const context = idx >= 0 ? bodyText.substring(idx, idx + 100) : "";
    const is_defined = /is an?\s+|refers to\s+|means\s+|defined as\s+/i.test(context);

    entities.push({
      name,
      type: null,
      same_as: [],
      mention_count: count,
      is_defined,
    });
  }

  return entities;
}

/** Merge JSON-LD entities with text entities, updating mention counts. */
export function mergeEntities(
  jsonLdEntities: ExtractedEntity[],
  textEntities: ExtractedEntity[],
  bodyText: string
): ExtractedEntity[] {
  const merged = new Map<string, ExtractedEntity>();

  // Add JSON-LD entities first
  for (const e of jsonLdEntities) {
    const key = e.name.toLowerCase();
    const count = countOccurrences(bodyText, e.name);
    merged.set(key, { ...e, mention_count: count });
  }

  // Add text entities (skip if already captured from JSON-LD)
  for (const e of textEntities) {
    const key = e.name.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, e);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.mention_count - a.mention_count);
}

function countOccurrences(text: string, term: string): number {
  const lower = text.toLowerCase();
  const termLower = term.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(termLower, idx)) !== -1) {
    count++;
    idx += termLower.length;
  }
  return count;
}
