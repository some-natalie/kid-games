import { isQuizMode } from "./quiz-engine.js";

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
