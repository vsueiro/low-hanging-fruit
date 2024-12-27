export default function accordion(selector = "details") {
  const targets = document.querySelectorAll(selector);

  targets.forEach((target) => {
    target.addEventListener("toggle", () => {
      if (target.open) {
        targets.forEach((details) => {
          if (details !== target) {
            details.removeAttribute("open");
          }
        });
      }
    });
  });
}
