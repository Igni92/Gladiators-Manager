import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gladiators.manager',
  appName: 'Gladiators Manager',
  webDir: 'dist',
  backgroundColor: '#16100a',
  ios: {
    contentInset: 'never',
  },
};

export default config;
