import React, { useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../ThemeContext';
import { completionMessage } from '../onboardingModel';

export function OnboardingCompleteScreen({ user, priority, childName, onPreviewFinish }) {
  const { C } = useTheme();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const message = completionMessage(priority, childName);
  const continueToDashboard = async () => {
    if (saving.current) return;
    if (onPreviewFinish) { onPreviewFinish(); return; }
    saving.current = true; setBusy(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { onboardingWelcome: deleteField() });
      // Root now opens MainApp at its default dashboard page.
    } catch {
      Alert.alert('Almost there', 'Your setup is saved. Check your connection and try opening your dashboard again.');
    } finally { saving.current = false; setBusy(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.screen || C.white }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
      <View style={{ alignItems: 'center' }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 112, height: 112, marginBottom: 24 }} resizeMode="contain" />
        <View style={{ backgroundColor: C.bgPurple, borderRadius: 30, paddingHorizontal: 16, paddingVertical: 9, marginBottom: 22 }}>
          <Text style={{ color: C.primaryPurple, fontFamily: 'NunitoSans_800ExtraBold', fontSize: 12 }}>ALL SET · LET'S GROW 🌱</Text>
        </View>
        <Text accessibilityRole="header" style={{ color: C.primaryPinkDark, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 30, lineHeight: 39, textAlign: 'center', marginBottom: 16 }}>{message.title}</Text>
        <Text style={{ color: C.mutedText, fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 25, textAlign: 'center' }}>{message.body}</Text>
      </View>
      <View style={{ backgroundColor: C.bgPurple, padding: 22, borderRadius: 22, marginTop: 30 }}>
        <Text style={{ fontSize: 30, textAlign: 'center', marginBottom: 10 }}>{message.emoji}</Text>
        <Text style={{ color: C.primaryPinkDark, fontFamily: 'NunitoSans_800ExtraBold', fontSize: 17, textAlign: 'center' }}>Your dashboard is ready</Text>
        <Text style={{ color: C.mutedText, fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }}>Your preferences are in place, with a shortcut to your favourite feature. Take it one little step at a time.</Text>
      </View>
    </ScrollView>
    <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Let's go to my dashboard" disabled={busy} onPress={continueToDashboard} style={{ backgroundColor: C.primaryPurple, borderRadius: 18, minHeight: 56, padding: 16, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 }}>Let's go to my dashboard →</Text>}
      </TouchableOpacity>
      <Text style={{ color: C.mutedText, fontSize: 12, textAlign: 'center', marginTop: 12 }}>{onPreviewFinish ? 'Preview only · no changes saved' : 'Made for your family. Ready when you are.'}</Text>
    </View>
  </SafeAreaView>;
}
