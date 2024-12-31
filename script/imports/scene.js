import Matter from "matter-js";
import * as d3 from "d3";

const { Engine, Render, Runner, Composite, Bodies, Body, Mouse, MouseConstraint, Query, Bounds, Events } = Matter;

window.fruits = [];
window.data = recoverData();

const width = 1600;
const height = 1600;
const wall = 1600;
const ground = 63;
const radius = 36;
const debounce = 1000;

// TODO: Consider if these need to be on window
window.hoveredFruit = false;
window.deltaTime = 0; // Should be in seconds, not ms

let lastTimestamp = 0;
let draggedFruit = false;
let treetop = false;
let flower = false;
// let hoverTimeout = false;

let hitboxes = {}; // for cart and bin regions detection

const collision = {
  default: 0x0001,
  treetop: 0x0002,
  fruits: 0x0004,
  hitboxes: 0x0008,
};

const fields = document.querySelector(".fields");
const tree = document.querySelector(".tree");
const clearButton = document.querySelector(".clear");
// const emptyButton = document.querySelector(".empty");

const xScale = d3.scaleLinear().domain([320, 1280]).range([0, 100]).clamp(true);
const yScale = d3.scaleLinear().domain([192, 1152]).range([0, 100]).clamp(true);

export default function scene() {
  const engine = Engine.create();
  const { world } = engine;
  engine.gravity.y = 2;

  const options = {
    element: tree,
    engine: engine,
    options: {
      width,
      height,
      background: "transparent",
      wireframes: false,
    },
  };

  const render = Render.create(options);
  Render.run(render);

  const runner = Runner.create();
  Runner.run(runner, engine);

  // Update depth (based custom zIndex property in body.render)
  Events.on(world, "afterAdd", () => {
    updateDepth(world);
  });

  Events.on(world, "afterRemove", () => {
    updateDepth(world);
  });

  data = recoverData();

  treetop = addTreetop(world);
  flower = addFlower(world);
  addWalls(world);
  addCart(world);
  addBin(world);
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
    collisionFilter: {
      // Prevent mouse interactions with hitboxes
      mask: ~collision.hitboxes,
    },
  });

  Composite.add(world, mouseConstraint);
  render.mouse = mouse;

  // Mouse events
  Events.on(mouseConstraint, "startdrag", (event) => {
    const { body } = event;

    if (!isFruit(body)) return;

    draggedFruit = body;

    // Handle overlapping bodies firing multiple startdrag events
    requestAnimationFrame(() => {
      if (mouseConstraint.body !== draggedFruit) return;
      if (!isFruit(draggedFruit)) return;

      // If a frozen circle is clicked, make it dynamic for dragging
      draggedFruit.isStatic = false;
    });
  });

  Events.on(mouseConstraint, "mousemove", (event) => {
    const { mouse } = event;

    if (draggedFruit) {
      if (isInsideRectangle(draggedFruit, treetop)) {
        updateCollision(draggedFruit, collision.fruits);
        updateColor(draggedFruit);
        rotateUp(draggedFruit);
        return;
      }

      if (isInsideRectangle(mouse, hitboxes.bin)) {
        draggedFruit.userData.field.classList.add("bin");
        draggedFruit.collisionFilter.mask = collision.treetop;
      } else {
        draggedFruit.userData.field.classList.remove("bin");
        draggedFruit.collisionFilter.mask = collision.default;
      }

      updateCollision(draggedFruit, collision.default);
    } else {
      // Move flower?
    }
  });

  Events.on(mouseConstraint, "enddrag", (event) => {
    draggedFruit = false;
    const fruit = event.body;

    if (!isFruit(fruit)) return;

    if (isInsideRectangle(fruit, treetop)) {
      rotateUp(fruit);
      fruit.userData.location = "matrix";
      fruit.isStatic = true;
      return;
    }

    if (isInsideRectangle(fruit, hitboxes.bin)) {
      clearFruit(world, fruit);
      return;
    }

    updateCollision(fruit, collision.default);
    fruit.userData.location = "floor";
    fruit.isStatic = false;
  });

  Events.on(mouseConstraint, "mousedown", (event) => {
    if (draggedFruit) return;

    const { x, y } = event.mouse.position;

    // If clicked on tree, add fruit
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

  Events.on(render, "beforeRender", (event) => {
    deltaTime = event.source.timing.delta / 1000;

    updateTransitions(world);
    updateCursor(render, mouse);
    updateCart();
    updateFields();
  });

  // Drop dragged fruit when cursor leaves canvas
  render.canvas.addEventListener("mouseleave", () => {
    const event = new Event("mouseup");
    mouseConstraint.mouse.element.dispatchEvent(event);
  });

  clearButton.addEventListener("click", () => {
    const warning = "Delete all tasks?";
    if (confirm(warning)) {
      clearFruits(world);
    }
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
      visible: false,
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

function addCart(world) {
  const hitbox = Bodies.rectangle(1248, 1392, 384, 288, {
    isStatic: true,
    render: {
      sprite: {
        texture: `./media/sprites/cart.png`,
      },
      zIndex: 3,
    },
    collisionFilter: {
      category: collision.hitboxes,
    },
  });

  hitboxes.cart = hitbox;

  const left = Bodies.rectangle(1072, 1424, 32, 224, {
    isStatic: true,
    friction: 0,
    chamfer: {
      radius: [16, 16, 0, 0],
    },
    render: {
      // fillStyle: "red",
      visible: false,
    },
  });

  const right = Bodies.rectangle(1424, 1424, 32, 224, {
    isStatic: true,
    friction: 0,
    chamfer: {
      radius: [16, 16, 0, 0],
    },
    render: {
      // fillStyle: "red",
      visible: false,
    },
  });

  const bottom = Bodies.rectangle(1248, 1568, 384, 192, {
    isStatic: true,
    friction: 2,
    render: {
      // fillStyle: "red",
      visible: false,
    },
  });

  const cart = [hitbox, left, right, bottom];

  Composite.add(world, cart);
  return cart;
}

function addBin(world) {
  const hitbox = Bodies.rectangle(384, 1432, 128, 208, {
    isStatic: true,
    chamfer: {
      radius: [64, 64, 0, 0],
    },
    render: {
      // fillStyle: "red",
      sprite: {
        texture: `./media/sprites/bin.png`,
      },
    },
    collisionFilter: {
      category: collision.hitboxes,
    },
  });

  const can = Bodies.rectangle(384, 1488, 160, 352, {
    isStatic: true,
    friction: 0,
    chamfer: {
      radius: [80, 80, 0, 0],
    },
    render: {
      // fillStyle: "blue",
      visible: false,
    },
    collisionFilter: {
      category: collision.default,
    },
  });

  hitboxes.bin = hitbox;

  const bin = [can, hitbox];

  Composite.add(world, bin);
  return bin;
}

function addFlower(world) {
  const flower = Bodies.circle(-32, -32, 32, {
    angle: 0,
    isStatic: true,
    collisionFilter: {
      mask: 0x000,
    },
    render: {
      sprite: {
        texture: `./media/sprites/flower.png`,
      },
      zIndex: 1,
    },
  });

  Composite.add(world, flower);

  return flower;
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
    render: {
      zIndex: 2,
    },
  });

  const field = addField(text);

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
  fields.append(field);

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

function clearFruit(world, fruit) {
  fruit.userData.field.remove();
  Composite.remove(world, fruit);

  const index = fruits.findIndex((item) => item === fruit);

  if (index > -1) {
    fruits.splice(index, 1);
  }
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

      // Prevent typing while dragging or over bin
      field.querySelector("textarea").blur();
    } else {
      field.classList.add("interactive");

      // Give it time to be visible
      requestAnimationFrame(() => {
        // Easily type task of hovered (or newly created) fruit
        field.querySelector("textarea").focus();
      });
    }
  } else {
    // hoverTimeout = setTimeout(() => {
    field.classList.remove("visible");
    // }, 250);
  }
}

function updateCart() {
  const hitbox = "cart";
  const { bounds } = hitboxes[hitbox];

  for (const fruit of fruits) {
    if (fruit.userData.location === "matrix") continue;

    const isInside = Bounds.contains(bounds, fruit.position);

    if (isInside) {
      fruit.userData.location = hitbox;
    }
  }
}

function updateCursor(render, mouse, deltaTime) {
  if (draggedFruit) {
    hoveredFruit = draggedFruit;
    fadeOut(flower);
    return;
  }

  const hover = Query.point(fruits, mouse.position);

  if (hover.length > 0) {
    render.canvas.dataset.cursor = "grab";
    hoveredFruit = hover[0];
    fadeOut(flower);
    return;
  }

  render.canvas.dataset.cursor = "";
  hoveredFruit = false;

  // Move flower to follow mouse
  const { x, y } = mouse.position;
  if (isNaN(x) || isNaN(y)) return;
  Body.setPosition(flower, { x, y });

  // Spin flower
  const angle = flower.angle + 1 * window.deltaTime;
  Body.setAngle(flower, angle);

  if (isInsideRectangle(mouse, treetop)) {
    fadeIn(flower);
    return;
  }

  fadeOut(flower);
}

function updateDepth(world) {
  Composite.allBodies(world).sort((a, b) => {
    const zIndexA = a?.render?.zIndex ? a.render.zIndex : 0;
    const zIndexB = b?.render?.zIndex ? b.render.zIndex : 0;
    return zIndexA - zIndexB;
  });
}

function updateTransitions(world) {
  for (const body of Composite.allBodies(world)) {
    if (body?.render?.transition === undefined) continue;

    for (const property in body.render.transition) {
      const current = body.render[property];
      const target = body.render.transition[property];
      const value = expDecay(current, target);

      if (value === target) {
        delete body.render.transition[property];
        continue;
      }

      body.render[property] = value;
    }
  }
}

function rotateUp(fruit) {
  Body.setAngle(fruit, 0);
  Body.setAngularVelocity(fruit, 0);
}

function isFruit(body) {
  return fruits.includes(body);
}

// By Freya Holmér https://youtu.be/LSNQuFEDOyQ
function expDecay(a, b, decay = 12, dt = deltaTime) {
  return b + (a - b) * Math.exp(-decay * dt);
}

function fadeIn(body) {
  body.render ??= {};
  body.render.transition ??= {};

  body.render.transition.opacity = 1;
  // body.render.opacity = 1;
}

function fadeOut(body) {
  body.render ??= {};
  body.render.transition ??= {};

  body.render.transition.opacity = 0;
  // body.render.opacity = 0;
}
