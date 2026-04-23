import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
	apiKey: "AIzaSyB3LXwdnmKgVGeycr-kSuozT667-O3s_cU",
	authDomain: "munchsprouts.firebaseapp.com",
	projectId: "munchsprouts",
	storageBucket: "munchsprouts.firebasestorage.app",
	messagingSenderId: "406023036087",
	appId: "1:406023036087:web:3cb6b5d6ee47f84d130132",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
	persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
