import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getCountryName,
  countryISOMapping,
  europeanCountriesWithImage,
} from "../domain/countries";
import { useSRS, SRSRating } from "../hooks/useSRS";
import { SettingsData } from "../hooks/useSettings";

interface SRSGameProps {
  settingsData: SettingsData;
}

export function SRSGame({ settingsData }: SRSGameProps) {
  const { i18n } = useTranslation();

  // Pool: Europe for now — swap out europeanCountriesWithImage for
  // countriesWithImage to practice all countries
  const pool = europeanCountriesWithImage;

  const {
    loading,
    currentCard,
    revealed,
    revealCard,
    rateCard,
    sessionDone,
    progress,
  } = useSRS(pool);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire if focus is inside an input
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (!revealed) {
        if (e.key === "Enter") revealCard();
      } else {
        if (e.key === "1") rateCard("again");
        if (e.key === "2") rateCard("good");
        if (e.key === "3") rateCard("easy");
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [revealed, revealCard, rateCard]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center text-gray-400">
        Loading SRS data…
      </div>
    );
  }

  if (sessionDone) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center gap-3 text-center px-4">
        <div className="text-5xl">🎉</div>
        <div className="text-xl font-bold">Session complete!</div>
        <div className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
          You reviewed {progress.total} card
          {progress.total !== 1 ? "s" : ""}. Come back tomorrow for your next
          due reviews.
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Progress is saved in <code>srs-progress.txt</code>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  const country3LetterCode =
    countryISOMapping[currentCard.code]?.toLowerCase() ?? "";
  const oecCode = currentCard.oecCode
    ? currentCard.oecCode.toLowerCase()
    : country3LetterCode;
  const iframeSrc = `https://oec.world/en/visualize/embed/tree_map/hs92/export/${oecCode}/all/show/2023/?controls=false&title=false&click=false`;
  const countryName = getCountryName(i18n.resolvedLanguage, currentCard) ?? "";

  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const ratingBtn = (
    rating: SRSRating,
    label: string,
    shortcut: string,
    color: string
  ) => (
    <button
      key={rating}
      type="button"
      onClick={() => rateCard(rating)}
      className={`flex-1 py-2 px-3 rounded font-bold text-white text-sm ${color}`}
    >
      {label}
      <span className="block text-xs font-normal opacity-70">[{shortcut}]</span>
    </button>
  );

  return (
    <div className="flex-grow flex flex-col mx-2 relative">
      {/* Progress bar */}
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1 mt-1">
        <span>SRS · Europe</span>
        <span>
          {progress.done} / {progress.total}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded mb-3">
        <div
          className="h-1.5 bg-green-500 rounded transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Country name (or reveal hint) */}
      <div className="text-center my-4 min-h-[3rem] flex items-center justify-center">
        {revealed ? (
          <div className="text-3xl font-bold">{countryName}</div>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 text-sm">
            ↵ Enter — reveal answer
          </div>
        )}
      </div>

      {/* OEC trade chart */}
      <div className="relative h-0 pt-[25px] pb-96 md:pb-[70%]">
        <iframe
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
          title="Country exports"
          src={iframeSrc}
          frameBorder="0"
        />
      </div>

      {/* Rating buttons (after reveal) or keyboard hint (before) */}
      <div className="mt-4 mb-2 min-h-[3.5rem]">
        {revealed ? (
          <div className="flex gap-2">
            {ratingBtn("again", "Again", "1", "bg-red-500 hover:bg-red-600")}
            {ratingBtn("good", "Good", "2", "bg-blue-500 hover:bg-blue-600")}
            {ratingBtn("easy", "Easy", "3", "bg-green-500 hover:bg-green-600")}
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400 dark:text-gray-500">
            After revealing: [1] Again · [2] Good · [3] Easy
          </div>
        )}
      </div>
    </div>
  );
}
