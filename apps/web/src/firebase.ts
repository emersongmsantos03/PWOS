import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBgLqWxnLMuyPoG6i2WTSjVFuQ1gJb6kLo",
  authDomain: "pw-os-9ddce.firebaseapp.com",
  projectId: "pw-os-9ddce",
  storageBucket: "pw-os-9ddce.firebasestorage.app",
  messagingSenderId: "196338731494",
  appId: "1:196338731494:web:8d13a3399d3a4eafe92e27",
  measurementId: "G-HJ04P7M75Q",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const initializeFirebaseAnalytics = async (): Promise<Analytics | null> =>
  (await isSupported()) ? getAnalytics(firebaseApp) : null;
