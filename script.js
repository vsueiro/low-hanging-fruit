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
function locate(event, element) {
  const rect = element.getBoundingClientRect();

  const { clientX, clientY } = event;
  const { width, height, left, top } = rect;

  const x = clamp(((clientX - left) / width) * 100);
  const y = clamp(((clientY - top) / height) * 100);

  return { x, y };
}

function move(element, x, y) {
  if (!element) return;

  element.style.left = x + "%";
  element.style.top = y + "%";
}

// Events
treetop.addEventListener("pointermove", (event) => {
  const { x, y } = locate(event, treetop);

  move(cursor, x, y);
  move(draggedElement, x, y);
});

document.addEventListener("pointerdown", (event) => {
  const { target } = event;
  if (target.classList.contains("fruit")) {
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
  // console.log(event.target, draggedElement);

  if (draggedElement) return;

  const { x, y } = locate(event, treetop);
  const fruit = `
    <div class="fruit" style="left: ${x}%; top: ${y}%">
      <textarea rows="4" cols="24" placeholder="Task description"></textarea>
    </div>
  `;

  treetop.append(html(fruit));
});
