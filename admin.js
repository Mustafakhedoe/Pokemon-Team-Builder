// admin.js
import { isAdmin, listAllTeams, deleteTeam, ensureSignedIn } from './api.js';
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// PAS AAN als je een andere admin-email hebt gebruikt
const ADMIN_EMAIL = "admin@ptb.app";

const art = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// wacht tot er een user is
function waitForUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { unsub(); resolve(u); }
    });
  });
}

async function gate() {
  // 1) zorg voor sessie (anoniem als niks)
  await ensureSignedIn();

  // 2) wacht tot Firebase echt een user geeft
  let user = await waitForUser();

  // 3) check admin voor huidige user
  if (await isAdmin(user.uid)) {
    await render();
    return;
  }

  // 4) niet admin → vraag code en login met admin-account
  const code = prompt("Admin code:");
  if (!code) {
    alert("Inloggen vereist");
    location.href = "index.html";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, code.trim());
  } catch (e) {
    console.error("Admin login mislukt:", e);
    alert("Onjuiste code of login mislukt.");
    location.href = "index.html";
    return;
  }

  // 5) opnieuw user + check
  user = await waitForUser();
  if (await isAdmin(user.uid)) {
    await render();
  } else {
    alert("Geen admin-rechten");
    location.href = "index.html";
  }
}

// --------- UI/render ----------
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

async function updateTeam(teamId, newMembers){
  const ref = doc(db, 'teams', teamId);
  await updateDoc(ref, {
    members: newMembers,
    updatedAt: serverTimestamp(),
  });
  alert('Team succesvol aangepast!');
}

// knoppen
const refreshBtn = document.getElementById('refresh');
if (refreshBtn) refreshBtn.onclick = render;

const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.onclick = () => { location.href = 'index.html'; };

const repairBtn = document.getElementById('resetLocal');
if (repairBtn) repairBtn.onclick = async () => {
  // optie: kun je later invullen als nodig
};

// start gate
gate();
