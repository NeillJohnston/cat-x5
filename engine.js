/** ENGINE.JS
 * The thing that runs Catatatatat (C-ATx5).
 * @author Neill Johnston <neilljohnston30@gmail.com>
 */

// --- Various global variables to be used throughout the game. ---

/**
 * Many important global variables.
 * @global
 */
// Canvas default width and height in tiles.
var CW = 10; var CH = 10;
// Canvas default width and height in pixels.
var CWP = 160; var CHP = 160;
// Zoom (scale) level. Defines the scale of the canvas.
var zm = 2;
// Animation delay. Wait this many frames before the next anim step.
var ad = 8;
// Step count of the game.
var sc = 0;
// Useful key codes.
var kc = {
    left: 37, right: 39,
    up: 38, down: 40,
    space: 32,
    w: 87, a: 65, s: 83, d: 68
};
// Controls settings. All variables here should reference kc.
var ct = {
    left: kc.left, right: kc.right,
    jump: kc.up, crouch: kc.down,
    run: kc.a,
    shoot: kc.s
};
// Gravity.
var gravity = .25;

/**
 * Contains referencable Image objects for use in drawing the game graphics.
 * cat: Sprite sheet for the player.
 * tiles: Test graphics tile sheet, should not wind up in final levels.
 * nature: Connected tile sheet with grass, dirt and rocks.
 * bg_nature: Background sheet with some hills and mountains during the day.
 * bg_nature_sunset: Background sheet of bg_nature at sundown.
 * @global
 */
var gfx = {
    cat: loadImage("img/cat.png"),
    particles: loadImage("img/particles.png"),
    tiles: loadImage("img/tiles_default.png"),
    nature: loadImage("img/tiles_nature.png"),
    bg_nature: loadImage("img/background_nature.png"),
    bg_nature_sunset: loadImage("img/background_nature_sunset.png"),
};

/**
 * Main character cat head.
 */
var player;

/**
 * Loaded sprites and tiles. The player should always be level.sprites[0].
 */
var level = {
    tiles: [[]],
    sprites: [player],
    w: 40,
    h: 10,
    bg: false
};

// --- Loading and displaying the game area. ---

/**
 * Used by HTML to load the game. Just a simple entrypoint into the game.
 * @param {Number} zm - Sets the zoom level (scaling) of the canvas.
 */
function load(zm) {
    this.zm = zm;
    gameArea.init();
};

/**
 * Holds the canvas and key listeners.
 */
var gameArea = {
    canvas: document.getElementById("game"),
    init: function() {
        this.canvas.width = CWP * zm;
        this.canvas.height = CHP * zm;
        this.ctx = this.canvas.getContext("2d");
        this.interval = setInterval(update, 16.667);
        this.keys = [];
        window.addEventListener("keydown", function(evt) {
            gameArea.keys[evt.keyCode] = true;
            if(evt.keyCode === kc.up || evt.keyCode === kc.down)
                evt.preventDefault();
        });
        window.addEventListener("keyup", function(evt) {
            gameArea.keys[evt.keyCode] = false;
        });
    }
};

/**
 * "Camera" object, follows the player around and draws graphics to the canvas accordingly.
 */
var viewArea = {
    x: 0,
    y: 0,
    /* Draw an image to the canvas.
     * x, y: image coords.
     * s: sheet to pull graphics from.
     * sx, sy: coordinates in the graphics sheet. */
    drawImg: function(x, y, s, sx, sy, w, h) {
        ctx = gameArea.ctx;
        ctx.imageSmoothingEnabled = false;
        if(!w) {
            w = 16;
        }
        if(!h) {
            h = 16;
        }
        ctx.drawImage(s, sx * 16, sy * 16, w, h,
                x * zm - this.x * zm, y * zm - this.y * zm, w * zm, h * zm
        );
    },
    clear: function() {
        gameArea.ctx.clearRect(0, 0,
                gameArea.canvas.width, gameArea.canvas.height
        );
    }
};

/**
 * The essential game engine function, updates the entire game, including (in order)...
 * The viewArea, the background, every tile, and every sprite.
 * Objects are updated in that order or else they would be drawn out of order.
 */
function update() {
    viewArea.clear();
    viewArea.x = player.x - 72;
    if(viewArea.x < 0) {
        viewArea.x = 0;
    } else if(viewArea.x > level.w * 16 - CWP) {
        viewArea.x = level.w * 16 - CWP;
    }
    if(level.bg) {
        level.bg.update();
    }
    level.tiles.forEach( function(x) {
        x.forEach( function(y) {
            if(y && y.update)
                y.update();
        });
    });
    level.sprites.forEach( function(s) {
        if(s && s.update)
            s.update();
    });
    sc++;
}

// --- Component constructors of the game. ---

/**
 * A generic sprite object that updates its own location and animation.
 * @constructor
 * @param {Number} x - Sprite coordinates.
 * @param {Number} y - Sprite coordinates.
 * @param {Image} s - Texture sheet to use, should be from gfx.
 * @param {Number} sx - Grid coordinates of the sprite in the graphics sheet.
 * @param {Number} sy - Grid coordinates of the sprite in the graphics sheet.
 */
function Sprite(x, y, s, sx, sy) {
    this.x = x;
    this.y = y;
    this.s = s;
    this.sx = sx;
    this.sy = sy;
    this.w = 16;
    this.h = 16;
    this.animLoop = [[sx, sy]];
    this.animIndex = 0;
    this.animSC = sc;
    this.dx = 0;
    this.dy = 0;
    this.hb = {
        x: 0, y: 0,
        w: 16, h: 16
    };
    /* Update the sprite: update position, redraw graphics and animate.
     * Calls updateExtra to aid in creating new sprites. */
    this.update = function() {
        this.x = this.x + this.dx;
        this.y = this.y + this.dy;
        this.dx = Math.round(this.dx * 100) / 100;
        this.dy = Math.round(this.dy * 100) / 100;
        this.updateExtra();
        viewArea.drawImg(this.x, this.y, this.s, this.sx, this.sy);
        // Update animation loop.
        if((sc - this.animSC) % ad === 0) {
            this.animIndex++;
            if(this.animIndex >= this.animLoop.length)
                this.animIndex = 0;
            this.sx = this.animLoop[this.animIndex][0];
            this.sy = this.animLoop[this.animIndex][1];
        }
    };
    /**
     * An empty function, can be extended for use in Sprite.update.
     */
    this.updateExtra = function() {};
}

/**
 * Create a particle, a type of Sprite that destroys itself after its animLoop is run.
 * @constructor
 * @param {Number} x - Sprite coordinates.
 * @param {Number} y - Sprite coordinates.
 * @param {Image} s - Graphics sheet of this particle.
 * @param {Array} animLoop - Animation loop to use (generates sx and sy for the resulting sprite).
 * @returns {Sprite} The newly created particle in Sprite form.
 */
function Particle(x, y, s, animLoop) {
    p = new Sprite(x, y, s, animLoop[0][0], animLoop[0][1]);
    p.animLoop = animLoop;
    p.update = function() {
        viewArea.drawImg(this.x, this.y, this.s, this.sx, this.sy);
        // Update animation loop.
        if(sc % ad === 0) {
            try {
                this.animIndex++;
                if(this.animIndex >= this.animLoop.length)
                    level.sprites.splice(level.sprites.indexOf(this), 1);
                this.sx = this.animLoop[this.animIndex][0];
                this.sy = this.animLoop[this.animIndex][1];
            } catch(err) {
                
            }
        }
    };
    return p;
}

/**
 * A generic tile object that has grid coordinates and maybe animation.
 * @constructor
 * @param {Number} x - Tile coordinates. By default tile coord values are 1/16 of normal coords.
 * @param {Number} y - Tiles coordinates.
 * @param {Image} s - Texture sheet to use, should be from gfx.
 * @param {Number} sx - Grid coordinates of the texture in the graphics sheet.
 * @param {Number} sy - Grid coordinates of the texture in the graphics sheet.
 */
function Tile(x, y, s, sx, sy) {
    this.x = x * 16;
    this.y = y * 16;
    this.s = s;
    this.sx = sx;
    this.sy = sy;
    this.w = 16;
    this.h = 16;
    this.hb = {
        x: 0, y: 0,
        w: this.w, h: this.h
    };
    this.animLoop = [[sx, sy]];
    this.animIndex = 0;
    /* Update the tile: redraw graphics and animate. */
    this.update = function() {
        viewArea.drawImg(this.x, this.y, this.s, this.sx, this.sy);
        // Update animation loop.
        if(sc % ad === 0) {
            this.animIndex++;
            if(this.animIndex >= this.animLoop.length) {
                this.animIndex = 0;
            }
            this.sx = this.animLoop[this.animIndex][0];
            this.sy = this.animLoop[this.animIndex][1];
        }
    };
}

/**
 * An intricate sort of tile that graphically connects to its neighboring ConnectedTiles.
 * Requires a VERY particular texture sheet to be useful.
 * Unlike Tile, ConnectedTile does not need sx and sy - these are generated on level load.
 * @constructor
 * @param {Number} x - Tile coordinates. By default tile coord values are 1/16 of normal coords.
 * @param {Number} y - Tiles coordinates.
 * @param {Image} s - Texture sheet to use, should be from gfx.
 */
function ConnectedTile(x, y, s) {
    /* A var containing possible strings for the connected textures.
     * Looking at a corner (one-fourth) of a tile:
     * c: a corner, h: a horizontal line side, v: a vertical line side,
     * i: an inset corner, and n: (nothing) blank dirt.
     * To make the codes below, start at the top left corner and go clcokwise. */
    this.connected = true;
    connectionMap = {
        "chnv": [0, 0], "hhnn": [1, 0], "hcvn": [2, 0], "nnin": [3, 0], "nnni": [4, 0], "chiv": [5, 0], "hcvi": [6, 0], "ccvv": [7, 0],
        "vnnv": [0, 1], "nnnn": [1, 1], "nvvn": [2, 1], "ninn": [3, 1], "innn": [4, 1], "vihc": [5, 1], "ivch": [6, 1], "vvvv": [7, 1],
        "vnhc": [0, 2], "nnhh": [1, 2], "nvch": [2, 2], "cccc": [3, 2], "chhc": [4, 2], "hhhh": [5, 2], "hcch": [6, 2], "vvcc": [7, 2],
        "hhni": [0, 3], "ivvn": [1, 3], "hhin": [2, 3], "nvvi": [3, 3], "hhii": [4, 3], "ivvi": [5, 3], "nnii": [6, 3], "inni": [7, 3],
        "vniv": [0, 4], "nihh": [1, 4], "vinv": [2, 4], "inhh": [3, 4], "viiv": [4, 4], "iihh": [5, 4], "niin": [6, 4], "iinn": [7, 4],
        "niii": [0, 5], "inii": [1, 5], "iiin": [2, 5], "iini": [3, 5], "inin": [4, 5], "nini": [5, 5], "iiii": [6, 5]
    };
    this.x = x * 16; this.y = y * 16;
    this.s = s;
    this.sx = false; this.sy = false;
    this.w = 16; this.h = 16;
    this.hb = {
        x: 0, y: 0,
        w: this.w, h: this.h
    };
    this.updated = false;
    this.update = function() {
        // Call a texture update on the first draw (when all the tiles are loaded to the level).
        if(!this.updated) {
            this.updateTexture();
            // Now that the tile is updated, it can be drawn.
            this.updated = true;
        } else {
            viewArea.drawImg(this.x, this.y, this.s, this.sx, this.sy);
        }
    };
    /* Update the sx, sy to the correct (connected) texture. */
    this.updateTexture = function() {
        n = getNeighbors(this.x / 16, this.y / 16, this.s);
        idStr = "";
        // Find the value of each corner to create the connection's id.
        [[1, 0, 3], [7, 6, 3], [7, 8, 5], [1, 2, 5]].forEach( function(e) {
            if(!n[e[0]] && !n[e[1]] && !n[e[2]]) {
                idStr += "c";
            } else if(n[e[0]] && !n[e[1]] && !n[e[2]]) {
                idStr += "h";
            } else if(!n[e[0]] && n[e[1]] && !n[e[2]]) {
                idStr += "c";
            } else if(!n[e[0]] && !n[e[1]] && n[e[2]]) {
                idStr += "v";
            } else if(n[e[0]] && n[e[1]] && !n[e[2]]) {
                idStr += "h";
            } else if(!n[e[0]] && n[e[1]] && n[e[2]]) {
                idStr += "v";
            } else if(n[e[0]] && !n[e[1]] && n[e[2]]) {
                idStr += "i";
            } else if(n[e[0]] && n[e[1]] && n[e[2]]) {
                idStr += "n";
            }
        });
        if(connectionMap[idStr]) {
            this.sx = connectionMap[idStr][0];
            this.sy = connectionMap[idStr][1];
        } else {
            this.sx = 7;
            this.sy = 5;
        }
    };
}

/**
 * A tile that breaks when shot by a laser.
 * @constructor
 * @param {Number} x - Tile coordinates. By default tile coord values are 1/16 of normal coords.
 * @param {Number} y - Tiles coordinates.
 * @param {Image} s - Texture sheet to use, should be from gfx.
 * @param {Number} sx - Grid coordinates of the texture in the graphics sheet.
 * @param {Number} sy - Grid coordinates of the texture in the graphics sheet.
 * @param blockType
 */
function BreakableTile(x, y, s, sx, sy, type) {
    /**
     *
     */
    breakableTypes = {
        crate: {s: gfx.particles, animLoop: [[0, 1], [1, 1]]},
    }
    type = breakableTypes[type];
    // Create the tile.
    t = new Tile(x, y, s, sx, sy);
    t.breakable = true;
    t.break = function() {
        level.sprites.push(new Particle(this.x, this.y, type.s, type.animLoop));
        level.tiles[this.x / 16][this.y / 16] = false;
    };
    return t;
}

/**
 * Check collisions between two objects, AABB style.
 * @param {Object} a - One object being checked for collisions. Needs to include a.x, a.y, a.w, and a.h.
 * @param {Object} a.hb - Optional hitbox of a. The next few params explain how it works.
 * @param {Number} a.hb.x - Horizontal displacement of the rectangular hitbox from a.x.
 * @param {Number} a.hb.y - Vertical displacement of the rectangular hitbox from a.y.
 * @param {Number} a.hb.w - Width of the hitbox.
 * @param {Number} a.hb.h - Height of the hitbox.
 * @param {Object} b - The other object to check for collisions. Exactly the same requirements as a.
 * @returns {Object|undefined} Either an object containing .left, .right, .upper, and .lower (the "distance" of the collision) or nothing, if no collision took place.
 */
function col(a, b) {
    ax = a.x; ay = a.y;
    aw = a.w; ah = a.h;
    bx = b.x; by = b.y;
    bw = b.w; bh = b.h;
    if(a.hb) {
        ax += a.hb.x; ay += a.hb.y;
        aw = a.hb.w; ah = a.hb.h;
    }
    if(b.hb) {
        bx += b.hb.x; by += b.hb.y;
        bw = b.hb.w; bh = b.hb.h;
    }
    left = (ax < bx + bw); right = (ax + aw > bx);
    upper = (ay < by + bh); lower = (ay + ah > by);
    if(left && right && upper && lower) {
        return {
            left: bx + bw - ax, right: ax + aw - bx,
            upper: by + bh - ay, lower: ay + ah - by
        };
    }
}

/**
 * A 2-layer parallax background.
 * @constructor
 * @param {Image} s - The texture sheet to use for this background. Unlike other texture sheets, this is split into two 64x128 halves.
 */
function Background(s) {
    this.xf = 0; this.yf = 32;
    this.xb = 0; this.yb = 0;
    this.s = s;
    this.update = function() {
        this.xf = viewArea.x / 2;
        this.xb = viewArea.x / 4;
        [-64, 0, 64, 128, 192].forEach( function(x) {
            x += viewArea.x;
            viewArea.drawImg(x - this.xb % 64, this.yb, this.s, 0, 0, 64, 128);
        }.bind(this));
        [-64, 0, 64, 128, 192].forEach( function(x) {
            x += viewArea.x;
            viewArea.drawImg(x - this.xf % 64, this.yf, this.s, 4, 0, 64, 128);
        }.bind(this));
    };
}

/**
 * Load an image from the specified source. Used to generate gfx before everything else loads.
 * @param {String} src - File path of the image source.
 * @returns {Image} The newly created image.
 */
function loadImage(src) {
    img = new Image();
    img.src = src;
    return img;
}

// --- TESTING PURPOSES ONLY ---
testLevel();
// ---

/**
 * Get the surrounding 8 "neighbor" tiles of the specified tile coordinates.
 * @param {Number} x - Tile coordinates to be checked.
 * @param {Number} y - Tile coordinates to be checked.
 * @param {Image} s - Optional texture sheet. If included, the function assumes that the only relevant neighbors are ConnectedTiles with the same texture sheet.
 */
function getNeighbors(x, y, s) {
    neighbors = [];
    x = Math.floor(x); y = Math.floor(y);
    [-1, 0, 1].forEach( function(dx) {
        [-1, 0, 1].forEach( function(dy) {
            if(level.tiles[x + dx] && level.tiles[x + dx][y + dy]) {
                if((s && s === level.tiles[x + dx][y + dy].s &&
                        level.tiles[x + dx][y + dy].connected) ||
                        !s) {
                    neighbors.push(level.tiles[x + dx][y + dy]);
                } else {
                    neighbors.push(false);
                }
            } else {
                neighbors.push(false);
            }
        });
    });
    return neighbors;
}

/**
 * Loads the player into the world. This function exists primarily because of laziness.
 * @param {Number} x - Sprite coordinates.
 * @param {Number} y - Sprite coordinates.
 */
function loadPlayer(x, y) {
    player = new Sprite(x, y, gfx.cat, 0, 0);
    player.ox = x; player.oy = y;
    player.hb = {
        x: 1, y: 4,
        w: 14, h: 12
    };
    player.animLoop = [[0, 0], [0, 0], [0, 1], [0, 1]];
    player.facing = "right";
    player.maxDy = 6;
    /**
     * Shoot a LAZOR.
     * @param {Number} t: How long (in frames) this laser was being charged. Determines speed of the laser with speed.
     */
    player.shoot = function(t) {
        laser = new Sprite(this.x, this.y, gfx.cat, 2, 4);
        level.sprites.push(laser);
        laser.hb = {
            x: 6, y: 6,
            w: 4, h: 4
        };
        // Return the laser's speed as
        speed = 2 * (Math.floor((Math.min(t, 60) / 30)) + 1);
        if(this.facing === "left")
            laser.dx = -speed;
        else if(this.facing === "right")
            laser.dx = speed;
        // When a laser goes off-screen or hits a tile, it dies.
        laser.updateExtra = function() {
            if(this.x < viewArea.x - 32 || this.x > viewArea.x + 192)
                level.sprites.splice(level.sprites.indexOf(this), 1);
            n = getNeighbors(this.x / 16, this.y / 16);
            n.forEach( function(t) {
                if(col(this, t)) {
                    if(t.breakable)
                        t.break();
                    level.sprites.push(new Particle(this.x, this.y, gfx.particles, [[0, 0], [1, 0]]));
                    level.sprites.splice(level.sprites.indexOf(this), 1);
                }
            }.bind(this));
        }.bind(laser);
    }
    /**
     * Player's updateExtra controls most of its functionality.
     */
    player.updateExtra = function() {
        // Check for collisions with tiles.
        getNeighbors(Math.floor(this.x / 16), Math.floor(this.y / 16))
                .forEach( function(t) {
            colObj = col(this, t);
            if(colObj) {
                minSide = Math.min(colObj.left, colObj.right, colObj.upper, colObj.lower);
                if(minSide === colObj.upper && this.dy < 0 && Math.abs(colObj.upper - Math.min(colObj.left, colObj.right)) > .5) {
                    this.dy = 0;
                    this.y += minSide;
                } else if(minSide === colObj.lower && this.dy > 0) {
                    this.dy = 0;
                    this.y += -minSide;
                } else if(minSide === colObj.left && this.dx < 0) {
                    this.dx = 0;
                    this.x += minSide;
                } else if(minSide === colObj.right && this.dx > 0) {
                    this.dx = 0;
                    this.x += -minSide;
                }
            }
        }.bind(this));
        // Handle [run] key.
        if(gameArea.keys && gameArea.keys[ct.run])
            this.running = true;
        else
            this.running = false;
        // Handle [shoot] key.
        if(gameArea.keys && gameArea.keys[ct.shoot]) {
            if((this.shootCoolDown && this.shootCoolDown <= sc && this.shootCoolDown > 0) || !this.shootCoolDown) {
                this.charging = sc;
                this.shootCoolDown = -1;
            }
        } else if(!gameArea.keys[ct.shoot]) {
            if(this.charging) {
                this.shoot(sc - this.charging);
                this.shootCoolDown = sc + 30;
                if(this.dy > -1)
                    this.dy += -Math.floor(Math.min(sc - this.charging, 60) / 30) * 1.50;
            }
            this.charging = false;
        }
        // Handle [left] movement.
        if(gameArea.keys && gameArea.keys[ct.left]) {
            if(this.running && !this.charging)
                this.dx = accelTo(this.dx, -2.5, -.50);
            else
                this.dx = accelTo(this.dx, -1.5, -.30);
            this.facing = "left";
        }
        // Handle [right] movement.
        if(gameArea.keys && gameArea.keys[ct.right]) {
            if(this.running && !this.charging)
                this.dx = accelTo(this.dx, 2.5, .50);
            else
                this.dx = accelTo(this.dx, 1.5, .30);
            this.facing = "right";
        }
        // Handle no movement keys.
        if(!gameArea.keys[ct.left] && !gameArea.keys[ct.right]) {
            if(this.dx < 0)
                this.dx = accelTo(this.dx, 0, .40);
            else if(this.dx > 0)
                this.dx = accelTo(this.dx, 0, -.40);
        }
        // Handle [jump] key.
        if(gameArea.keys && gameArea.keys[ct.jump]) {
            n = getNeighbors(Math.floor((this.x + 8) / 16), Math.floor((this.y + 8) / 16));
            if(this.dy === 0 && (n[2] || n[5] || n[8]) && this.canJump) {
                this.dy = -4.00;
                this.canJump = false;
            }
            // Float a bit if holding [jump].
            if(this.dy < 0)
                this.dy += -gravity * .40;
            if(this.dy > 0)
                this.dy += -gravity * .60;
        } else if(!gameArea.keys[ct.jump]) {
            this.canJump = true;
        }
        // Handle [crouch] key.
        this.crouching = false;
        if(gameArea.keys && gameArea.keys[ct.crouch]) {
            this.crouching = true;
            this.dx = 0;
        }
        // Change animation loop.
        if(this.charging) {
            // Laser charging animation.
            if(this.facing === "left")
                this.animLoop = [[0, 4], [0, 4], [0, 5], [0, 5]];
            else if(this.facing === "right")
                this.animLoop = [[1, 4], [1, 4], [1, 5], [1, 5]];
        } else if(this.crouching) {
            // Crouching animation.
            if(this.facing === "left")
                this.animLoop = [[0, 3]];
            else if(this.facing === "right")
                this.animLoop = [[1, 3]];
        } else if(this.dy < 0) {
            // Going up animation.
            if(this.facing === "left")
                this.animLoop = [[0, 2]];
            else if(this.facing === "right")
                this.animLoop = [[1, 2]];
        } else {
            // Normal walking/idle animation.
            if(this.facing === "left")
                this.animLoop = [[0, 0], [0, 0], [0, 1], [0, 1]];
            else if(this.facing === "right")
                this.animLoop = [[1, 0], [1, 0], [1, 1], [1, 1]];
        }
        // Accelerate dy with gravity.
        this.dy = accelTo(this.dy, this.maxDy, gravity);
        
        // TEST: Falling out of world!
        if(this.y > 12 * 16) {
            this.x = this.ox;
            this.y = this.oy;
        }
    };
    level.sprites.push(player);
}

// --- Test level generators. ---

/**
 * String codes representing the blocks in the game.
 */
var lvlStrCodes = {
    types: {
        T: "Tiles",
        CT: "ConnectedTile",
        BT: "BreakableTile",
        S: "Sprite",
        P: "Player",
    },
    tiles: {
        CN: {
            type: "ConnectedTile",
            s: gfx.nature,
        },
        BC: {
            type: "BreakableTile",
            s: gfx.nature,
            sx: 0, sy: 7,
            bType: "crate",
        },
    },
    sprites: {
        SP: {
            type: "Player",
        }
    },
    getTile: function(code, x, y) {
        t = this.tiles[code];
        if(t.type === this.types.T)
            return new Tile(x, y, t.s, t.sx, t.sy);
        else if(t.type === this.types.CT)
            return new ConnectedTile(x, y, t.s);
        else if(t.type === this.types.BT)
            return new BreakableTile(x, y, t.s, t.sx, t.sy, t.bType);
    },
    getSprite: function(code, x, y) {
        s = this.sprites[code];
        if(s.type === this.types.P)
            loadPlayer(x, y);
    },
};

/**
 * Load a level from a code, specifically from the code area.
 */
function loadCode() {
    level.tiles = [[]];
    level.sprites = [];
    lvlStr = document.getElementById("level-code").value;
    lvlStr = lvlStr.split("\n");
    level.w = parseInt(lvlStr[0].split(",")[0]);
    level.h = parseInt(lvlStr[0].split(",")[1]);
    for(var i = 0; i < lvlStr[1].length; i+=2) {
        x = Math.floor((i / 2) / level.h);
        y = (i / 2) % level.h;
        if(!level.tiles[x])
            level.tiles[x] = [];
        if(lvlStr[1].substring(i, i + 2) !== "__")
            level.tiles[x][y] = lvlStrCodes.getTile(lvlStr[1].substring(i, i + 2), x, y);
    }
    for(var i = 0; i < lvlStr[2].length; i+=2) {
        x = Math.floor((i / 2) / level.h);
        y = (i / 2) % level.h;
        if(lvlStr[2].substring(i, i + 2) !== "__") {
            lvlStrCodes.getSprite(lvlStr[2].substring(i, i + 2), x * 16, y * 16);
        }
    }
};

/**
 * Procedurally generate (ooh that sounds fancy) a "level" (more like a test jump arena).
 */
function testLevel() {
    level.tiles = [[]];
    floor = 8;
    ceiling = 0;
    for(var x = 0; x < 40; x++) {
        for(var y = floor + randInt(-3, 2); y < 10; y++) {
            if(!level.tiles[x]) {
                level.tiles[x] = [];
            }
            level.tiles[x][y] = new ConnectedTile(x, y, gfx.nature);
            if(Math.random() < 0.20) {
                level.tiles[x][y] = new BreakableTile(x, y, gfx.nature, 0, 7, "crate")
            }
        }
        for(var y = ceiling + randInt(0, 2); y >= 0; y--) {
            if(!level.tiles[x]) {
                level.tiles[x] = [];
            }
            level.tiles[x][y] = new ConnectedTile(x, y, gfx.nature);
        }
    }
    level.bg = new Background(gfx.bg_nature);
    loadPlayer(1*16, 5*16);
}

/**
 * Randomly generate (not as fancy :/ ) a "level" (more like a custerfluck).
 */
function testRandomLevel(pct) {
    level.tiles = [[]];
    for(var x = 0; x < 40; x++) {
        for(var y = 0; y < 10; y++) {
            if(Math.random() < pct) {
                if(!level.tiles[x]) {
                    level.tiles[x] = [];
                }
                level.tiles[x][y] = new ConnectedTile(x, y, gfx.nature);
            }
        }
    }
    level.bg = new Background(gfx.bg_nature_sunset);
    loadPlayer(1*16, 5*16);
}

// --- Math functions that aren't included in Javascript Math (for whatever reason). ---

/**
 * Generate a random integer in range [a, b).
 * @param {Number} a - Inclusive start to the range.
 * @param {Number} b - Exclusive end to the range.
 */
function randInt(a, b) {
    return Math.floor(Math.random() * (b - a) + a);
}

/**
 * Increment a number by a specified acceleration until it hits max.
 * @param {Number} n - number to be accelerated.
 * @param {Number} max - n may not pass this value.
 * @param {Number} a - acceleration (incrementation) of n.
 */
function accelTo(n, max, a) {
    n += a;
    if((a < 0 && n < max) || (a > 0 && n > max)) {
        n = max;
    }
    return n;
}