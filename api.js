// api.js
import { auth } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
    collection, addDoc, getDocs, query, where, orderBy, serverTimestamp,
    deleteDoc, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// ---------- AUTH ----------
export async function register(email, password) {
    await createUserWithEmailAndPassword(auth, email, password);
}
export async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
}
export async function logout() { await signOut(auth); }
export function onUserChanged(cb) { return onAuthStateChanged(auth, cb); }

export async function ensureSignedIn() {
    if (!auth.currentUser) await signInAnonymously(auth);
}

export async function isAdmin(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() && snap.data().role === 'admin';
}

// ---------- TEAMS ----------
export async function createTeam(name, members) {
    const user = auth.currentUser;
    if (!user) throw new Error('Niet ingelogd');
    if (!Array.isArray(members) || members.length < 1 || members.length > 10) {
        throw new Error('Team moet 1..10 leden hebben');
    }
    await addDoc(collection(db, 'teams'), {
        name,
        ownerUid: user.uid,
        members,
        createdAt: serverTimestamp(),
    });
}

export async function listMyTeams() {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(
        collection(db, 'teams'),
        where('ownerUid', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listAllTeams() {
    const user = auth.currentUser;
    if (!user || !(await isAdmin(user.uid))) return [];
    const q = query(collection(db, 'teams'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteTeam(teamId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Niet ingelogd');
    await deleteDoc(doc(db, 'teams', teamId));
}

