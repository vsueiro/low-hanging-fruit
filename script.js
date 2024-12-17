// Aliases for brevity
const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// Global variables
const treetop = $(".treetop");
const cursor = $(".cursor");

// Functions
function html(string) {
  return document.createRange().createContextualFragment(string);
}

function getCoords(element, event) {
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  return { x, y };
}

// Events
treetop.addEventListener("pointermove", (event) => {
  const { x, y } = getCoords(treetop, event);
  cursor.style.left = x + "%";
  cursor.style.top = y + "%";

  console.log(x, y);
});

treetop.addEventListener("click", (event) => {
  const { x, y } = getCoords(treetop, event);
  const fruit = `
    <div class="fruit" style="left: ${x}%; top: ${y}%">
      <textarea rows="4" cols="24" placeholder="Task description"></textarea>
    </div>
  `;
  treetop.append(html(fruit));
});
