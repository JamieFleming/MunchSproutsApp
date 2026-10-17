import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Keyboard, Platform, Image, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, collection, updateDoc, writeBatch, deleteField, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { db } from '../firebase';
import { useTheme } from '../ThemeContext';
import { DateField } from '../components/DatePickerModal';
import { pickImageAsBase64 } from '../helpers';
import { uploadPhotoIfBase64 } from '../firebaseHooks';
import { getExpoPushToken } from '../notificationService';
import { Choice, FieldHeading, FeedingJourneyFields, PriorityChoices } from '../components/FeedingJourneyFields';
import { OnboardingCompleteScreen } from './OnboardingCompleteScreen';
import { validateChildProfile, dashboardPreferences } from '../onboardingModel';

const TITLES = ['Welcome to\nMunchSprouts', 'A little about you', 'Tell us about your\nlittle sprout', 'Every little sprout\ngrows differently', 'What matters\nmost to you?'];
const SUBTITLES = [
  "From first tastes to family favourites, we're here to make your little one's food journey easier.",
  "Let's start with the person cheering them on. What should we call you?",
  'A few little details help us make this space their own.',
  "Let's tailor MunchSprouts to your little one's feeding journey. There's no one-size-fits-all.",
  "We'll help you get started with your favourite feature. Everything else will still be here to explore.",
];
const LABELS = ['Welcome', 'About you', 'Your sprout', 'Feeding journey', 'Your priorities'];

export function OnboardingScreen({ user, userDoc = {}, preview = false, onPreviewFinish }) {
  const { C } = useTheme();
  const draft = preview ? {} : userDoc.onboardingDraft || {};
  const [step, setStep] = useState(Math.min(4, Math.max(0, draft.step || 0)));
  const [data, setData] = useState(() => ({
    parentName: userDoc.name || user.displayName || '', parentPhoto: userDoc.photoURL || user.photoURL || '',
    name: '', dob: '', weaningStart: '', photoUri: '', weaningStage: '', feedingApproach: 'unsure',
    trackMilk: null, allergyStatus: '', knownAllergens: [], otherAllergies: '', priority: '', notifications: 'later',
    ...draft.data,
  }));
  const [childId] = useState(() => draft.childId || doc(collection(db, 'children')).id);
  const [busy, setBusy] = useState(false);
  const [previewComplete, setPreviewComplete] = useState(false);
  const saving = useRef(false);
  const scroll = useRef(null);
  const set = (key, value) => setData((old) => ({ ...old, [key]: value }));
  const move = (next) => { Keyboard.dismiss(); setStep(next); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const photo = async (key) => {
    try { const uri = await pickImageAsBase64([1, 1]); if (uri) set(key, uri); }
    catch { Alert.alert('Photo unavailable', 'Please try another photo. You can also add one later.'); }
  };
  const enableNotifications = async () => {
    if (preview) { set("notifications", "enabled"); return; }
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const token = await getExpoPushToken();
      const permission = await Notifications.getPermissionsAsync();
      setData((old) => ({ ...old, notifications: permission.granted ? 'enabled' : 'denied', pushToken: token || '' }));
      if (!permission.granted) Alert.alert('No problem', 'You can enable notifications later in your phone settings.');
    } catch { Alert.alert('Notifications unavailable', 'You can set these up later in More.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const next = async () => {
    if (saving.current) return;
    if (step === 1 && !data.parentName.trim()) return Alert.alert('Your name', 'Please enter your name to continue.');
    if (step === 2) { const error = validateChildProfile(data); if (error) return Alert.alert('Check these details', error); }
    if (step === 3 && (!data.weaningStage || data.trackMilk === null || !data.allergyStatus)) return Alert.alert('A little more about your journey', 'Please choose a feeding stage, milk tracking preference and allergy answer.');
    if (step === 3 && data.allergyStatus === 'yes' && !data.knownAllergens.length && !data.otherAllergies.trim()) return Alert.alert('Known allergies', 'Select an allergen or add details in the other allergies box.');
    if (step === 4 && !data.priority) return Alert.alert('Choose your starting point', 'Pick the feature you would like to start with. You can change it later.');
    if (preview) {
      if (step < 4) move(step + 1);
      else setPreviewComplete(true);
      return;
    }
    saving.current = true; setBusy(true);
    try {
      const saved = { ...data };
      if (step >= 1) saved.parentPhoto = await uploadPhotoIfBase64(data.parentPhoto, `profilePhotos/${user.uid}/profile.jpg`);
      if (step >= 2) saved.photoUri = await uploadPhotoIfBase64(data.photoUri, `childPhotos/${user.uid}/${childId}.jpg`);
      setData(saved);
      const userRef = doc(db, 'users', user.uid);
      if (step < 4) {
        await updateDoc(userRef, { onboardingDraft: { step: step + 1, childId, data: saved } });
        move(step + 1);
      } else {
        const error = validateChildProfile(saved); if (error) throw new Error(error);
        const preferences = dashboardPreferences(saved);
        // One batch creates the child and completes onboarding. Retrying uses the
        // same child ID, so a failed save cannot create duplicate child profiles.
        const batch = writeBatch(db);
        batch.set(doc(db, 'children', childId), {
          userId: user.uid, name: saved.name.trim(), dob: saved.dob, weaningStart: saved.weaningStart,
          photoUri: saved.photoUri, weaningStage: saved.weaningStage, feedingApproach: saved.feedingApproach,
          allergyStatus: saved.allergyStatus, knownAllergens: saved.allergyStatus === 'yes' ? saved.knownAllergens : [],
          otherAllergies: saved.allergyStatus === 'yes' ? saved.otherAllergies.trim() : '',
        }, { merge: true });
        batch.update(userRef, {
          name: saved.parentName.trim(), photoURL: saved.parentPhoto,
          dashboardPreferences: preferences, onboardingPriority: saved.priority,
          notificationPreference: saved.notifications,
          pushToken: saved.notifications === 'enabled' && saved.pushToken ? saved.pushToken : deleteField(),
          defaultChildId: childId, onboardingComplete: true, onboardingVersion: 2,
          onboardingCompletedAt: serverTimestamp(), onboardingDraft: deleteField(),
          onboardingWelcome: { childName: saved.name.trim(), priority: saved.priority },
        });
        // Local preferences are a best-effort cache; Firestore is authoritative.
        await AsyncStorage.multiSet([
          [`showMilkDash_${user.uid}`, String(preferences.showMilk)],
          [`showAllergenDash_${user.uid}`, String(preferences.showAllergens)],
          [`defaultChildId_${user.uid}`, childId],
        ]).catch(() => {});
        await updateProfile(user, { displayName: saved.parentName.trim() }).catch(() => {});
        await batch.commit(); // Root shows the saved completion screen before entering the dashboard.
      }
    } catch (error) {
      Alert.alert('Your progress is still here', error.message || 'We could not save just yet. Check your connection and try again.');
    } finally { saving.current = false; setBusy(false); }
  };
  const avatar = (key, label) => <View style={{ alignItems: 'center', marginVertical: 14 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={() => photo(key)} style={{ alignItems: 'center' }}>
      {data[key] ? <Image source={{ uri: data[key] }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: C.bgPurple, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 36 }}>{key === 'parentPhoto' ? '📷' : '🌱'}</Text></View>}
      <Text style={{ color: C.primaryPurple, fontFamily: 'NunitoSans_700Bold', marginTop: 9 }}>{data[key] ? 'Change photo' : label}</Text>
    </TouchableOpacity>
    {!!data[key] && <TouchableOpacity accessibilityRole="button" onPress={() => set(key, '')} style={{ padding: 10 }}><Text style={{ color: C.mutedText }}>Remove photo</Text></TouchableOpacity>}
  </View>;
  const input = (key, label, placeholder) => <View style={{ marginBottom: 18 }}>
    <FieldHeading>{label}</FieldHeading><TextInput accessibilityLabel={label} value={data[key]} onChangeText={(v) => set(key, v)} placeholder={placeholder} placeholderTextColor={C.mutedText} autoCapitalize="words" autoCorrect={false} maxLength={80} style={[styles.input, { color: C.textCharcoal, backgroundColor: C.white, borderColor: C.borderLight }]} />
  </View>;
  if (previewComplete) return <OnboardingCompleteScreen priority={data.priority} childName={data.name} onPreviewFinish={onPreviewFinish} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.screen || C.white }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous step" disabled={step === 0 || busy} onPress={() => move(step - 1)} style={{ paddingVertical: 10, minWidth: 60 }}><Text style={{ color: step ? C.primaryPurple : 'transparent', fontFamily: 'NunitoSans_700Bold' }}>← Back</Text></TouchableOpacity>
          <Text style={{ color: C.mutedText, fontFamily: 'NunitoSans_700Bold', fontSize: 12 }}>{step + 1} OF 5 · {LABELS[step].toUpperCase()}</Text>
        </View>
        <View accessibilityLabel={`Step ${step + 1} of 5`} style={{ flexDirection: 'row', gap: 6 }}>{LABELS.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: i <= step ? C.primaryPurple : C.borderLight }} />)}</View>
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <View pointerEvents={busy ? 'none' : 'auto'}>
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 20 }}>
            {step === 0 ? <Image source={require('../../assets/logo.png')} style={{ width: 112, height: 112 }} resizeMode="contain" /> : <View style={{ backgroundColor: C.bgPurple, width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 30 }}>{['🌱', '👋', '🌱', '🥦', '✨'][step]}</Text></View>}
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: C.primaryPinkDark }]}>{TITLES[step]}</Text>
          <Text style={[styles.subtitle, { color: C.mutedText }]}>{SUBTITLES[step]}</Text>
          {step === 0 && <View style={{ padding: 18, borderRadius: 24, backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
            {[
              ['🥑', 'Little tastes. Lovely memories.', 'Keep foods, favourites and reactions together.'],
              ['🍼', 'Less remembering. More enjoying.', 'Track milk feeds alongside your food journey.'],
              ['🛡️', 'A clearer picture.', 'Record allergen introductions at your own pace.'],
              ['🍽️', 'Fresh ideas for little appetites.', 'Find inspiration for what to try next.'],
            ].map(([emoji, title, detail]) => <View key={title} style={{ flexDirection: 'row', gap: 13, marginVertical: 12 }}><Text style={{ fontSize: 26 }}>{emoji}</Text><View style={{ flex: 1 }}><Text style={{ color: C.primaryPinkDark, fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15 }}>{title}</Text><Text style={{ color: C.mutedText, fontFamily: 'NunitoSans_400Regular', lineHeight: 20, marginTop: 4 }}>{detail}</Text></View></View>)}
          </View>}
          {step === 1 && <>{input('parentName', 'Your name', 'e.g. Jamie')}{avatar('parentPhoto', 'Add a profile photo (optional)')}</>}
          {step === 2 && <>{input('name', "Your little one's name", 'e.g. Eleia')}<DateField label="Date of birth" value={data.dob} onChange={(v) => set('dob', v)} minYear={2000} maxYear={new Date().getFullYear()} />
            {avatar('photoUri', 'Add their photo (optional)')}<DateField label="Weaning start date (optional)" value={data.weaningStart} onChange={(v) => set('weaningStart', v)} minYear={2000} maxYear={new Date().getFullYear() + 1} />
            {!!data.weaningStart && <TouchableOpacity onPress={() => set('weaningStart', '')} style={{ paddingVertical: 12 }}><Text style={{ color: C.primaryPurple }}>Clear start date</Text></TouchableOpacity>}
            <Text style={{ color: C.mutedText, fontSize: 12, lineHeight: 18, marginTop: 12 }}>Not sure when you'll start? Leave this blank and add it later.</Text></>}
          {step === 3 && <FeedingJourneyFields value={data} onChange={setData} />}
          {step === 4 && <><FieldHeading>Choose your starting point</FieldHeading><PriorityChoices value={data.priority} onChange={(v) => set('priority', v)} />
            <FieldHeading detail="Allow helpful reminders and updates. You can manage these later in More.">A little nudge?</FieldHeading>
            <Choice label={data.notifications === 'enabled' ? 'Notifications allowed' : 'Enable notifications'} emoji="🔔" selected={data.notifications === 'enabled'} onPress={enableNotifications} />
            <Choice label="Not now" selected={data.notifications !== 'enabled'} onPress={() => { set('notifications', 'later'); }} />
            <Text style={{ color: C.mutedText, fontSize: 12, lineHeight: 18, marginTop: 12 }}>Your profile lives in More, your child's details in their profile, and your dashboard preferences in More → Dashboard.</Text>
          </>}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderColor: C.borderLight, backgroundColor: C.white }}>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={next} style={{ backgroundColor: C.primaryPurple, borderRadius: 18, minHeight: 54, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1, padding: 14 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 }}>{step === 0 ? "Let's grow together →" : step === 4 ? 'Make it mine →' : 'Continue →'}</Text>}
        </TouchableOpacity>
        <Text style={{ textAlign: 'center', color: C.mutedText, fontSize: 11, marginTop: 8 }}>{preview ? 'Preview only · no account changes are saved' : step === 0 ? 'Five little steps. A space made for you.' : 'Progress saved when you continue. Change choices later.'}</Text>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, lineHeight: 36, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1.5, borderRadius: 14, padding: 16, fontFamily: 'NunitoSans_600SemiBold', fontSize: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
});
