"use client";

import { createContext, useContext } from "react";

/** "Save to notes" for Rem's answers (the student's question becomes the card title): provided by the Tutor on lesson pages. */
export const SaveNoteContext = createContext<((answer: string, question: string) => void) | null>(null);
export const useSaveNote = () => useContext(SaveNoteContext);
