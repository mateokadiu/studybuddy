import { mmkvStorage } from '@/lib/mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LlmModelId =
  | 'llama-3.2-3b-instruct-q4'
  | 'phi-3.5-mini-q4'
  | 'gemma-2-2b-q4'
  | 'llama-3.2-1b-q4';
export type EmbedModelId = 'all-minilm-l6-v2';

export interface SettingsState {
  /** active LLM model id (must be downloaded). */
  llmModelId: LlmModelId;
  /** active embedding model id. */
  embedModelId: EmbedModelId;
  /** daily review limit (cards/day). */
  dailyTarget: number;
  /** desired notification time, "HH:mm" 24h. */
  dailyReviewTime: string;
  /** wifi-only model download. */
  wifiOnlyDownloads: boolean;
  /** require charger for downloads. */
  requireChargerForDownloads: boolean;
  /** onboarding finished. */
  onboardingDone: boolean;
  /** FSRS weights — initialized to v4.5 defaults in commit 12. */
  fsrsParams: number[] | null;

  setLlmModel(id: LlmModelId): void;
  setEmbedModel(id: EmbedModelId): void;
  setDailyTarget(n: number): void;
  setDailyReviewTime(hhmm: string): void;
  setWifiOnly(v: boolean): void;
  setRequireCharger(v: boolean): void;
  completeOnboarding(): void;
  setFsrsParams(params: number[] | null): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      llmModelId: 'llama-3.2-3b-instruct-q4',
      embedModelId: 'all-minilm-l6-v2',
      dailyTarget: 20,
      dailyReviewTime: '09:00',
      wifiOnlyDownloads: true,
      requireChargerForDownloads: false,
      onboardingDone: false,
      fsrsParams: null,

      setLlmModel: (id) => set({ llmModelId: id }),
      setEmbedModel: (id) => set({ embedModelId: id }),
      setDailyTarget: (n) => set({ dailyTarget: Math.max(1, Math.min(500, n)) }),
      setDailyReviewTime: (hhmm) => set({ dailyReviewTime: hhmm }),
      setWifiOnly: (v) => set({ wifiOnlyDownloads: v }),
      setRequireCharger: (v) => set({ requireChargerForDownloads: v }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setFsrsParams: (params) => set({ fsrsParams: params }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage()),
      version: 1,
    },
  ),
);
