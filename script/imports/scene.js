import Matter from "matter-js";
import * as d3 from "d3";

const { Engine, Render, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events } = Matter;

const width = 800;
const height = 800;
const circles = [];
const wall = 800;
const ground = 32;
const radius = 18;
const frozenCircles = new Set();

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
  addCircles(world);

  // Add mouse control
  let draggedBody = false;
  // let rotatedBody = false;

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

  // Update loop
  Events.on(engine, "beforeUpdate", () => {
    for (const circle of circles) {
      if (frozenCircles.has(circle)) {
        circle.isStatic = true; // Ensure frozen circles are fully static
      } else {
        circle.isStatic = false; // Allow unfrozen circles to behave normally
      }
    }
  });

  // Mouse events
  Events.on(mouseConstraint, "startdrag", (event) => {
    const { body } = event;

    if (!body) return;
    if (!circles.includes(body)) return;

    draggedBody = body;

    // Handle overlapping bodies firing multiple startdrag events
    requestAnimationFrame(() => {
      if (mouseConstraint.body === draggedBody) {
        // If a frozen circle is clicked, make it dynamic for dragging
        if (frozenCircles.has(draggedBody)) {
          draggedBody.isStatic = false;
          frozenCircles.delete(draggedBody);
        }
      }
    });
  });

  Events.on(mouseConstraint, "mousemove", () => {
    if (draggedBody) {
      if (!isInsideSquare(draggedBody, treetop)) return;

      updateColor(draggedBody);
      rotateUp(draggedBody);

      console.log(getCoordinatePercentages(draggedBody));
    } else {
    }

    // if (rotatedBody) {
    //   return;
    // }

    // rotatedBody = true;
  });

  Events.on(mouseConstraint, "enddrag", (event) => {
    draggedBody = false;
    // rotatedBody = false;

    const { body } = event;
    if (body && circles.includes(body)) {
      if (isInsideSquare(body, treetop)) {
        rotateUp(body);
        frozenCircles.add(body);
      } else {
        frozenCircles.delete(body);
      }
    }
  });

  // Drop dragged fruit when cursor leaves canvas
  render.canvas.addEventListener("mouseleave", () => {
    const event = new Event("mouseup");
    mouseConstraint.mouse.element.dispatchEvent(event);
  });
}

function isInsideSquare(circle, square) {
  const { x, y } = circle.position;
  const squareBounds = square.bounds;
  return x > squareBounds.min.x && x < squareBounds.max.x && y > squareBounds.min.y && y < squareBounds.max.y;
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

function addCircles(world) {
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;

    // const ripeness = Math.random() < 0.5 ? 0 : 100;

    const circle = Bodies.circle(x, y, radius, {
      restitution: 0.25,
      friction: 2,
      render: {
        sprite: {
          xScale: 0.5,
          yScale: 0.5,
          // texture: `./media/sprites/fruit-ripeness-${ripeness}.png`,
        },
      },
    });

    updateColor(circle);

    circles.push(circle);
  }

  // Adjust circles to avoid collision with the square
  circles.forEach((circle) => {
    circle.collisionFilter = {
      category: 0x0004,
      mask: 0x0001,
    };
  });

  World.add(world, circles);
}

function getCoordinatePercentages(circle) {
  const x = xScale(circle.position.x);
  const y = yScale(circle.position.y);

  return { x, y };
}

function updateColor(circle) {
  const ripeness = circle.position.x < width / 2 ? 0 : 100;
  circle.render.sprite.texture = `./media/sprites/fruit-ripeness-${ripeness}.png`;
}

function rotateUp(circle) {
  // const minAngle = (-30 * Math.PI) / 180;
  // const maxAngle = (30 * Math.PI) / 180;
  // const currentAngle = circle.angle % Math.PI;
  // const isInRange = currentAngle > minAngle && currentAngle < maxAngle;

  // if (isInRange) {
  //   return;
  // }

  // const angle = Matter.Common.random(minAngle, maxAngle);
  // const angle = 0;
  Body.setAngle(circle, 0);
  Body.setAngularVelocity(circle, 0);
}
