// RevenueCat is authoritative; Firestore's plan is only a display mirror.
// Serialize SDK identity changes, including rapid sign-out/sign-in transitions.
let identityQueue = Promise.resolve();

function createSubscriptionSession({ purchases, uid, apiKey, onInfo, onError }) {
  let disposed = false;
  let listening = false;
  let latestRequest = -Infinity;
  let refreshPromise;
  const accept = (info) => {
    if (disposed) return;
    const requested = Date.parse(info.requestDate);
    if (Number.isFinite(requested) && requested < latestRequest) return;
    if (Number.isFinite(requested)) latestRequest = requested;
    onInfo(info, Boolean(info.entitlements.active.pro));
  };
  let ready;
  const ensureReady = () => {
    if (ready) return ready;
    ready = identityQueue.catch(() => {}).then(async () => {
    if (disposed) return;
    if (!(await purchases.isConfigured())) {
      purchases.configure({ apiKey, appUserID: uid });
    } else if ((await purchases.getAppUserID()) !== uid) {
      await purchases.logIn(uid);
    }
    if (disposed) return;
    purchases.addCustomerInfoUpdateListener(accept);
    listening = true;
    }).catch((error) => {
      ready = null; // Allow a later foreground refresh to retry initialization.
      throw error;
    });
    identityQueue = ready;
    return ready;
  };

  const refresh = () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = ensureReady().then(async () => {
      if (disposed) return;
      await purchases.invalidateCustomerInfoCache();
      accept(await purchases.getCustomerInfo());
    }).catch((error) => { if (!disposed) onError(error); })
      .finally(() => { refreshPromise = null; });
    return refreshPromise;
  };
  return {
    refresh,
    async offerings() {
      await ensureReady();
      if (disposed) throw new Error('Subscription session ended. Please sign in again.');
      return purchases.getOfferings();
    },
    async purchase(pkg) {
      await ensureReady();
      if (disposed) throw new Error('Subscription session ended. Please sign in again.');
      const { customerInfo } = await purchases.purchasePackage(pkg);
      accept(customerInfo);
      return disposed ? null : customerInfo;
    },
    async restore() {
      await ensureReady();
      if (disposed) throw new Error('Subscription session ended. Please sign in again.');
      const info = await purchases.restorePurchases();
      accept(info);
      return disposed ? null : info;
    },
    dispose() {
      disposed = true;
      if (listening) purchases.removeCustomerInfoUpdateListener(accept);
    },
  };
}
module.exports = { createSubscriptionSession };
