import * as d3 from "d3";

// Aliases for brevity
const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// Global constants
const treetop = $(".treetop");
const cursor = $(".cursor");
const clearButton = $(".clear");

const ripeColor = d3.interpolateHcl("LightSeaGreen", "Tomato");
const ripeScale = d3.scaleLinear().domain([40, 60]).range([0, 1]).clamp(true);

// Global variables
let draggedFruit = null;
let offsetX = 0;
let offsetY = 0;

// Helpers
function html(string) {
  // Create a DocumentFragment
  const fragment = document.createRange().createContextualFragment(string);

  // console.log(...fragment.children);

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

// Get % postition of pointer inside parent
function locate(event, element) {
  const rect = element.getBoundingClientRect();

  const { clientX, clientY } = event;
  const { width, height, left, top } = rect;

  // Normalize 0-100
  const x = clamp(((clientX - left) / width) * 100);
  const y = clamp(((clientY - top) / height) * 100);

  return { x, y };
}

// Get % postition of fruit center
function center(fruit, element) {
  const fruitRect = fruit.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  const { width, height, left, top } = rect;

  const x = fruitRect.left + fruitRect.width / 2;
  const y = fruitRect.top + fruitRect.height / 2;

  // Normalize 0-100
  const centerX = clamp(((x - left) / width) * 100);
  const centerY = clamp(((y - top) / height) * 100);

  return { centerX, centerY };
}

function move(element, x, y) {
  // console.log(element);

  element.style.left = clamp(x) + "%";
  element.style.top = clamp(y) + "%";
}

function color(fruit, x) {
  fruit.style.background = ripeColor(ripeScale(x));
}

function focus(fruit) {
  fruit.querySelector("textarea").focus();
}

function extractData() {
  const data = [];

  $$(".fruit").forEach((fruit) => {
    const { left, top } = fruit.style;
    const x = parseFloat(left) || 0;
    const y = parseFloat(top) || 0;
    const text = fruit.querySelector("textarea").value.trim();

    data.push({ x, y, text });
  });

  return data;
}

function storeData() {
  const data = extractData();
  const json = JSON.stringify(data);

  localStorage.setItem("fruits", json);
}

function recoverData() {
  const json = localStorage.getItem("fruits");
  if (!json) return;

  const data = JSON.parse(json);

  data.forEach((item) => {
    const { x, y, text } = item;
    createFruit(x, y, text);
  });
}

function createFruit(x = 0, y = 0, text = "") {
  const fruit = html(`
    <div class="fruit">
      <textarea rows="2" cols="16" placeholder="Task description"></textarea>
    </div>
  `);

  move(fruit, x, y);
  color(fruit, x);

  treetop.append(fruit);

  const textarea = fruit.querySelector("textarea");

  textarea.value = text;
  textarea.oninput = storeData;

  return fruit;
}

function removeFruit(fruit, batch = false) {
  fruit.remove();

  if (!batch) {
    storeData();
  }
}

function removeFruits() {
  const fruits = $$(".fruit");

  fruits.forEach((fruit) => {
    removeFruit(fruit, "batch");
  });

  storeData();
}

// Instructions
recoverData();

// Events
clearButton.addEventListener("click", () => {
  removeFruits();
});

treetop.addEventListener("pointermove", (event) => {
  const { x, y } = locate(event, treetop);

  move(cursor, x, y);

  if (draggedFruit) {
    move(draggedFruit, x - offsetX, y - offsetY);
    color(draggedFruit, x);

    storeData();
  }
});

document.addEventListener("pointerdown", (event) => {
  const { target } = event;

  const fruit = target.closest(".fruit");

  if (fruit) {
    const { x, y } = locate(event, treetop);
    const { centerX, centerY } = center(fruit, treetop);
    offsetX = x - centerX;
    offsetY = y - centerY;

    draggedFruit = fruit;
    draggedFruit.style.zIndex = 3;
    focus(draggedFruit);
  }
});

document.addEventListener("pointerup", () => {
  offsetX = 0;
  offsetY = 0;

  // Add delay to prevent click from firing
  setTimeout(() => {
    if (draggedFruit) draggedFruit.style.zIndex = 2;
    draggedFruit = null;
  }, 100);
});

treetop.addEventListener("click", (event) => {
  if (draggedFruit) return;

  const { x, y } = locate(event, treetop);

  const fruit = createFruit(x, y);
  setTimeout(() => focus(fruit), 250);

  storeData();
});
