import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { createSubscriptionSession } from './subscriptionSession';

export function useProSubscription(uid) {
  const [access, setAccess] = useState({ uid: null, pro: false });
  const session = useRef(null);
  useEffect(() => {
    let alive = true;
    let mirroredPlan;
    let writes = Promise.resolve();
    setAccess({ uid, pro: false });
    const current = createSubscriptionSession({
      purchases: Purchases,
      uid,
      apiKey: Platform.OS === 'ios'
        ? 'appl_xNGjmEgufsXuWySnKebRetuKCGj'
        : 'goog_rcHUTFIPkKdXdEAQHcexulBdpOj',
      onInfo: (_info, pro) => {
        setAccess({ uid, pro });
        const plan = pro ? 'pro' : 'free';
        // Serialize writes so a delayed upgrade cannot overwrite a downgrade.
        writes = writes.then(async () => {
          if (!alive || auth.currentUser?.uid !== uid || mirroredPlan === plan) return;
          await updateDoc(doc(db, 'users', uid), { plan });
          mirroredPlan = plan;
        }).catch((error) => console.warn('Could not sync subscription plan:', error));
      },
      onError: (error) => {
        // A failed verification must not preserve access indefinitely.
        // Do not persist a downgrade for a temporary network failure.
        setAccess({ uid, pro: false });
        console.warn('Could not verify subscription:', error);
      },
    });
    session.current = current;
    current.refresh();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') current.refresh();
    });
    // Listeners alone do not fetch changes from RevenueCat. Poll while open
    // to catch expiration/refunds even if the user never backgrounds the app.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') current.refresh();
    }, 60000);
    return () => {
      alive = false;
      current.dispose();
      foreground.remove();
      clearInterval(timer);
      if (session.current === current) session.current = null;
    };
  }, [uid]);
  return {
    isPro: access.uid === uid && access.pro,
    getOfferings: () => session.current.offerings(),
    purchase: (pkg) => session.current.purchase(pkg),
    restore: () => session.current.restore(),
  };
}
