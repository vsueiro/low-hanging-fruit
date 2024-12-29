import Matter from "matter-js";
import * as d3 from "d3";

const { Engine, Render, Runner, Composite, Bodies, Body, Mouse, MouseConstraint, Query, Events } = Matter;

window.fruits = [];
window.data = recoverData();

const width = 1600;
const height = 1600;
const wall = 1600;
const ground = 63;
const radius = 36;
const debounce = 1000;

let lastTimestamp = 0;
let draggedFruit = false;
window.hoveredFruit = false;
let treetop = false;
// let hoverTimeout = false;

const collision = {
  default: 0x0001,
  treetop: 0x0002,
  fruits: 0x0004,
};

const element = document.querySelector(".tree");
const clearButton = document.querySelector(".clear");
// const emptyButton = document.querySelector(".empty");

const xScale = d3.scaleLinear().domain([320, 1280]).range([0, 100]).clamp(true);
const yScale = d3.scaleLinear().domain([192, 1152]).range([0, 100]).clamp(true);

export default function scene() {
  const engine = Engine.create();
  const { world } = engine;
  engine.gravity.y = 2;

  const options = {
    element: element,
    engine: engine,
    options: {
      width,
      height,
      background: "ghostwhite",
      wireframes: false,
    },
  };

  const render = Render.create(options);
  Render.run(render);

  const runner = Runner.create();
  Runner.run(runner, engine);

  data = recoverData();

  treetop = addTreetop(world);
  addWalls(world);
  addFruits(world);

  // Add mouse control
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: false,
      },
    },
  });
  Composite.add(world, mouseConstraint);
  render.mouse = mouse;

  // Mouse events
  Events.on(mouseConstraint, "startdrag", (event) => {
    const { body } = event;

    if (!body) return;
    if (!fruits.includes(body)) return;

    draggedFruit = body;

    // Handle overlapping bodies firing multiple startdrag events
    requestAnimationFrame(() => {
      if (mouseConstraint.body !== draggedFruit) return;
      if (!fruits.includes(draggedFruit)) return;

      // If a frozen circle is clicked, make it dynamic for dragging
      draggedFruit.isStatic = false;
    });
  });

  Events.on(mouseConstraint, "mousemove", () => {
    if (draggedFruit) {
      if (isInsideRectangle(draggedFruit, treetop)) {
        updateCollision(draggedFruit, collision.fruits);
        updateColor(draggedFruit);
        rotateUp(draggedFruit);
      } else {
        updateCollision(draggedFruit, collision.default);
      }
    } else {
      // Move flower?
    }
  });

  Events.on(mouseConstraint, "enddrag", (event) => {
    draggedFruit = false;

    const { body } = event;

    if (!body) return;
    if (!fruits.includes(body)) return;

    if (isInsideRectangle(body, treetop)) {
      rotateUp(body);
      body.userData.location = "matrix";
      body.isStatic = true;
    } else {
      body.userData.location = "floor";
      body.isStatic = false;
    }

    console.log(body);
  });

  Events.on(mouseConstraint, "mousedown", (event) => {
    if (draggedFruit) return;

    const { x, y } = event.mouse.position;

    if (isInsideRectangle(mouse, treetop)) {
      addFruit(world, x, y);
    }
  });

  // Update loop
  Events.on(engine, "beforeUpdate", (event) => {
    const { timestamp } = event;

    if (timestamp - lastTimestamp > debounce) {
      data = extractData(fruits);
      storeData(data);

      lastTimestamp = timestamp;
    }
  });

  Events.on(render, "beforeRender", () => {
    updateCursor(render, mouse);
    updateFields();
  });

  // Drop dragged fruit when cursor leaves canvas
  render.canvas.addEventListener("mouseleave", () => {
    const event = new Event("mouseup");
    mouseConstraint.mouse.element.dispatchEvent(event);
  });

  clearButton.addEventListener("click", () => {
    clearFruits(world);
  });

  window.addEventListener("beforeunload", () => {
    data = extractData(fruits);
    storeData(data);
  });
}

function isInsideRectangle(body, rectangle) {
  const { x, y } = body.position;
  const { bounds } = rectangle;
  return x > bounds.min.x && x < bounds.max.x && y > bounds.min.y && y < bounds.max.y;
}

function addTreetop(world) {
  const treetop = Bodies.rectangle(800, 672, 960, 960, {
    isStatic: true,
    render: {
      fillStyle: "powderblue",
    },
    collisionFilter: {
      category: collision.treetop,
      mask: collision.fruits,
    },
  });

  Composite.add(world, treetop);

  return treetop;
}

function addWalls(world) {
  const left = Bodies.rectangle(-wall / 2, height / 2, wall, height * 3, {
    isStatic: true,
    friction: 2,
    render: { visible: false },
  });

  const right = Bodies.rectangle(width + wall / 2, height / 2, wall, height * 3, {
    isStatic: true,
    friction: 2,
    render: { visible: false },
  });

  const top = Bodies.rectangle(width / 2, -wall / 2, width * 3, wall, {
    isStatic: true,
    friction: 2,
    render: { visible: false },
  });

  const bottom = Bodies.rectangle(width / 2, height - ground + wall / 2, width * 3, wall, {
    isStatic: true,
    friction: 2,
    render: { fillStyle: "lavender" },
  });

  const walls = [left, right, top, bottom];

  Composite.add(world, walls);
  return walls;
}

function addFruits(world) {
  for (const entry of data) {
    const { x, y, text, angle, ripeness, location } = entry;
    addFruit(world, x, y, text, angle, ripeness, location);
  }
}

function addFruit(world, x, y, text = "", angle = 0, ripeness = undefined, location = "matrix") {
  const fruit = Bodies.circle(x, y, radius, {
    angle: angle,
    restitution: 0.25,
    friction: 2,
    collisionFilter: {
      category: collision.default,
      mask: collision.default,
    },
  });

  const field = addField(text);

  // field.addEventListener("pointerover", () => {
  //   console.log(fruit);
  //   window.hoveredFruit = fruit;
  // });

  fruit.userData = { location, ripeness, field };

  updateColor(fruit, ripeness);
  updateField(fruit);

  fruits.push(fruit);

  Composite.add(world, fruit);

  if (location === "matrix") {
    rotateUp(fruit);
    updateCollision(fruit, collision.fruits);
    fruit.isStatic = true;
  }

  return fruit;
}

function addField(text = "") {
  const field = document.createElement("div");
  field.classList.add("field");

  const textarea = document.createElement("textarea");
  textarea.rows = 2;
  textarea.cols = 16;
  textarea.placeholder = "Task description";
  textarea.value = text;

  field.append(textarea);
  element.append(field);

  return field;
}

function extractData(fruits) {
  const data = [];

  for (const fruit of fruits) {
    const { id, angle } = fruit;
    const { x, y } = fruit.position;
    const { location, ripeness, field } = fruit.userData;
    const { impact, effort } = getAxesValues(fruit);
    const text = field.querySelector("textarea").value;

    const entry = { id, angle, text, x, y, impact, effort, location, ripeness };

    data.push(entry);
  }

  return data;
}

function storeData() {
  const json = JSON.stringify(data);
  localStorage.setItem("data", json);
}

function recoverData() {
  const json = localStorage.getItem("data");
  if (json) return JSON.parse(json);

  return [];
}

function clearFruits(world) {
  for (const fruit of fruits) {
    fruit.userData.field.remove();
    Composite.remove(world, fruit);
  }

  fruits = [];
}

function getAxesValues(fruit) {
  const impact = xScale(fruit.position.x);
  const effort = yScale(fruit.position.y);

  return { impact, effort };
}

function updateColor(fruit, ripeness) {
  if (ripeness === undefined) {
    const { impact } = getAxesValues(fruit);
    ripeness = impact < 50 ? 0 : 100;
  }

  fruit.userData.ripeness = ripeness;
  fruit.render.sprite.texture = `./media/sprites/fruit-ripeness-${ripeness}.png`;
}

function updateCollision(fruit, category) {
  fruit.collisionFilter.category = category;
}

function updateFields() {
  for (const fruit of fruits) {
    updateField(fruit);
  }
}

function updateField(fruit) {
  const { field } = fruit.userData;
  const { x, y } = fruit.position;

  const left = `${(x / width) * 100}%`;
  const top = `${(y / height) * 100}%`;

  field.style.top = top;
  field.style.left = left;

  if (fruit === hoveredFruit) {
    field.classList.add("visible");

    if (fruit === draggedFruit) {
      field.classList.remove("interactive");
    } else {
      field.classList.add("interactive");
    }
  } else {
    // hoverTimeout = setTimeout(() => {
    field.classList.remove("visible");
    // }, 250);
  }
}

function updateCursor(render, mouse) {
  const hover = Query.point(fruits, mouse.position);

  if (hover.length === 0) {
    render.canvas.dataset.cursor = "";
    hoveredFruit = false;
  } else {
    render.canvas.dataset.cursor = "grab";
    hoveredFruit = hover[0];
  }
}

function rotateUp(fruit) {
  Body.setAngle(fruit, 0);
  Body.setAngularVelocity(fruit, 0);
}
