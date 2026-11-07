const fontKey = "kid-games.font";
const toggle = document.querySelector("#opendyslexic-toggle");
const status = document.querySelector("#font-status");

function applyFont(enabled) {
  document.documentElement.classList.toggle("opendyslexic", enabled);
  toggle.checked = enabled;
}

try {
  const saved = localStorage.getItem(fontKey);
  if (saved === null || saved === "default" || saved === "opendyslexic") {
    applyFont(saved === "opendyslexic");
  } else {
    console.warn("Saved font preference is no longer valid.");
    status.textContent = "Your saved font isn't available. You can choose OpenDyslexic below.";
  }
} catch (error) {
  if (!(error instanceof DOMException)) throw error;
  console.warn("Unable to read font preference:", error);
  status.textContent = "We couldn't read your saved font. You can still choose one.";
}

toggle.addEventListener("change", () => {
  applyFont(toggle.checked);
  try {
    localStorage.setItem(fontKey, toggle.checked ? "opendyslexic" : "default");
    status.textContent = "";
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    console.warn("Unable to save font preference:", error);
    status.textContent = "Your font works for now, but this browser couldn't save it for next time.";
  }
});

document.querySelector(".font-preference").hidden = false;
