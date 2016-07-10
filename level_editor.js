/** LEVEL_EDITOR.JS
 * Edit C-ATx5 levels.
 * @author Neill Johnston <neilljohnston30@gmail.com>
 */

// --- Various global variables to be used throughout the game. ---

/**
 * Many important global variables.
 * @global
 */
// Canvas default width and height in tiles.
var CW = 12; var CH = 10;
// Canvas default width and height in pixels.
var CWP = 16 * CW; var CHP = 16 * CH;
// Zoom (scale) level. Defines the scale of the canvas.
var zm = 2;
// Animation delay. Wait this many frames before the next anim step.
var ad = 8;
// Step count of the game.
var sc = 0;
// Useful key codes.
var kc = {
    w: 87, a: 65, s: 83, d: 68,
    shift: 16, space: 32,
    x: 88,
};
// Controls settings. All variables here should reference kc.
var ct = {
    left: kc.a, right: kc.d, up: kc.w, down: kc.s,
    fastscroll: kc.shift,
    del: kc.x,
    code: kc.space,
};

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
 * Loaded sprites and tiles.
 */
var level = {
    tiles: [[]],
    sprites: [[]],
    w: 40,
    h: 10,
    bg: false,
    placeTile: function(x, y, t) {
        if(!this.tiles[x])
            this.tiles[x] = [];
        if(!this.tiles[x][y]) {
            this.tiles[x][y] = t;
            getNeighbors(x, y).forEach( function(t) {
                if(t.connected)
                    t.updateTexture();
            });
        }
    },
    removeTile: function(x, y) {
        if(this.tiles[x] && this.tiles[x][y]) {
            this.tiles[x][y] = false;
            getNeighbors(x, y).forEach( function(t) {
                if(t.connected)
                    t.updateTexture();
            });
        }
    },
    placeSprite: function(x, y, s) {
        if(!this.sprites[x])
            this.sprites[x] = [];
        if(this.sprites[x] && !this.sprites[x][y])
            this.sprites[x][y] = s;
    },
    removeSprite: function(x, y) {
        if(this.sprites[x] && this.sprites[x][y])
            this.sprites[x][y] = false;
    },
};
level.bg = new Background(gfx.bg_nature);

/**
 * The currently selected tile to use in the editor.
 */
var pen = {
    /**
     * Enum-fashioned values for convenience.
     */
    types: {
        T: "Tile",
        CT: "ConnectedTile",
        S: "Sprite",
    },
    // The rest.
    type: false,
    s: gfx.nature,
    sx: 0,
    sy: 0,
    lvlStrCode: "__",
    init: function() {
        this.type = this.types.CT;
        this.lvlStrCode = "nature_ct";
    },
    get: function(x, y) {
        if(this.type === this.types.T) {
            t = new Tile(x, y, this.s, this.sx, this.sy)
            t.lvlStrCode = this.lvlStrCode;
            return t;
        } else if(this.type === this.types.CT) {
            t = new ConnectedTile(x, y, this.s);
            t.lvlStrCode = this.lvlStrCode;
            return t;
        }
        else if(this.type === this.types.S) {
            s = new Sprite(x, y, this.s, this.sx, this.sy);
            s.lvlStrCode = this.lvlStrCode;
            return s;
        }
    },
};
pen.init();

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
        });
        window.addEventListener("keyup", function(evt) {
            gameArea.keys[evt.keyCode] = false;
        });
        window.addEventListener("mousemove", function(evt) {
            bounds = gameArea.canvas.getBoundingClientRect();
            gameArea.mx = Math.floor((evt.clientX - bounds.left) / zm);
            gameArea.my = Math.floor((evt.clientY - bounds.top) / zm);
            if(gameArea.mx > CWP || gameArea.mx < 0 ||
                    gameArea.my > CHP || gameArea.my < 0)
                gameArea.m = false;
        });
        window.addEventListener("mousedown", function(evt) {
            if(evt.button === 0) {
                gameArea.m = true;
                if(gameArea.mx > CWP || gameArea.mx < 0 ||
                        gameArea.my > CHP || gameArea.my < 0)
                    gameArea.m = false;
            } else if(evt.button === 2) {
                gameArea.mrt = true;
                if(gameArea.mx > CWP || gameArea.mx < 0 ||
                        gameArea.my > CHP || gameArea.my < 0)
                    gameArea.mrt = false;
            }
        });
        window.addEventListener("mouseup", function(evt) {
            if(evt.button === 0)
                gameArea.m = false;
            else if(evt.button === 2)
                gameArea.mrt = false;
        });
        window.addEventListener("contextmenu", function(evt) {
            evt.preventDefault();
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
        ctx = gameArea.ctx,
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
    drawLine: function(x, y, ex, ey) {
        ctx = gameArea.ctx,
        ctx.beginPath();
        ctx.moveTo(x * zm, y * zm);
        ctx.lineTo(ex * zm, ey * zm);
        ctx.stroke();
        ctx.closePath();
    },
    clear: function() {
        gameArea.ctx.clearRect(0, 0,
                gameArea.canvas.width, gameArea.canvas.height
        );
    },
    update: function() {
        scrollSpeed = 2;
        if(gameArea.keys && gameArea.keys[ct.fastscroll]) {
            scrollSpeed = 8;
        }
        if(gameArea.keys && gameArea.keys[ct.left]) {
            this.x += -scrollSpeed;
        }
        if(gameArea.keys && gameArea.keys[ct.right]) {
            this.x += scrollSpeed;
        }
        if(this.x < 0) {
            this.x = 0;
        } else if(this.x > level.w * 16 - CWP) {
            this.x = level.w * 16 - CWP;
        }
    }
};

// --- "Editor versions" of the components to the game. ---

/**
 * A generic sprite object that has grid coordinates and maybe animation.
 * @constructor
 * @param {Number} x - Tile coordinates. By default tile coord values are 1/16 of normal coords.
 * @param {Number} y - Tiles coordinates.
 * @param {Image} s - Texture sheet to use, should be from gfx.
 * @param {Number} sx - Grid coordinates of the texture in the graphics sheet.
 * @param {Number} sy - Grid coordinates of the texture in the graphics sheet.
 */
function Sprite(x, y, s, sx, sy) {
    this.x = x * 16;
    this.y = y * 16;
    this.s = s;
    this.sx = sx;
    this.sy = sy;
    this.animLoop = [[sx, sy]];
    this.animIndex = 0;
    /* Update the sprite: redraw graphics and animate. */
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
 * A generic tile object that has grid coordinates and maybe animation.
 * @constructor
 * @param {Number} x - Tile coordinates. By default tile coord values are 1/16 of normal coords.
 * @param {Number} y - Tiles coordinates.
 * @param {Image} s - Texture sheet to use, should be from gfx.
 * @param {Number} sx - Grid coordinates of the texture in the graphics sheet.
 * @param {Number} sy - Grid coordinates of the texture in the graphics sheet.
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
 * A 2-layer parallax background. Exactly the same as in the normal game.
 * @constructor
 * @param {Image} s - The texture sheet to use for this background. Unlike other texture sheets, this is split into two 64x128 halves.
 */
 function Background(s) {
     this.xf = 0; this.yf = CHP - 128;
     this.xb = 0; this.yb = 0;
     this.s = s;
     this.update = function() {
         this.xf = viewArea.x / 2;
         this.xb = viewArea.x / 4;
         for(var x = -64; x <= CWP + 64; x += 64) {
             x_ = x + viewArea.x;
             viewArea.drawImg(x_ - this.xb % 64, this.yb, this.s, 0, 0, 64, 128);
         }
         for(var x = -64; x <= CWP + 64; x += 64) {
             x_ = x + viewArea.x;
             viewArea.drawImg(x_ - this.xf % 64, this.yf, this.s, 4, 0, 64, 128);
         }
     };
 }

// --- Editor-specific components. ---

/**
 * A pop-up menu that resides in the corner of the screen.
 * Kinda breaking style by allowing a non-viewArea object to draw directly with context.
 * @constructor
 * @param {Array} children - An array of MenuChild objects.
 */
function Menu(children) {
    this.toggled = false;
    this.canToggle = true;
    this.children = children;
    this.toggle = function() {
        this.toggled = !this.toggled;
    };
    this.update = function() {
        if(this.toggled) {
            ctx = gameArea.ctx;
            ctx.beginPath();
            ctx.rect(0, 0, CWP * zm, CHP * zm);
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fill();
            yPos = Math.floor(((gameArea.my - 16) * zm) / (8 * zm));
            if(this.children[yPos]) {
                if(gameArea.m)
                    children[yPos].onClick();
                ctx.beginPath();
                ctx.rect(0, 16 * zm + yPos * 8 * zm, CWP * zm, 8 * zm);
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fill();
            }
            for(i in this.children) {
                c = this.children[i];
                c.x =  16 * zm;
                c.y = (24 + i * 8) * zm;
                c.w = (CWP - 32) * zm;
                c.h = 8 * zm;
                ctx.font = 12 * zm + "px Coders-Crux";
                ctx.fillStyle = "#FFFFFF";
                ctx.fillText(c.str, c.x, c.y - zm);
            };
        }
    };
}

/**
 * A child of the menu object.
 * @constructor
 * @param {String} str - The string that shows up in the menu.
 * @param {Function} onClick - What happens when this menu item is clicked.
 */
function MenuChild(str, onClick) {
    this.str = str;
    this.onClick = onClick;
}
m = new Menu([
    new MenuChild("Nature ConnectedTile", function() {
        pen.type = pen.types.CT;
        pen.s = gfx.nature;
        pen.lvlStrCode = "nature_ct";
    }),
    new MenuChild("Crate", function() {
        pen.type = pen.types.T
        pen.s = gfx.nature;
        pen.sx = 0; pen.sy = 7;
        pen.lvlStrCode = "nature_crate";
    }),
    new MenuChild("Player", function() {
        pen.type = pen.types.S;
        pen.s = gfx.cat;
        pen.sx = 1; pen.sy = 0;
        pen.lvlStrCode = "player";
    }),
    new MenuChild("Next ->", function() {
        m_.toggle();
        m.toggle();
    }),
]);
m_ = new Menu([
    new MenuChild("Player", function() {
        pen.type = pen.types.S;
        pen.s = gfx.cat;
        pen.sx = 1; pen.sy = 0;
        pen.lvlStrCode = "player";
    }),
]);

/**
 * A grid to be displayed over the canvas.
 */
var grid = {
    update: function() {
        for(var x = 0; x < CW + 1; x++) {
            viewArea.drawLine(x * 16 - viewArea.x % 16, 0, x * 16 - viewArea.x % 16, CHP);
        }
        for(var y = 0; y < CH + 1; y++) {
            viewArea.drawLine(0, y * 16, CWP, y * 16);
        }
    }
};

/**
 * The essential game engine function, updates the entire game, including (in order)...
 * The viewArea, the background, every tile, and every sprite.
 * Objects are updated in that order or else they would be drawn out of order.
 */
function update() {
    viewArea.clear();
    viewArea.update();
    if(level.bg) {
        level.bg.update();
    }
    level.tiles.forEach( function(x) {
        x.forEach( function(y) {
            if(y.update)
                y.update();
        });
    });
    level.sprites.forEach( function(x) {
        x.forEach( function(y) {
            if(y.update) {
                y.update();
            }
        });
    });
    grid.update();
    if(gameArea.m && !m.toggled) {
        x = Math.floor((gameArea.mx + viewArea.x) / 16);
        y = Math.floor((gameArea.my + viewArea.y) / 16);
        if(!(gameArea.keys && gameArea.keys[ct.del])) {
            if(pen.type === pen.types.CT || pen.type === pen.types.T)
                level.placeTile(x, y, pen.get(x, y));
            else if(pen.type === pen.types.S)
                level.placeSprite(x, y, pen.get(x, y));
        } else {
            if(pen.type === pen.types.CT || pen.type === pen.types.T)
                level.removeTile(x, y);
            else if(pen.type === pen.types.S)
                level.removeSprite(x, y);
        }
    }
    if(gameArea.mrt && m.canToggle) {
        m.toggle();
        m.canToggle = false;
    } else if(!gameArea.mrt) {
        m.canToggle = true;
    }
    m.update();
    m_.update();
    if(gameArea.keys && gameArea.keys[ct.code]) {
        generateCode();
    }
    sc++;
}

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
 * Load an image from the specified source. Used to generate gfx before everything else loads.
 * @param {String} src - File path of the image source.
 * @returns {Image} The newly created image.
 */
function loadImage(src) {
    img = new Image();
    img.src = src;
    return img;
}

// --- Dealing with the level code. ---

/**
 * Generate the code for a level and put it in the appropriate HTML element.
 */
function generateCode() {
    lvlStr = level.w + "," + level.h + "\n";
    lastTile = "_";
    lastTileCount = 0;
    for(var x = 0; x < level.w; x++) {
        if(!level.tiles[x])
            level.tiles[x] = [];
        for(var y = 0; y < level.h; y++) {
            t = level.tiles[x][y];
            if(!t) {
                t = new Tile();
                t.lvlStrCode = "_";
            }
            if(t.lvlStrCode === lastTile) {
                lastTileCount++;
            } else {
                lvlStr += lastTile + "*" + lastTileCount + ",";
                lastTile = t.lvlStrCode;
                lastTileCount = 1;
            }
        }
    }
    lvlStr += lastTile + "*" + lastTileCount + "\n";
    for(var x = 0; x < level.w; x++) {
        if(!level.sprites[x])
            level.sprites[x] = [];
        for(var y = 0; y < level.h; y++) {
            if(level.sprites[x][y])
                lvlStr += level.sprites[x][y].lvlStrCode;
            lvlStr += ",";
        }
    }
    // Insert the new code.
    document.getElementById("level-code").value = lvlStr;
}

/**
 * Load a level from a code, specifically from the code area.
 */
function loadCode() {
    lvlStr = document.getElementById("level-code").value;
    console.log("Loading... \n" + lvlStr);

};

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
