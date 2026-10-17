// Idempotent, server-owned deletion. Mark first, clean dependants, remove identity last.
// Errors propagate: the account/child stays marked and retry resumes safely.
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const { uidOf, documentId, membership } = require("./access");
const LOGS = ["foodLog", "bottleLog", "weightLog"];
async function removePhoto(uri, ownerUid) {
  if (
    typeof uri !== "string" ||
    !uri.startsWith("https://firebasestorage.googleapis.com/")
  )
    return;
  const url = new URL(uri),
    bucket = getStorage().bucket();
  const prefix = `/v0/b/${bucket.name}/o/`;
  if (!url.pathname.startsWith(prefix)) return;
  const name = decodeURIComponent(url.pathname.slice(prefix.length));
  if (
    !ownerUid ||
    !["childPhotos", "foodPhotos", "profilePhotos"].some((folder) =>
      name.startsWith(`${folder}/${ownerUid}/`),
    )
  )
    return;
  await bucket.file(name).delete({ ignoreNotFound: true });
}
async function removeQuery(query) {
  // Bounded pages prevent loading an entire history into memory.
  for (;;) {
    const page = await query.limit(100).get();
    if (page.empty) return;
    for (const item of page.docs) {
      await removePhoto(item.data().photoUri, item.data().userId);
      await getFirestore().recursiveDelete(item.ref);
    }
  }
}
async function removeChild(childId, uid) {
  const db = getFirestore(),
    ref = db.doc(`children/${documentId(childId)}`);
  const snap = await db.runTransaction(async (tx) => {
    const child = await tx.get(ref);
    if (!child.exists) return null;
    if (child.data().userId !== uid)
      throw new HttpsError(
        "permission-denied",
        "Only the owner can delete this child.",
      );
    tx.update(ref, { deleting: true });
    return child;
  });
  if (!snap) return;
  for (const collection of LOGS)
    await removeQuery(
      db.collection(collection).where("childId", "==", childId),
    );
  await removeQuery(
    db.collection("inviteCodes").where("childId", "==", childId),
  );
  await removePhoto(snap.data().photoUri, uid);
  // Shared editors may have uploaded a replacement under their own Storage UID.
  // Delete only this child's deterministic filename, never arbitrary supplied paths.
  for (const member of [uid, ...(snap.data().sharedWith || [])]) {
    await getStorage()
      .bucket()
      .file(`childPhotos/${member}/${childId}.jpg`)
      .delete({ ignoreNotFound: true });
  }
  await db.recursiveDelete(ref);
}
async function deleteChildData(request) {
  const uid = uidOf(request);
  await removeChild(request.data?.childId, uid);
  return { success: true };
}
async function deleteAccountData(request) {
  const uid = uidOf(request);
  // Checked before ANY destructive operation, unlike client deleteUser at the end.
  const authTime = Number(request.auth.token.auth_time);
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > 300)
    throw new HttpsError(
      "failed-precondition",
      "RECENT_LOGIN_REQUIRED: Please sign out and sign in again before deleting your account.",
    );
  const db = getFirestore(),
    job = db.doc(`accountDeletionJobs/${uid}`);
  await job.set(
    { status: "running", startedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  for (;;) {
    const owned = await db
      .collection("children")
      .where("userId", "==", uid)
      .limit(50)
      .get();
    if (owned.empty) break;
    for (const child of owned.docs) await removeChild(child.id, uid);
  }
  for (;;) {
    const shared = await db
      .collection("children")
      .where("sharedWith", "array-contains", uid)
      .limit(50)
      .get();
    if (shared.empty) break;
    for (const child of shared.docs)
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(child.ref);
        if (fresh.exists)
          tx.update(
            child.ref,
            membership(fresh.data(), uid, "", "caregiver", true),
          );
      });
  }
  for (const collection of [...LOGS, "recipeSuggestions", "supportRequests"])
    await removeQuery(db.collection(collection).where("userId", "==", uid));
  await removeQuery(db.collection("inviteCodes").where("ownerUid", "==", uid));
  await removeQuery(db.collection("inviteCodes").where("usedByUid", "==", uid));
  for (const prefix of ["profilePhotos", "childPhotos", "foodPhotos"])
    await getStorage()
      .bucket()
      .deleteFiles({ prefix: `${prefix}/${uid}/` });
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.recursiveDelete(db.doc(`serverLimits/${uid}`));
  // A marker remains until all work succeeds, so failed cleanup can be retried.
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  // Existing ID tokens can outlive Auth deletion. Keep a private tombstone so
  // those tokens cannot recreate a profile or upload files after cleanup.
  await job.set(
    { status: "completed", completedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { success: true };
}
module.exports = { deleteAccountData, deleteChildData, removeChild };
