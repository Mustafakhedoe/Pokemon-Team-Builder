// admin.js
import { onUserChanged, isAdmin, listAllTeams, deleteTeam } from './api.js';
import { db } from './firebase.js';
import {
    doc,
    updateDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const art = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// ---- Gate: alleen ingelogde admin ----
onUserChanged(async (user) => {
    if (!user) {
        alert('Inloggen vereist');
        location.href = 'index.html';
        return;
    }
    if (!(await isAdmin(user.uid))) {
        alert('Geen admin-rechten');
        location.href = 'index.html';
        return;
    }
    await render();
});

// ---- Render tabel met teams ----
async function render() {
    const tb = document.getElementById('tbody');
    tb.innerHTML = '';

    const teams = await listAllTeams(); // [{id,name,ownerUid,members,createdAt}, ...]
    if (!teams.length) {
        tb.innerHTML = '<tr><td colspan="5" class="text-muted">Nog geen teams opgeslagen.</td></tr>';
        return;
    }

    teams.sort((a,b)=>(a.name || a.ownerUid).localeCompare(b.name || b.ownerUid));

    teams.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td style="width:20%">${t.name || t.ownerUid}</td>
      <td style="width:15%">${(t.members || []).length}</td>
      <td style="width:35%"></td>
      <td style="width:15%">${t.createdAt?.toDate?.().toLocaleString() || ''}</td>
      <td style="width:15%" class="text-end"></td>`;

        // Teamplaatjes
        const teamTd = tr.children[2];
        (t.members || []).forEach(m => {
            const img = document.createElement('img');
            img.src = art(m.pokemonId);
            img.width = 28; img.height = 28; img.className = 'me-1';
            teamTd.appendChild(img);
        });

        // Acties
        const actTd = tr.children[4];

        // Bewerken
        const edit = document.createElement('button');
        edit.textContent = 'Bewerken';
        edit.className = 'btn btn-sm btn-outline-primary me-2';
        edit.onclick = async () => {
            const current = (t.members || []).map(m => m.pokemonId).join(',');
            const input = prompt('Nieuwe teamleden (komma-gescheiden Pokémon IDs, bv: 1,4,7):', current);
            if (input === null) return;

            const ids = input
                .split(',')
                .map(x => parseInt(x.trim(), 10))
                .filter(n => Number.isInteger(n) && n > 0);

            if (!ids.length) { alert('Geen geldige IDs ingevoerd.'); return; }
            if (ids.length > 10) { alert('Maximaal 10 leden per team.'); return; }

            // verwijder duplicaten
            const seen = new Set();
            const cleaned = [];
            for (const id of ids) {
                if (!seen.has(id)) { seen.add(id); cleaned.push({ pokemonId: id }); }
            }

            try {
                await updateTeam(t.id, cleaned);
                await render();
            } catch (e) {
                console.error('Fout bij aanpassen team:', e);
                alert('Aanpassen mislukt.');
            }
        };
        actTd.append(edit);

        // Verwijderen
        const del = document.createElement('button');
        del.textContent = 'Verwijderen';
        del.className = 'btn btn-sm btn-outline-danger';
        del.onclick = async () => {
            if (confirm('Verwijderen?')) {
                await deleteTeam(t.id);
                await render();
            }
        };
        actTd.append(del);

        tb.appendChild(tr);
    });
}

// ---- Update helper (Firestore) ----
async function updateTeam(teamId, newMembers){
    const ref = doc(db, 'teams', teamId);
    await updateDoc(ref, {
        members: newMembers,             // [{pokemonId:number}]
        updatedAt: serverTimestamp(),
    });
    alert('Team succesvol aangepast!');
}

// ---- Repair: opschonen teams ----
async function repairTeams(){
    console.log('[Repair] start');
    const teams = await listAllTeams();
    let deleted = 0, fixed = 0;

    for (const t of teams){
        const original = Array.isArray(t.members) ? t.members : [];

        // Filter: alleen geldige ints > 0, geen duplicates
        const seen = new Set();
        const cleaned = [];
        for (const m of original){
            const id = Number(m?.pokemonId);
            if (Number.isInteger(id) && id > 0 && !seen.has(id)){
                seen.add(id);
                cleaned.push({ pokemonId: id });
            }
        }

        // Als leeg -> verwijderen
        if (cleaned.length === 0){
            await deleteTeam(t.id);
            deleted++;
            continue;
        }

        // Max 10
        if (cleaned.length > 10) cleaned.length = 10;

        // Bepaal of er iets veranderd is
        const sameLen = cleaned.length === original.length;
        const sameMembers = sameLen && cleaned.every((m, i) => m.pokemonId === Number(original[i]?.pokemonId));
        if (!sameMembers){
            await updateDoc(doc(db, 'teams', t.id), {
                members: cleaned,
                updatedAt: serverTimestamp()
            });
            fixed++;
        }
    }

    alert(`Repair klaar: ${fixed} teams opgeschoond, ${deleted} lege teams verwijderd.`);
    console.log('[Repair] klaar', { fixed, deleted });
    await render();
}

// ---- Knoppen bovenin ----
const refreshBtn = document.getElementById('refresh');
if (refreshBtn) refreshBtn.onclick = render;

const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.onclick = () => { location.href = 'index.html'; };

const repairBtn = document.getElementById('resetLocal');
if (repairBtn) repairBtn.onclick = repairTeams;
