// Aliases for brevity
const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// Global constants
const treetop = $(".treetop");
const cursor = $(".cursor");

// Global variables
let draggedElement = null;

// Helpers
function html(string) {
  return document.createRange().createContextualFragment(string);
}

function clamp(num, lower = 0, upper = 100) {
  return Math.min(Math.max(num, lower), upper);
}

// Functions
function getCoords(element, event) {
  const rect = element.getBoundingClientRect();

  const { clientX, clientY } = event;
  const { width, height, left, top } = rect;

  const x = clamp(((clientX - left) / width) * 100);
  const y = clamp(((clientY - top) / height) * 100);

  return { x, y };
}

// Events
treetop.addEventListener("pointermove", (event) => {
  const { x, y } = getCoords(treetop, event);

  // Update virtual cursor position
  cursor.style.left = x + "%";
  cursor.style.top = y + "%";

  if (draggedElement) {
    // Update dragged fruit position
    draggedElement.style.left = x + "%";
    draggedElement.style.top = y + "%";
  }

  console.log(x, y);
});

document.addEventListener("pointerdown", (event) => {
  const { target } = event;
  if (target.classList.contains("draggable")) {
    draggedElement = target;
  }
});

document.addEventListener("pointerup", () => {
  // Add delay to prevent click from firing
  setTimeout(() => {
    draggedElement = null;
  }, 100);
});

treetop.addEventListener("click", (event) => {
  if (draggedElement) return;

  const { x, y } = getCoords(treetop, event);
  const fruit = `
    <div class="draggable fruit" style="left: ${x}%; top: ${y}%">
      <textarea rows="4" cols="24" placeholder="Task description"></textarea>
    </div>
  `;

  treetop.append(html(fruit));
});
