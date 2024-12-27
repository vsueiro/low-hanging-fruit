export default function createAccordions(selector = "details") {
  const targets = document.querySelectorAll(selector);

  function closeAllExcept(target) {
    targets.forEach((details) => {
      if (details !== target) {
        details.removeAttribute("open");
      }
    });
  }

  targets.forEach((target) => {
    target.addEventListener("toggle", () => {
      if (target.open) {
        closeAllExcept(target);
      }
    });
  });
}
