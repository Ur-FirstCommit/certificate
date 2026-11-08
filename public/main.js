const $ = (selector) => document.querySelector(selector);
const config = window.FIRSTCOMMIT_CONFIG ?? {};
const configured = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl ?? "") &&
  typeof config.supabasePublishableKey === "string" &&
  config.supabasePublishableKey.length > 20 &&
  !config.supabasePublishableKey.includes("YOUR_");

const emailForm = $("#email-form");
const nameForm = $("#name-form");
const emailInput = $("#email");
const fullNameInput = $("#full-name");
const status = $("#status-message");
const sentPanel = $("#email-sent");
const setupNotice = $("#setup-notice");
const steps = {
  email: $("#claim-step-email"),
  name: $("#claim-step-name"),
  ready: $("#claim-step-ready"),
};

let supabase;
let jsPDF;
let currentCertificate;
let activeEmail = "";

function showStatus(message, kind = "error") {
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("is-success", kind === "success");
}

function clearStatus() {
  status.hidden = true;
  status.textContent = "";
  status.classList.remove("is-success");
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (busy) {
    button.dataset.originalLabel = button.querySelector("span")?.textContent ?? "";
    const text = button.querySelector("span");
    if (text) text.textContent = label;
  } else {
    const text = button.querySelector("span");
    if (text && button.dataset.originalLabel) text.textContent = button.dataset.originalLabel;
  }
}

function setStep(step) {
  Object.entries(steps).forEach(([key, element]) => { element.hidden = key !== step; });
  const order = ["email", "name", "ready"];
  document.querySelectorAll("[data-progress]").forEach((element) => {
    const index = order.indexOf(element.dataset.progress);
    const current = order.indexOf(step);
    element.classList.toggle("is-current", index === current);
    element.classList.toggle("is-done", index < current);
  });
  clearStatus();
}

function readableAuthError(error) {
  const params = new URLSearchParams(location.search);
  new URLSearchParams(location.hash.slice(1)).forEach((value, key) => params.set(key, value));
  const description = params.get("error_description");
  if (description || params.get("error_code") === "otp_expired" || /expired|invalid.*link|otp_expired/i.test(error?.message ?? "")) return "That sign-in link is invalid or has expired. Request a fresh link to continue.";
  if (/rate limit|too many/i.test(error?.message ?? "")) return "A link was requested recently. Please wait a moment before trying again.";
  return "We couldn’t complete that step. Please check your connection and try again.";
}

function certificateCopy(result) {
  if (result.certificateType === "award") {
    return {
      title: "Your award certificate is ready.",
      description: `You’ve been recognized for ${result.awardName}. Here’s a lasting record of what you built.`,
      certificateTitle: "Certificate of Achievement",
      distinction: result.awardName,
    };
  }
  return {
    title: "Your participation certificate is ready.",
    description: "You showed up, learned by building, and made something real. That’s worth celebrating.",
    certificateTitle: "Certificate of Participation",
    distinction: "Beginner’s Paradise Hackathon · 2026",
  };
}

function renderCertificate(result, fullName) {
  const copy = certificateCopy(result);
  currentCertificate = { ...result, fullName, ...copy };
  $("#result-title").textContent = copy.title;
  $("#result-copy").textContent = copy.description;
  $("#result-name").textContent = fullName;
  $("#result-award").textContent = result.certificateType === "award" ? result.awardName : "Certificate of Participation";
  setStep("ready");
}

function saveCertificate() {
  if (!currentCertificate || !jsPDF) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const width = 297;
  const height = 210;
  const cert = currentCertificate;
  const ink = [17, 28, 47];
  const blue = [65, 101, 218];

  doc.setFillColor(248, 250, 253);
  doc.rect(0, 0, width, height, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 12, width - 24, height - 24, 2, 2, "F");
  doc.setDrawColor(211, 221, 238);
  doc.setLineWidth(.45);
  doc.roundedRect(16, 16, width - 32, height - 32, 1.5, 1.5, "S");
  doc.setDrawColor(...blue);
  doc.setLineWidth(1.1);
  doc.line(29, 33, 62, 33);
  doc.line(width - 62, 33, width - 29, 33);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FIRSTCOMMIT", width / 2, 32, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(29);
  doc.text(cert.certificateTitle, width / 2, 66, { align: "center" });
  doc.setTextColor(104, 117, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("THIS IS PROUDLY PRESENTED TO", width / 2, 87, { align: "center" });
  doc.setTextColor(...ink);
  doc.setFont("times", "bold");
  const nameSize = cert.fullName.length > 28 ? 24 : 31;
  doc.setFontSize(nameSize);
  const nameLines = doc.splitTextToSize(cert.fullName, 220);
  doc.text(nameLines, width / 2, 105, { align: "center", lineHeightFactor: 1.1 });
  const detailY = nameLines.length > 1 ? 135 : 126;
  doc.setDrawColor(217, 225, 238);
  doc.line(width / 2 - 45, detailY - 7, width / 2 + 45, detailY - 7);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(cert.distinction, width / 2, detailY, { align: "center", maxWidth: 235 });
  doc.setTextColor(105, 118, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Beginner’s Paradise Hackathon · 2026", width / 2, detailY + 12, { align: "center" });

  const issued = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date());
  doc.setDrawColor(211, 221, 238);
  doc.line(37, 165, 89, 165);
  doc.line(width - 89, 165, width - 37, 165);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FIRSTCOMMIT", 63, 172, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(121, 133, 151);
  doc.setFontSize(8);
  doc.text("ORGANIZING TEAM", 63, 177, { align: "center" });
  doc.text(issued, width - 63, 172, { align: "center" });
  doc.text("DATE ISSUED", width - 63, 177, { align: "center" });
  doc.setTextColor(148, 159, 176);
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.text(`RECORD  ${String(cert.claimId ?? "FIRSTCOMMIT").slice(0, 18).toUpperCase()}`, width / 2, 190, { align: "center" });

  const slug = cert.fullName.trim().normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "builder";
  doc.save(`firstcommit-certificate-${slug}.pdf`);
}

async function sendMagicLink(email) {
  clearStatus();
  const button = $("#email-form button[type=submit]");
  setBusy(button, true, "Sending your link…");
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}${location.pathname}`,
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
    activeEmail = email;
    $("#sent-email").textContent = email;
    emailForm.hidden = true;
    sentPanel.hidden = false;
    showStatus("Secure link sent. Check your email to keep going.", "success");
  } catch (error) {
    showStatus(readableAuthError(error));
  } finally {
    setBusy(button, false);
  }
}

function enterNameStep(user) {
  activeEmail = user.email ?? activeEmail;
  $("#verified-email").textContent = activeEmail;
  emailForm.hidden = true;
  sentPanel.hidden = true;
  setStep("name");
  fullNameInput.focus({ preventScroll: true });
}

async function initialize() {
  if (!configured) {
    setupNotice.hidden = false;
    emailForm.querySelector("button").disabled = true;
    return;
  }

  try {
    const [{ createClient }, pdfModule] = await Promise.all([
      import("https://esm.sh/@supabase/supabase-js@2.117.1"),
      import("https://esm.sh/jspdf@2.5.2"),
    ]);
    jsPDF = pdfModule.jsPDF;
    supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user?.email_confirmed_at) enterNameStep(data.session.user);
    else {
      const params = new URLSearchParams(location.search);
      new URLSearchParams(location.hash.slice(1)).forEach((value, key) => params.set(key, value));
      if (params.has("error") || params.has("error_description")) {
        const message = readableAuthError();
        history.replaceState(null, "", location.pathname);
        showStatus(message);
      }
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email_confirmed_at && ["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)) {
        enterNameStep(session.user);
      }
      if (event === "SIGNED_OUT") {
        emailForm.hidden = false;
        sentPanel.hidden = true;
        setStep("email");
      }
    });
  } catch (error) {
    showStatus(readableAuthError(error));
    emailForm.querySelector("button").disabled = true;
  }
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  if (!emailInput.reportValidity()) return;
  const email = emailInput.value.trim().toLowerCase();
  await sendMagicLink(email);
});

$("#resend-link").addEventListener("click", async () => {
  if (!activeEmail) return;
  await sendMagicLink(activeEmail);
});

nameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  const fullName = fullNameInput.value.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 100) {
    showStatus("Enter a name between 2 and 100 characters.");
    fullNameInput.focus();
    return;
  }
  const button = nameForm.querySelector("button[type=submit]");
  setBusy(button, true, "Finding your certificate…");
  try {
    const { data, error } = await supabase.functions.invoke("claim-certificate", { body: { fullName } });
    if (error) throw error;
    if (!data || !["award", "participation"].includes(data.certificateType)) throw new Error("Invalid certificate response");
    renderCertificate(data, fullName);
  } catch {
    showStatus("We couldn’t find your certificate right now. Your details have not been submitted; please try again.");
  } finally {
    setBusy(button, false);
  }
});

$("#download-pdf").addEventListener("click", saveCertificate);
$("#sign-out").addEventListener("click", async () => {
  await supabase.auth.signOut();
  emailForm.reset();
});
$("#claim-again").addEventListener("click", async () => {
  await supabase.auth.signOut();
  emailForm.reset();
  fullNameInput.value = "";
});

initialize();
