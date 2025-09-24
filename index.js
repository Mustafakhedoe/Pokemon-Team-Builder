// index.js
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { createTeam, listMyTeams, ensureSignedIn } from "./api.js";

// --- helpers/state ---
const USERS_KEY = 'ptb_users';
const CURRENT_USER_KEY = 'ptb_current_user';
const CLAIMS_KEY = 'ptb_claims';
const TEAMS_KEY = 'ptb_teams';
const ADMIN_KEY = 'ptb_admin';
const ADMIN_CODE = 'SHAMUS117';
const MAX_TEAM = 10;

const art = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

const BASE_GEN1 = Array.from({ length: 151 }, (_, i) => i + 1);
const EXTRA_INSERTS = [
    { id: 172, position: 'before', ref: 25 },
    { id: 979, position: 'after',  ref: 57 },
    { id: 242, position: 'after',  ref: 113 },
    { id: 196, position: 'after', ref: 136 }, { id: 197, position: 'after', ref: 196 },
    { id: 470, position: 'after', ref: 197 }, { id: 471, position: 'after', ref: 470 },
    { id: 700, position: 'after', ref: 471 },
];
const GEN1 = (() => {
    const order = [...BASE_GEN1];
    EXTRA_INSERTS.forEach(({ id, position, ref }) => {
        const idx = order.indexOf(ref);
        if (idx === -1) return;
        order.splice(position === 'before' ? idx : idx + 1, 0, id);
    });
    return order;
})();

const normalize = s => (s ?? '').toString().trim().toLowerCase();
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const state = {
    users: JSON.parse(localStorage.getItem(USERS_KEY) || '[]'),
    currentUser: localStorage.getItem(CURRENT_USER_KEY) || '',
    claims: JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}'),
    teams: JSON.parse(localStorage.getItem(TEAMS_KEY) || '[]'),
};

// --- functions ---
function registerName(name) {
    const clean = (name || '').trim();
    if (!clean) return false;
    if (!state.users.some(u => normalize(u) === normalize(clean))) {
        state.users.push(clean); save(USERS_KEY, state.users);
    }
    state.currentUser = clean;
    localStorage.setItem(CURRENT_USER_KEY, clean);
    return true;
}
function refreshFromStorage() {
    state.claims = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}');
    state.teams  = JSON.parse(localStorage.getItem(TEAMS_KEY) || '[]');
}
function getMy() {
    return Object.keys(state.claims)
        .filter(id => normalize(state.claims[id]) === normalize(state.currentUser))
        .map(Number);
}

// --- UI ---
function renderGrid() {
    const grid = document.getElementById('grid'); grid.innerHTML = '';
    GEN1.forEach(id => {
        const claimedBy = state.claims[id];
        const isMine = claimedBy && normalize(claimedBy) === normalize(state.currentUser);
        const isTaken = claimedBy && !isMine;

        const col = document.createElement('div'); col.className = 'col-6 col-sm-4 col-md-3 mb-3';
        const card = document.createElement('div'); card.className = 'poke-card text-center p-2 ' + (isTaken ? 'taken' : (isMine ? 'mine' : 'available'));

        const img = document.createElement('img'); img.src = art(id); img.alt = `#${String(id).padStart(3,'0')}`;
        const txt = document.createElement('div'); txt.textContent = `#${String(id).padStart(3,'0')}`;

        card.append(img, txt); col.appendChild(card); grid.appendChild(col);

        if (!isTaken) {
            card.addEventListener('click', () => {
                if (!state.currentUser) {
                    new bootstrap.Modal(document.getElementById('startModal')).show();
                    return;
                }
                toggle(id);
            });
        }
    });
    renderDash();
}

function toggle(id) {
    const claim = state.claims[id];
    if (claim && normalize(claim) !== normalize(state.currentUser)) return;
    if (claim) delete state.claims[id];
    else {
        if (getMy().length >= MAX_TEAM) { alert('Max 10 in je team'); return; }
        state.claims[id] = state.currentUser;
    }
    save(CLAIMS_KEY, state.claims);
    localStorage.setItem('ptb_ping', String(Date.now()));
    renderGrid();
}

function renderDash() {
    const mine = getMy();
    document.getElementById('selectedCount').textContent = mine.length;
    document.getElementById('currentUserText').textContent = state.currentUser ? `Ingelogd als: ${state.currentUser}` : 'Niet ingelogd.';
    const list = document.getElementById('selectedList'); list.innerHTML = '';
    mine.forEach(id => { const img = document.createElement('img'); img.src = art(id); img.width = 48; img.height = 48; img.className = 'me-1'; list.appendChild(img); });
    renderSaved();
}

function renderSaved() {
    const root = document.getElementById('savedTeams'); root.innerHTML = '';
    const sorted = [...state.teams].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    sorted.forEach(t => {
        const row = document.createElement('div'); row.className = 'border rounded p-2';
        const title = document.createElement('div'); title.className = 'fw-semibold mb-1'; title.textContent = t.user; row.appendChild(title);
        (t.team || []).forEach(id => { const img = document.createElement('img'); img.src = art(id); img.width = 36; img.height = 36; img.className = 'me-1'; row.appendChild(img); });
        root.appendChild(row);
    });
}

// --- Events ---
document.getElementById('saveTeam').onclick = async () => {
    if (!state.currentUser) {
        new bootstrap.Modal(document.getElementById('startModal')).show();
        return;
    }
    const mine = getMy();
    if (!mine.length) return alert('Geen Pokémon gekozen');

    try {
        await ensureSignedIn();
        await createTeam(`${state.currentUser} team`, mine.map(id => ({ pokemonId: id })));
        alert('Team opgeslagen!');

        const teams = await listMyTeams();
        state.teams = teams.map(t => ({
            user: state.currentUser,
            team: (t.members || []).map(m => m.pokemonId),
            savedAt: t.createdAt?.toMillis?.() || Date.now()
        }));
        renderSaved();
    } catch (e) {
        console.error('saveTeam error', e);
        alert('Opslaan mislukt');
    }
};

document.getElementById('clearMine').onclick = () => {
    Object.keys(state.claims).forEach(id => { if (normalize(state.claims[id]) === normalize(state.currentUser)) delete state.claims[id]; });
    save(CLAIMS_KEY, state.claims);
    localStorage.setItem('ptb_ping', String(Date.now()));
    renderGrid();
};

document.getElementById('nameForm').onsubmit = e => {
    e.preventDefault();
    if (registerName(document.getElementById('username').value)) {
        document.body.classList.remove('lock');
        renderGrid(); renderSaved();
    }
};
document.getElementById('startForm').onsubmit = e => {
    e.preventDefault();
    if (registerName(document.getElementById('startName').value)) {
        document.body.classList.remove('lock');
        bootstrap.Modal.getInstance(document.getElementById('startModal')).hide();
        renderGrid(); renderSaved();
    }
};

document.getElementById('gotoAdmin').addEventListener('click', e => {
    e.preventDefault();
    const code = prompt('Admin code:');
    if (code && code.trim() === ADMIN_CODE) { localStorage.setItem(ADMIN_KEY, '1'); window.location.href = 'admin.html'; }
    else alert('Onjuiste code.');
});

window.addEventListener('storage', e => {
    if ([CLAIMS_KEY, TEAMS_KEY, 'ptb_ping'].includes(e.key)) {
        refreshFromStorage();
        renderGrid();
    }
});

// --- Firestore sync ---
onAuthStateChanged(auth, async (user) => {
    if (!user) return; // nog niet ingelogd
    console.log("Ingelogd als UID:", user.uid);

    try {
        const teams = await listMyTeams();
        state.teams = teams.map(t => ({
            user: state.currentUser || 'Ik',
            team: (t.members || []).map(m => m.pokemonId),
            savedAt: t.createdAt?.toMillis?.() || Date.now()
        }));
        renderSaved();
    } catch (e) {
        console.error('Teams laden mislukt:', e);
    }
});

// --- Start ---
if (!state.currentUser) {
    document.body.classList.add('lock');
    new bootstrap.Modal(document.getElementById('startModal')).show();
}
document.addEventListener('DOMContentLoaded', () => {
    renderGrid(); renderSaved();
});
