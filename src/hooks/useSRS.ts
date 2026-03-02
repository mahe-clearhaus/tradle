import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { Country } from "../domain/countries";

// ============================================================
// SRS Configuration — adjust these values freely
// ============================================================
export const SRS_CONFIG = {
  INITIAL_INTERVAL_1: 1,          // days after 1st correct answer
  INITIAL_INTERVAL_2: 3,          // days after 2nd correct answer
  STARTING_EASE: 2.5,             // ease factor for new cards
  AGAIN_EASE_DELTA: -0.20,        // ease change on "Again"
  EASY_EASE_DELTA: +0.10,         // ease change on "Easy"
  MIN_EASE: 1.3,                  // lowest allowed ease factor
  EASY_BONUS: 1.3,                // extra interval multiplier for "Easy"
  MAX_NEW_CARDS_PER_SESSION: 10,  // unseen cards introduced per session
} as const;

// ── Types ─────────────────────────────────────────────────────

export type SRSRating = "again" | "good" | "easy";

export interface SRSCard {
  code: string;
  interval: number;    // days until next review
  ease: number;        // ease factor
  nextReview: string;  // YYYY-MM-DD
  reps: number;        // consecutive correct reps (resets on "again")
}

// ── File parsing / serialization ─────────────────────────────

function parseFile(content: string): Record<string, SRSCard> {
  const cards: Record<string, SRSCard> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [code, interval, ease, nextReview, reps] = t.split(",");
    if (code && interval && ease && nextReview && reps !== undefined) {
      cards[code] = {
        code,
        interval: parseInt(interval, 10),
        ease: parseFloat(ease),
        nextReview,
        reps: parseInt(reps, 10),
      };
    }
  }
  return cards;
}

const FILE_HEADER = [
  "# Tradle SRS Progress",
  "# Format: code,interval_days,ease_factor,next_review_date,correct_reps",
  "# Delete a line to reset that country. Delete this file to reset everything.",
  "#",
].join("\n");

function serializeCards(cards: Record<string, SRSCard>): string {
  const rows = Object.values(cards)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(
      (c) =>
        `${c.code},${c.interval},${c.ease.toFixed(2)},${c.nextReview},${c.reps}`
    )
    .join("\n");
  return `${FILE_HEADER}\n${rows}\n`;
}

// ── SM-2 algorithm ───────────────────────────────────────────

function addDays(date: string, days: number): string {
  return DateTime.fromISO(date).plus({ days }).toFormat("yyyy-MM-dd");
}

function applyRating(
  existing: SRSCard | undefined,
  code: string,
  rating: SRSRating,
  today: string
): SRSCard {
  const c = existing ?? {
    code,
    interval: 0,
    ease: SRS_CONFIG.STARTING_EASE,
    nextReview: today,
    reps: 0,
  };

  const ease = Math.max(
    SRS_CONFIG.MIN_EASE,
    c.ease +
      (rating === "again"
        ? SRS_CONFIG.AGAIN_EASE_DELTA
        : rating === "easy"
        ? SRS_CONFIG.EASY_EASE_DELTA
        : 0)
  );

  let interval: number;
  if (rating === "again") {
    interval = 1;
  } else if (c.reps === 0) {
    interval = SRS_CONFIG.INITIAL_INTERVAL_1;
  } else if (c.reps === 1) {
    interval = SRS_CONFIG.INITIAL_INTERVAL_2;
  } else {
    const bonus = rating === "easy" ? SRS_CONFIG.EASY_BONUS : 1;
    interval = Math.max(1, Math.round(c.interval * ease * bonus));
  }

  return {
    code,
    interval,
    ease,
    nextReview: addDays(today, interval),
    reps: rating === "again" ? 0 : c.reps + 1,
  };
}

// ── Session queue builder ─────────────────────────────────────

function buildQueue(
  pool: Country[],
  cards: Record<string, SRSCard>,
  today: string
): Country[] {
  const due = pool
    .filter((c) => cards[c.code] && cards[c.code].nextReview <= today)
    .sort((a, b) =>
      cards[a.code].nextReview.localeCompare(cards[b.code].nextReview)
    );

  const unseen = pool.filter((c) => !cards[c.code]);
  const shuffled = [...unseen].sort(() => Math.random() - 0.5);
  const newCards = shuffled.slice(0, SRS_CONFIG.MAX_NEW_CARDS_PER_SESSION);

  return [...due, ...newCards];
}

// ── Hook ─────────────────────────────────────────────────────

export function useSRS(pool: Country[]) {
  const today = DateTime.now().toFormat("yyyy-MM-dd");

  const [cards, setCards] = useState<Record<string, SRSCard>>({});
  const [queue, setQueue] = useState<Country[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/srs")
      .then((r) => r.text())
      .then((text) => {
        const loaded = parseFile(text);
        setCards(loaded);
        setQueue(buildQueue(pool, loaded, today));
      })
      .catch(() => {
        // Server not running — treat all cards as new
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        setQueue(shuffled.slice(0, SRS_CONFIG.MAX_NEW_CARDS_PER_SESSION));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const saveCards = useCallback((updated: Record<string, SRSCard>) => {
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: serializeCards(updated),
    }).catch(() => {}); // silent fail if server is down
  }, []);

  const revealCard = useCallback(() => setRevealed(true), []);

  const rateCard = useCallback(
    (rating: SRSRating) => {
      const current = queue[index];
      if (!current) return;

      const updated = applyRating(cards[current.code], current.code, rating, today);
      const updatedCards = { ...cards, [current.code]: updated };
      setCards(updatedCards);
      saveCards(updatedCards);

      if (rating === "again") {
        // Remove from current position, re-append to end of queue
        setQueue((q) => [
          ...q.slice(0, index),
          ...q.slice(index + 1),
          current,
        ]);
        // index stays — the next card slides into current position
      } else {
        setIndex((i) => i + 1);
      }
      setRevealed(false);
    },
    [cards, index, queue, saveCards, today]
  );

  const currentCard = queue[index] ?? null;
  const sessionDone = !loading && currentCard === null;

  return {
    loading,
    currentCard,
    revealed,
    revealCard,
    rateCard,
    sessionDone,
    progress: { done: Math.min(index, queue.length), total: queue.length },
  };
}
