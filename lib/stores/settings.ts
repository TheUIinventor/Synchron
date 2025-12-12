import create from 'zustand'
import { persist } from 'zustand/middleware'

type SettingsState = {
  compactMode: boolean
  setCompactMode: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>(persist((set) => ({
  compactMode: false,
  setCompactMode: (v: boolean) => set({ compactMode: v }),
}), { name: 'synchron-settings' }))
