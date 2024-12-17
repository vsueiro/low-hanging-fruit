import * as d3 from "d3";

// Aliases for brevity
const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// Global constants
const treetop = $(".treetop");
const cursor = $(".cursor");
const ripeColor = d3.interpolateHcl("LightSeaGreen", "Tomato");
const ripeScale = d3.scaleLinear().domain([40, 60]).range([0, 1]).clamp(true);

// Global variables
let draggedFruit = null;

// Helpers
function html(string) {
  // Create a DocumentFragment
  const fragment = document.createRange().createContextualFragment(string);

  console.log(...fragment.children);

  // If it has a single child element, return it
  if (fragment.childElementCount === 1) {
    return fragment.firstElementChild;
  }

  // Otherwise, wrap all children in a div and return them
  const div = document.createElement("div");
  div.append(...fragment.children);
  return div;
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
  console.log(element);

  element.style.left = x + "%";
  element.style.top = y + "%";
}

function color(fruit, x) {
  fruit.style.background = ripeColor(ripeScale(x));
}

function focus(fruit) {
  fruit.querySelector("textarea").focus();
}

// Events
treetop.addEventListener("pointermove", (event) => {
  const { x, y } = locate(event, treetop);

  move(cursor, x, y);

  if (draggedFruit) {
    move(draggedFruit, x, y);
    color(draggedFruit, x);
  }
});

document.addEventListener("pointerdown", (event) => {
  const { target } = event;

  const fruit = target.closest(".fruit");

  if (fruit) {
    draggedFruit = fruit;
    draggedFruit.style.zIndex = 3;
    focus(draggedFruit);
  }
});

document.addEventListener("pointerup", () => {
  // Add delay to prevent click from firing
  setTimeout(() => {
    draggedFruit.style.zIndex = 2;
    draggedFruit = null;
  }, 100);
});

treetop.addEventListener("click", (event) => {
  if (draggedFruit) return;

  const { x, y } = locate(event, treetop);
  const fruit = html(`
    <div class="fruit">
      <textarea rows="2" cols="16" placeholder="Task description"></textarea>
    </div>
  `);

  move(fruit, x, y);
  color(fruit, x);

  treetop.append(fruit);

  setTimeout(() => focus(fruit), 250);
});
