import { registerPlugin } from '@capacitor/core'
import type { WakeWordPlugin } from './definitions'

const WakeWord = registerPlugin<WakeWordPlugin>('WakeWord', {
  web: () => import('./web').then(m => new m.WakeWordWeb()),
})

export * from './definitions'
export { WakeWord }