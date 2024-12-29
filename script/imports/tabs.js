export default function tabs(selector = ".tabs") {
  const inputs = document.querySelectorAll(selector);

  function show(name = "view", value = "tree") {
    const contents = document.querySelectorAll(`[data-tab="${name}"]`);

    contents.forEach((content) => {
      content.hidden = true;

      if (content.dataset.content === value) {
        content.hidden = false;
      }
    });
  }

  inputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      const tab = event.target;

      if (tab.checked) {
        show(tab.name, tab.value);
      }
    });
  });
}
