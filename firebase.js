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

export const GOOGLE_WEB_CLIENT_ID =
	"406023036087-71leqh6hjhigatatn3akjsvf3ml97eir.apps.googleusercontent.com";

export const GOOGLE_IOS_CLIENT_ID =
	"406023036087-4ci5jet3el9aqgnuetadrocdp3d3s2jr.apps.googleusercontent.com";

// Android OAuth client ID — from google-services.json → oauth_client → client_type: 1
export const GOOGLE_ANDROID_CLIENT_ID =
	"406023036087-mbb3lsl7i5kakj32mkuptjd926sit26v.apps.googleusercontent.com";
