import Matter from "matter-js";

export default function scene(parent = "#tree") {
  // Import Matter.js
  const { Engine, Render, Runner, World, Bodies, Mouse, MouseConstraint, Events } = Matter;

  // Create engine and world
  const engine = Engine.create();
  const { world } = engine;
  engine.gravity.y = 1;

  const width = 800;
  const height = 800;

  // Create renderer
  const render = Render.create({
    element: document.querySelector(parent) || document.body,
    engine: engine,
    options: {
      width,
      height,
      wireframes: false,
    },
  });
  Render.run(render);

  const runner = Runner.create();
  Runner.run(runner, engine);

  // Add boundaries (walls and floor/ceiling)
  const walls = [
    Bodies.rectangle(width / 2, 0, width, 20, { isStatic: true }), // Top
    Bodies.rectangle(width / 2, height, width, 20, { isStatic: true }), // Bottom
    Bodies.rectangle(0, height / 2, 20, height, { isStatic: true }), // Left
    Bodies.rectangle(width, height / 2, 20, height, { isStatic: true }), // Right
  ];
  World.add(world, walls);

  // Add central square
  const centerSquare = Bodies.rectangle(width / 2, height / 2, 200, 200, {
    isStatic: true,
    render: {
      fillStyle: "rgba(100, 100, 255, 0.5)",
    },
    collisionFilter: {
      category: 0x0002,
      mask: 0x0004,
    },
  });
  World.add(world, centerSquare);

  // Add draggable circles
  const circles = [];
  for (let i = 0; i < 10; i++) {
    const circle = Bodies.circle(Math.random() * width, (Math.random() * height) / 2, 20, {
      restitution: 0.8,
    });
    circles.push(circle);
    World.add(world, circle);
  }

  // Adjust circles to avoid collision with the square
  circles.forEach((circle) => {
    circle.collisionFilter = {
      category: 0x0004,
      mask: 0x0001,
    };
  });

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
  World.add(world, mouseConstraint);
  render.mouse = mouse;

  // Track circles that are "frozen" inside the central square
  const frozenCircles = new Set();

  // Check if a circle is inside the square
  function isInsideSquare(circle, square) {
    const { x, y } = circle.position;
    const squareBounds = square.bounds;
    return x > squareBounds.min.x && x < squareBounds.max.x && y > squareBounds.min.y && y < squareBounds.max.y;
  }

  // Update loop
  Events.on(engine, "beforeUpdate", () => {
    for (const circle of circles) {
      if (frozenCircles.has(circle)) {
        // Keep frozen circles stationary
        Matter.Body.setVelocity(circle, { x: 0, y: 0 });
        Matter.Body.setPosition(circle, circle.position);
        circle.isStatic = true; // Ensure frozen circles are fully static
      } else {
        circle.isStatic = false; // Allow unfrozen circles to behave normally
      }
    }
  });

  // Mouse events
  Events.on(mouseConstraint, "startdrag", (event) => {
    const { body } = event;
    if (body && circles.includes(body)) {
      // If a frozen circle is clicked, make it dynamic for dragging
      if (frozenCircles.has(body)) {
        body.isStatic = false;
        frozenCircles.delete(body);
      }
    }
  });

  Events.on(mouseConstraint, "enddrag", (event) => {
    const { body } = event;
    if (body && circles.includes(body)) {
      if (isInsideSquare(body, centerSquare)) {
        frozenCircles.add(body);
        Matter.Body.setVelocity(body, { x: 0, y: 0 }); // Stop movement immediately
        Matter.Body.setPosition(body, body.position); // Fix position
      } else {
        frozenCircles.delete(body);
      }
    }
  });
}
