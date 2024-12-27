import accordion from "./imports/accordion.js";
import tabs from "./imports/tabs.js";

accordion("details");
tabs(".tabs");

const size = 800 * 2;

const config = {
  type: Phaser.AUTO,
  width: size,
  height: size,
  mode: Phaser.Scale.RESIZE,
  parent: "tree",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // resolution: 2, // Automatically scale for 2x assets

  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

const game = new Phaser.Game(config);

function preload() {
  this.load.image("background", "media/sprites/background.png");
}

function create() {
  this.add.image(size / 2, size / 2, "background");
}

function update() {}
