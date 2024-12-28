import Matter from "matter-js";
import * as d3 from "d3";

const { Engine, Render, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events } = Matter;

const width = 800;
const height = 800;
const wall = 800;
const ground = 32;
const radius = 18;
const circles = [];

const xScale = d3.scaleLinear().domain([160, 640]).range([0, 100]).clamp(true);
const yScale = d3.scaleLinear().domain([96, 576]).range([0, 100]).clamp(true);

export default function scene(selector) {
  const parent = document.querySelector(selector) || document.body;

  // Create engine and world
  const engine = Engine.create();
  const { world } = engine;
  engine.gravity.y = 2;

  const options = {
    element: parent,
    engine: engine,
    options: {
      width,
      height,
      background: "ghostwhite",
      wireframes: false,
    },
  };

  // Create renderer
  const render = Render.create(options);
  Render.run(render);

  const runner = Runner.create();
  Runner.run(runner, engine);

  const treetop = addTreetop(world);
  addWalls(world);

  // Add mouse control
  let draggedBody = false;

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
  World.add(world, mouseConstraint);
  render.mouse = mouse;

  // Mouse events
  Events.on(mouseConstraint, "startdrag", (event) => {
    const { body } = event;

    if (!body) return;
    if (!circles.includes(body)) return;

    draggedBody = body;

    // Handle overlapping bodies firing multiple startdrag events
    requestAnimationFrame(() => {
      if (mouseConstraint.body !== draggedBody) return;
      if (!circles.includes(draggedBody)) return;

      // If a frozen circle is clicked, make it dynamic for dragging
      draggedBody.isStatic = false;
    });
  });

  Events.on(mouseConstraint, "mousemove", () => {
    if (draggedBody) {
      if (!isInsideRectangle(draggedBody, treetop)) return;

      updateColor(draggedBody);
      rotateUp(draggedBody);

      // console.log(getBodyCoordinates(draggedBody));
    } else {
      // Move flower?
    }
  });

  Events.on(mouseConstraint, "enddrag", (event) => {
    draggedBody = false;

    const { body } = event;

    if (!body) return;
    if (!circles.includes(body)) return;

    if (isInsideRectangle(body, treetop)) {
      rotateUp(body);
      body.isStatic = true;
    } else {
      body.isStatic = false;
    }
  });

  Events.on(mouseConstraint, "mousedown", (event) => {
    if (draggedBody) return;

    const { x, y } = event.mouse.position;

    if (isInsideRectangle(mouse, treetop)) {
      addCircle(x, y, world);
    }
  });

  // Drop dragged fruit when cursor leaves canvas
  render.canvas.addEventListener("mouseleave", () => {
    const event = new Event("mouseup");
    mouseConstraint.mouse.element.dispatchEvent(event);
  });
}

function isInsideRectangle(body, rectangle) {
  const { x, y } = body.position;
  const { bounds } = rectangle;
  return x > bounds.min.x && x < bounds.max.x && y > bounds.min.y && y < bounds.max.y;
}

function addTreetop(world) {
  const treetop = Bodies.rectangle(400, 336, 480, 480, {
    isStatic: true,
    render: {
      fillStyle: "powderblue",
    },
    collisionFilter: {
      category: 0x0002,
      mask: 0x0004,
    },
  });

  World.add(world, treetop);

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

  World.add(world, walls);

  return walls;
}

function addCircle(x, y, world) {
  const circle = Bodies.circle(x, y, radius, {
    restitution: 0.25,
    friction: 2,
    render: {
      sprite: {
        xScale: 0.5,
        yScale: 0.5,
      },
    },
  });

  updateColor(circle);

  circle.collisionFilter = {
    category: 0x0004,
    mask: 0x0001,
  };

  circles.push(circle);

  World.add(world, circle);
}

// function getMouseCoordinates(mouse) {
//   const x = xScale(mouse.position.x);
//   const y = yScale(mouse.position.y);

//   return { x, y };
// }

function getAxesValues(body) {
  const impact = xScale(body.position.x);
  const effort = yScale(body.position.y);

  return { x, y };
}

function updateColor(circle) {
  const ripeness = circle.position.x < width / 2 ? 0 : 100;
  circle.render.sprite.texture = `./media/sprites/fruit-ripeness-${ripeness}.png`;
}

function rotateUp(circle) {
  Body.setAngle(circle, 0);
  Body.setAngularVelocity(circle, 0);
}
