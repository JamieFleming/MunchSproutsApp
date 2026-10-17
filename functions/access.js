// Server-only access policy. Profiles and invite documents are never client-readable.
const { randomBytes } = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
function uidOf(request) {
  if (!request.auth?.uid)
    throw new HttpsError("unauthenticated", "Please sign in.");
  return request.auth.uid;
}
function documentId(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 128 ||
    value.includes("/")
  )
    throw new HttpsError("invalid-argument", "Invalid document identifier.");
  return value;
}
async function active(uid) {
  if ((await getFirestore().doc(`accountDeletionJobs/${uid}`).get()).exists)
    throw new HttpsError(
      "failed-precondition",
      "Account deletion is in progress. Retry deletion to finish.",
    );
}
async function reserveQuota(ref, limit) {
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? Number(snap.data().count || 0) : 0;
    if (used >= limit)
      throw new HttpsError(
        "resource-exhausted",
        "Daily limit reached. Please try again tomorrow.",
      );
    tx.set(ref, { count: used + 1 }, { merge: true });
    return used + 1;
  });
}
async function throttle(uid, kind, limit = 20) {
  await active(uid);
  await reserveQuota(
    getFirestore().doc(
      `serverLimits/${uid}/windows/${kind}-${Math.floor(Date.now() / 3600000)}`,
    ),
    limit,
  );
}
function owner(child, uid) {
  if (!child.exists || child.data().userId !== uid || child.data().deleting)
    throw new HttpsError(
      "permission-denied",
      "Only the child owner can manage sharing.",
    );
}
function membership(data, targetUid, email, role, remove) {
  const ids = data.sharedWith || [],
    emails = data.sharedWithEmails || [];
  const members = ids
    .map((uid, i) => ({ uid, email: emails[i] || "" }))
    .filter((x) => x.uid !== targetUid);
  if (!remove) members.push({ uid: targetUid, email });
  const roles = { ...data.sharedWithRoles };
  if (remove) delete roles[targetUid];
  else roles[targetUid] = role === "parent" ? "parent" : "caregiver";
  return {
    sharedWith: members.map((x) => x.uid),
    sharedWithEmails: members.map((x) => x.email),
    sharedWithRoles: roles,
  };
}
async function manageSharing(request) {
  const uid = uidOf(request),
    {
      childId,
      email,
      targetUid,
      remove = false,
      role = "caregiver",
    } = request.data || {};
  const ref = getFirestore().doc(`children/${documentId(childId)}`);
  owner(await ref.get(), uid);
  await throttle(uid, "sharing");
  let target;
  if (remove) target = { uid: documentId(targetUid), email: "" };
  else {
    if (typeof email !== "string" || email.length > 254)
      throw new HttpsError("invalid-argument", "Enter an email address.");
    try {
      target = await getAuth().getUserByEmail(email.trim().toLowerCase());
    } catch (error) {
      if (error.code === "auth/user-not-found")
        throw new HttpsError(
          "not-found",
          "That person needs to create an account first.",
        );
      throw error;
    }
    await active(target.uid);
  }
  if (target.uid === uid)
    throw new HttpsError("invalid-argument", "You cannot share with yourself.");
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    owner(snap, uid);
    const ownerJob = await tx.get(
      getFirestore().doc(`accountDeletionJobs/${uid}`),
    );
    const targetJob = await tx.get(
      getFirestore().doc(`accountDeletionJobs/${target.uid}`),
    );
    if (ownerJob.exists || (!remove && targetJob.exists))
      throw new HttpsError(
        "failed-precondition",
        "Account deletion is in progress.",
      );
    tx.update(
      ref,
      membership(snap.data(), target.uid, target.email || "", role, remove),
    );
  });
  return { success: true };
}
async function generateInviteCode(request) {
  const uid = uidOf(request),
    { childId, role } = request.data || {};
  const db = getFirestore(),
    ref = db.doc(`children/${documentId(childId)}`);
  owner(await ref.get(), uid);
  await throttle(uid, "invite-create");
  const code = randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = Timestamp.fromMillis(Date.now() + 86400000);
  await db.runTransaction(async (tx) => {
    const child = await tx.get(ref);
    owner(child, uid);
    if ((await tx.get(db.doc(`accountDeletionJobs/${uid}`))).exists)
      throw new HttpsError(
        "failed-precondition",
        "Account deletion is in progress.",
      );
    tx.create(db.doc(`inviteCodes/${code}`), {
      childId,
      ownerUid: uid,
      role: role === "parent" ? "parent" : "caregiver",
      expiresAt,
      used: false,
    });
  });
  return { code, expiresAt: expiresAt.toDate().toISOString() };
}
async function joinViaInviteCode(request) {
  const uid = uidOf(request),
    code = String(request.data?.code || "")
      .trim()
      .toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code))
    throw new HttpsError("invalid-argument", "Check the invite code.");
  await throttle(uid, "invite-join", 10);
  const db = getFirestore(),
    ref = db.doc(`inviteCodes/${code}`);
  return db.runTransaction(async (tx) => {
    const invite = await tx.get(ref),
      data = invite.data();
    if (!invite.exists || data.used || data.expiresAt.toMillis() <= Date.now())
      throw new HttpsError(
        "failed-precondition",
        "This invite is invalid, expired or already used.",
      );
    const childRef = db.doc(`children/${documentId(data.childId)}`),
      child = await tx.get(childRef);
    if (
      !child.exists ||
      child.data().deleting ||
      child.data().userId !== data.ownerUid
    )
      throw new HttpsError(
        "failed-precondition",
        "This invite is no longer valid.",
      );
    const ownerJob = await tx.get(
      db.doc(`accountDeletionJobs/${data.ownerUid}`),
    );
    const joinerJob = await tx.get(db.doc(`accountDeletionJobs/${uid}`));
    if (ownerJob.exists || joinerJob.exists)
      throw new HttpsError(
        "failed-precondition",
        "Account deletion is in progress.",
      );
    if (data.ownerUid === uid || (child.data().sharedWith || []).includes(uid))
      throw new HttpsError("already-exists", "You already have access.");
    tx.update(
      childRef,
      membership(
        child.data(),
        uid,
        request.auth.token.email || "",
        data.role,
        false,
      ),
    );
    tx.update(ref, { used: true, usedByUid: uid });
    return { childName: child.data().name || "your child" };
  });
}
async function familyOwnerDetails(request) {
  await active(uidOf(request));
  const uid = uidOf(request),
    ref = getFirestore().doc(`children/${documentId(request.data?.childId)}`),
    child = await ref.get();
  if (!child.exists || !(child.data().sharedWith || []).includes(uid))
    throw new HttpsError("permission-denied", "No access.");
  const user = await getAuth().getUser(child.data().userId);
  return { email: user.email || null };
}
module.exports = {
  uidOf,
  documentId,
  active,
  reserveQuota,
  membership,
  manageSharing,
  generateInviteCode,
  joinViaInviteCode,
  familyOwnerDetails,
};
