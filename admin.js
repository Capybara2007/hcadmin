// HC MONT Admin panel
// Zahteva: Supabase tabela public.termini i Edge Function "posalji-email".

const SUPABASE_URL = "https://iijebacrroyhazwclgtg.supabase.co";
const SUPABASE_KEY = "sb_publishable_WME-nAIH0HpaEzmziyJVGw_qmnU4XVs";
const ADMIN_EMAIL = "adminhcmont@gmail.com";
const EMAIL_FUNCTION = "smooth-processor";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

$("year").textContent = new Date().getFullYear();

let appointments = [];
let isChangingStatus = false;

function message(id, text, type = "") {
  const element = $(id);
  if (!element) return;
  element.textContent = text;
  element.className = ("message " + type).trim();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("sr-RS", {
    dateStyle: "medium", timeStyle: "short"
  }).format(date);
}

function statusClass(status) {
  if (status === "Na čekanju") return "pending";
  if (status === "Potvrđen") return "confirmed";
  if (status === "Završen") return "finished";
  return "rejected";
}

function updateStats() {
  $("pendingCount").textContent = appointments.filter(a => a.status === "Na čekanju").length;
  $("confirmedCount").textContent = appointments.filter(a => a.status === "Potvrđen").length;
  $("finishedCount").textContent = appointments.filter(a => a.status === "Završen").length;
  $("rejectedCount").textContent = appointments.filter(a => a.status === "Odbijen").length;
}

function renderAppointments() {
  const filter = $("statusFilter").value;
  const list = filter === "svi" ? appointments : appointments.filter(a => a.status === filter);

  if (!list.length) {
    $("appointments").innerHTML = '<div class="empty">Nema termina za prikaz.</div>';
    return;
  }

  $("appointments").innerHTML = list.map(a => {
    let actions = "";
    if (a.status === "Na čekanju") {
      actions = `
        <button class="action confirm-btn" data-status="Potvrđen" data-id="${escapeHTML(a.id)}">✓ Potvrdi i pošalji mejl</button>
        <button class="action reject-btn" data-status="Odbijen" data-id="${escapeHTML(a.id)}">✕ Odbij i pošalji mejl</button>`;
    } else if (a.status === "Potvrđen") {
      actions = `
        <button class="action finish-btn" data-status="Završen" data-id="${escapeHTML(a.id)}">✓ Završi posao</button>
        <button class="action reject-btn" data-status="Odbijen" data-id="${escapeHTML(a.id)}">✕ Odbij i pošalji mejl</button>`;
    }

    return `
      <article class="appointment">
        <div class="appointment-top">
          <div>
            <h2>${escapeHTML(a.ime_klijenta)}</h2>
            <p>${escapeHTML(a.usluga)} · ${escapeHTML(formatDate(a.datum_termina))}</p>
          </div>
          <span class="status ${statusClass(a.status)}">${escapeHTML(a.status)}</span>
        </div>
        <div class="details">
          <p><b>Telefon:</b> ${escapeHTML(a.telefon)}</p>
          <p><b>Imejl:</b> ${escapeHTML(a.email)}</p>
          <p><b>Adresa:</b> ${escapeHTML(a.adresa)}</p>
          <p><b>Detalji:</b> ${escapeHTML(a.detalji || "Nema dodatnih informacija")}</p>
          ${a.datum_zavrsetka ? `<p><b>Datum završetka:</b> ${escapeHTML(formatDate(a.datum_zavrsetka))}</p>` : ""}
        </div>
        ${actions ? `<div class="actions">${actions}</div>` : ""}
      </article>`;
  }).join("");
}

async function loadAppointments() {
  $("refreshBtn").disabled = true;
  message("dashboardMessage", "Učitavanje termina...");

  try {
    const { data, error } = await db
      .from("termini")
      .select("id, ime_klijenta, email, telefon, adresa, usluga, datum_termina, status, detalji, datum_zavrsetka")
      .order("datum_termina", { ascending: true });

    if (error) throw error;
    appointments = data || [];
    updateStats();
    renderAppointments();
    message("dashboardMessage", `Učitano termina: ${appointments.length}.`, "success");
  } catch (error) {
    console.error("Učitavanje termina nije uspelo:", error);
    message("dashboardMessage", "Ne mogu da učitam termine. Proveri RLS SELECT pravilo i kolone u tabeli.", "error");
    $("appointments").innerHTML = '<div class="empty">Termini nisu mogli da se učitaju. Otvori konzolu (F12) za detalje.</div>';
  } finally {
    $("refreshBtn").disabled = false;
  }
}

async function sendStatusEmail(id, status) {
  const { data, error } = await db.functions.invoke(EMAIL_FUNCTION, {
    body: { id: Number(id), status }
  });
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function changeStatus(id, status) {
  if (isChangingStatus) return;

  const questions = {
    "Potvrđen": "Da li želiš da potvrdiš ovaj termin i pošalješ klijentu mejl?",
    "Odbijen": "Da li želiš da odbiješ ovaj zahtev i pošalješ klijentu mejl?",
    "Završen": "Da li je posao završen? Sačuvaće se datum završetka."
  };
  if (!questions[status] || !confirm(questions[status])) return;

  isChangingStatus = true;
  const buttons = document.querySelectorAll("#appointments button[data-status]");
  buttons.forEach(button => button.disabled = true);
  message("dashboardMessage", "Čuvanje promene...");

  try {
    const changes = { status };
    if (status === "Završen") changes.datum_zavrsetka = new Date().toISOString();

    const { error } = await db.from("termini").update(changes).eq("id", id);
    if (error) throw error;

    await loadAppointments();

    if (status === "Potvrđen" || status === "Odbijen") {
      message("dashboardMessage", "Status je sačuvan. Šaljem mejl klijentu...");
      try {
        await sendStatusEmail(id, status);
        message("dashboardMessage", "Status je sačuvan i Edge Function je prihvatila zahtev za mejl.", "success");
      } catch (mailError) {
        console.error("Slanje mejla nije uspelo:", mailError);
        message("dashboardMessage", "Status je sačuvan, ali mejl nije poslat. Proveri Edge Function, Resend i sender domen.", "error");
      }
    } else {
      message("dashboardMessage", "Posao je označen kao završen i datum je sačuvan.", "success");
    }
  } catch (error) {
    console.error("Promena statusa nije uspela:", error);
    message("dashboardMessage", "Promena nije uspela. Proveri UPDATE RLS pravilo i da li kolona datum_zavrsetka postoji.", "error");
  } finally {
    isChangingStatus = false;
    document.querySelectorAll("#appointments button[data-status]").forEach(button => button.disabled = false);
  }
}

async function showDashboard() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    console.error(error);
    message("loginMessage", "Greška pri proveri prijave.", "error");
    return;
  }

  const session = data.session;
  if (!session || (session.user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    if (session) await db.auth.signOut();
    $("loginSection").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    return;
  }

  $("loginSection").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  await loadAppointments();
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("loginBtn").disabled = true;
  message("loginMessage", "Prijavljivanje...");

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  if (email !== ADMIN_EMAIL.toLowerCase()) {
    message("loginMessage", "Ovaj email nema pristup admin panelu.", "error");
    $("loginBtn").disabled = false;
    return;
  }

  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await showDashboard();
  } catch (error) {
    console.error("Prijava nije uspela:", error);
    message("loginMessage", "Prijava nije uspela. Proveri email, lozinku i Supabase Auth korisnika.", "error");
  } finally {
    $("loginBtn").disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  appointments = [];
  $("appointments").innerHTML = "";
  updateStats();
  await showDashboard();
});

$("refreshBtn").addEventListener("click", loadAppointments);
$("statusFilter").addEventListener("change", renderAppointments);

$("appointments").addEventListener("click", async event => {
  const button = event.target.closest("button[data-status]");
  if (!button || button.disabled) return;
  await changeStatus(button.dataset.id, button.dataset.status);
});

showDashboard();
