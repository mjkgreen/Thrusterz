// Game Center (iOS): sign-in, leaderboards and achievements. The native half
// is ios/GameCenterModule.swift; elsewhere (Android, Expo Go) this is null.
import { requireOptionalNativeModule } from 'expo-modules-core';

export default requireOptionalNativeModule('GameCenter');
