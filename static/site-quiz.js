import { isQuizMode } from "./quiz-engine.js";

const toggle = document.getElementById("quiz-toggle");
if (toggle) {
  toggle.checked = isQuizMode(window.location.search);
  document.getElementById("quiz-setting").hidden = false;
  toggle.addEventListener("change", () => {
    const url = new URL(window.location.href);
    if (toggle.checked) url.searchParams.set("quiz", "1");
    else url.searchParams.delete("quiz");
    window.location.assign(url.href);
  });
}

if (isQuizMode(window.location.search)) {
  document.documentElement.classList.add("quiz-mode");
  import("./quiz-mode.js").catch((error) => {
    console.error("Unable to load quiz mode:", error);
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = "We couldn't load quiz mode. Reload the page to try again.";
    document.querySelector("main").prepend(message);
  });
}
