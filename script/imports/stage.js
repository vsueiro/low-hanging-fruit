import Matter from "matter-js";
import * as d3 from "d3";

const { Engine, Render, Runner, Composite, Bodies, Body, Mouse, MouseConstraint, Query, Bounds, Events } = Matter;

window.fruits = [];
window.data = recoverData();

const width = 1600;
const height = 1600;
const wall = 1600;
const ground = 64;
const radius = 36;
const debounce = 1000;

// TODO: Consider if these need to be on window
window.hoveredFruit = false;
window.deltaTime = 0; // Should be in seconds, not ms

let lastTimestamp = 0;
let draggedFruit = false;
let treetop = false;
let flower = false;

let hitboxes = {}; // for cart and bin regions detection
let composites = {};

const collision = {
  none: 0x0000,
  default: 0x0001,
  treetop: 0x0002,
  fruits: 0x0004,
  hitboxes: 0x0008,
};

const tabs = document.querySelectorAll(".tabs input");
const tabContents = document.querySelectorAll("[data-tab]");
const fields = document.querySelector(".fields");
const tree = document.querySelector(".tree");
const list = document.querySelector(".list");
const clearButton = document.querySelector(".clear");
const emptyButton = document.querySelector(".empty");

const xScale = d3.scaleLinear().domain([320, 1280]).range([0, 100]).clamp(true);
const yScale = d3.scaleLinear().domain([192, 1152]).range([0, 100]).clamp(true);

export default function stage() {
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

  addTabs();

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
        closeBin();
        return;
      }

      if (isInsideRectangle(mouse, hitboxes.bin)) {
        draggedFruit.userData.field.classList.add("bin");
        draggedFruit.collisionFilter.mask = collision.treetop;
        openBin();
      } else {
        draggedFruit.userData.field.classList.remove("bin");
        draggedFruit.collisionFilter.mask = collision.default;
        closeBin();
      }

      updateCollision(draggedFruit, collision.default);
      return;
    }

    closeBin();
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
    // const warning = "Remove all fruits?";
    // if (confirm(warning)) {
    if (currentTab() === "list") {
      clearFruits(world, 0);
      return;
    }

    clearFruits(world);
    // }
  });

  emptyButton.addEventListener("click", () => {
    // const warning = "Remove fruits from cart?";
    // if (confirm(warning)) {
    emptyCart(world);
    // }
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
    scale: 1,
    collisionFilter: {
      category: collision.hitboxes,
    },
  });

  const left = Bodies.rectangle(1072, 1424, 32, 224, {
    isStatic: true,
    friction: 0,
    chamfer: {
      radius: [16, 16, 0, 0],
    },
    render: {
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
      visible: false,
    },
  });

  const bottom = Bodies.rectangle(1248, 1568, 384, 192, {
    isStatic: true,
    friction: 2,
    render: {
      visible: false,
    },
  });

  hitboxes.cart = hitbox;
  composites.cart = Composite.create();
  Composite.add(composites.cart, [hitbox, left, right, bottom]);
  Composite.add(world, composites.cart);

  return composites.cart;
}

function addBin(world) {
  // Arbirary distance to compensate for chamfer imprecision (moves rectangle up)
  const yOffset = 6;

  const hitbox = Bodies.rectangle(384, 1432 + yOffset, 128, 208, {
    isStatic: true,
    chamfer: {
      radius: [64, 64, 0, 0],
    },
    render: {
      // fillStyle: "red",
      sprite: {
        texture: `./media/sprites/bin-can.png`,
      },
    },
    collisionFilter: {
      category: collision.hitboxes,
    },
  });

  const can = Bodies.rectangle(384, 1488 + yOffset, 160, 352, {
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

  const lid = Bodies.rectangle(384, 1344, 128, 32, {
    isStatic: true,
    render: {
      fillStyle: "green",
      sprite: {
        texture: `./media/sprites/bin-lid.png`,
        xOffset: -0.5,
        yOffset: 0.5,
      },
    },
    collisionFilter: {
      mask: collision.none,
    },
  });

  // Set pivot point to bottom left corner
  Body.setCentre(lid, { x: -64, y: 16 }, true);

  hitboxes.bin = hitbox;
  composites.bin = Composite.create();
  Composite.add(composites.bin, [hitbox, can, lid]);
  Composite.add(world, composites.bin);

  return composites.bin;
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
  grow(fruit);

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

function clearFruits(world, delay = 600) {
  for (const fruit of fruits) {
    clearFruit(world, fruit, delay);
  }

  setTimeout(() => {
    updateList();
  }, delay);
}

function clearFruit(world, fruit, delay = 600) {
  fruit.isStatic = true;
  fruit.userData.field.classList.add("clearing");
  shrink(fruit);

  setTimeout(() => {
    fruit.userData.field.remove();
    Composite.remove(world, fruit);

    const index = fruits.findIndex((item) => item === fruit);
    if (index > -1) fruits.splice(index, 1);
  }, delay);
}

function emptyCart(world) {
  const delay = 600;
  emptyButton.disabled = true;

  for (const body of Composite.allBodies(composites.cart)) {
    const defaultMask = body.collisionFilter.mask;
    body.collisionFilter.mask = collision.none;
    translate(body, 576, 0);

    setTimeout(() => {
      translate(body, -576, 0);

      setTimeout(() => {
        body.collisionFilter.mask = defaultMask;
      }, delay);
    }, delay);
  }

  for (const body of Composite.allBodies(world)) {
    if (!isFruit(body)) continue;
    if (body?.userData?.location !== "cart") {
      const defaultStatic = body.isStatic;

      body.isStatic = true;

      setTimeout(() => {
        body.isStatic = defaultStatic;
      }, delay * 2);

      continue;
    }

    body.collisionFilter.mask = collision.none;
    translate(body, 576, 0);

    setTimeout(() => {
      clearFruit(world, body);
    }, delay);
  }

  setTimeout(() => {
    emptyButton.disabled = false;
  }, delay * 2);
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
  const { bounds } = hitboxes.cart;

  for (const fruit of fruits) {
    if (fruit.userData.location === "matrix") continue;

    const inCart = Bounds.contains(bounds, fruit.position);
    fruit.userData.location = inCart ? "cart" : "floor";
  }
}

function updateCursor(render, mouse) {
  if (draggedFruit) {
    hoveredFruit = draggedFruit;
    shrink(flower);
    return;
  }

  const hover = Query.point(fruits, mouse.position);

  if (hover.length > 0) {
    render.canvas.dataset.cursor = "grab";
    hoveredFruit = hover[0];
    shrink(flower);
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
    render.canvas.dataset.cursor = "pointer";
    grow(flower);
    return;
  }

  shrink(flower);
}

function updateDepth(world) {
  Composite.allBodies(world).sort((a, b) => {
    const zIndexA = a?.render?.zIndex ? a.render.zIndex : 0;
    const zIndexB = b?.render?.zIndex ? b.render.zIndex : 0;
    return zIndexA - zIndexB;
  });
}

function updateTransitionScale(body) {
  const target = body.transition.scale;
  const current = body.scale || 0;
  const value = expDecay(current, target);

  if (value.toFixed(4) === target.toFixed(4)) {
    delete body.transition.scale;
    return;
  }

  body.scale = value;
  body.render.sprite.xScale = value;
  body.render.sprite.yScale = value;
}

function updateTransitionAngle(body) {
  const target = body.transition.angle;
  const current = body.angle || 0;
  const value = expDecay(current, target);

  if (value.toFixed(4) === target.toFixed(4)) {
    delete body.transition.angle;
    return;
  }

  Body.setAngle(body, value);
}

function updateTransitionTranslate(body) {
  const { originalX, originalY } = body.transition.translate;
  const targetX = body.transition.translate.x + originalX;
  const targetY = body.transition.translate.y + originalY;
  const currentX = body.position.x;
  const currentY = body.position.y;
  const valueX = expDecay(currentX, targetX);
  const valueY = expDecay(currentY, targetY);

  if (valueX.toFixed(4) === targetX.toFixed(4)) {
    delete body.transition.translate;
    return;
  }

  Body.setPosition(body, { x: valueX, y: valueY });
}

function updateTransitions(world) {
  for (const body of Composite.allBodies(world)) {
    if (!body.transition) continue;

    for (const property in body.transition) {
      if (property === "scale") {
        updateTransitionScale(body);
        continue;
      }

      if (property === "angle") {
        updateTransitionAngle(body);
        continue;
      }

      if (property === "translate") {
        updateTransitionTranslate(body);
        continue;
      }
    }
  }
}

function openBin() {
  const lid = Composite.allBodies(composites.bin).at(-1);
  angle(lid, (-Math.PI / 2) * 1.5);
}

function closeBin() {
  const lid = Composite.allBodies(composites.bin).at(-1);
  angle(lid, 0);
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

// Set properties to transition
function grow(body, scale = 1) {
  body.transition ??= {};
  body.transition.scale = scale;
}
function shrink(body, scale = 0) {
  body.transition ??= {};
  body.transition.scale = scale;
}
function translate(body, x = 0, y = 0) {
  body.transition ??= {};
  const originalX = body.position.x;
  const originalY = body.position.y;
  body.transition.translate = { x, y, originalX, originalY };
}
function angle(body, radians) {
  body.transition ??= {};
  body.transition.angle = radians;
}

function addTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("change", (event) => {
      const { target } = event;

      if (target.checked) {
        showTab(target.name, target.value);
      }
    });
  });
}

function showTab(name = "view", value = "tree") {
  tabContents.forEach((content) => {
    if (content.dataset.tab !== name) return;

    content.hidden = content.dataset.content !== value;
  });

  if (value === "list") updateList();
}

function currentTab() {
  return Array.from(tabs).find((tab) => tab.checked).value;
}

function updateList() {
  // Clear list
  list.replaceChildren();

  const ul = document.createElement("ul");

  for (const fruit of fruits) {
    const { location, field } = fruit.userData;

    if (location !== "matrix") continue;

    const { texture } = fruit.render.sprite;
    const { impact, effort } = getAxesValues(fruit);
    const text = field.querySelector("textarea").value;
    const item = document.createElement("li");

    item.style.order = Math.floor(100 - impact);

    item.innerHTML = `
      <img src="${texture}" alt="">
      <input type="text" value="${text}" placeholder="Task description">
      <div class="range impact">
        <input type="range" min="0" max="100" value="${impact}" step=".1">
      </div>
      <div class="range effort">
        <input type="range" min="0" max="100" value="${effort}" step=".1">
      </div>
    `;

    ul.append(item);
  }

  list.append(ul);
}
