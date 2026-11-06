import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { legacyEntryCompatibility } from './build/legacyEntryCompatibility.ts'

export default defineConfig({ plugins: [react(), legacyEntryCompatibility()] })
