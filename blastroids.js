/*jshint browser:true devel:true */
/*global Box2D:true */
"use strict";

var B2Vec2 = Box2D.Common.Math.b2Vec2,
    B2BodyDef = Box2D.Dynamics.b2BodyDef,
    B2Body = Box2D.Dynamics.b2Body,
    B2FixtureDef = Box2D.Dynamics.b2FixtureDef,
    B2Fixture = Box2D.Dynamics.b2Fixture,
    B2World = Box2D.Dynamics.b2World,
    B2MassData = Box2D.Collision.Shapes.b2MassData,
    B2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
    B2CircleShape = Box2D.Collision.Shapes.b2CircleShape,
    B2DebugDraw = Box2D.Dynamics.b2DebugDraw;

//
// Compatability and utility
//
if (typeof Object.getPrototypeOf === 'undefined') {
  Object.getPrototypeOf = function (obj) {
    var type = typeof obj;
    if (!obj || (type !== 'object' && type !== 'function')) {
      throw new TypeError('not an object');
    }
    return obj.__proto__;
  };
}

window.requestAnimationFrame =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function (f) { window.setTimeout(function () { f(Date.now()); }, 1000/60); };

function isA(obj, type) {
  return Object.getPrototypeOf(obj) === type.prototype;
}

function hitBy(obj, type) {
  return obj.hitBy.filter(function (obj) { return isA(obj, type); });
}

function drawObject(context, object) {
  var body = object.body,
      position = body.GetPosition(),
      halfWidth = object.width/2,
      halfHeight = object.height/2;

  if (halfWidth && halfHeight) {
    context.save();
    context.translate(position.x, position.y);
    context.rotate(body.GetAngle());

    if (object.img && object.img.complete) {
      context.drawImage(object.img, -halfWidth, -halfHeight, 2*halfWidth, 2*halfHeight);
    }
  }

  context.restore();
}

function playSound(id) {
  var n = document.getElementById(id).firstElementChild;

  while (n && (n.nodeName !== 'AUDIO' || (n.currentTime > 0 && !n.ended))) {
    n = n.nextElementSibling;
  }

  if (n) n.play();
}

function XplaySound(id) {
  var n = document.getElementById(id);
  n.currentTime = 0;
  n.play();
}

function Scene(world, debugDraw) {
  var listener;

  this.world = world;
  this.gameObjects = [];

  listener = new Box2D.Dynamics.b2ContactListener();

  listener.BeginContact = function(contact) {
    var a = contact.GetFixtureA().GetBody();
    var b = contact.GetFixtureB().GetBody();

    var aUser = a.GetUserData(), bUser = b.GetUserData();
    if (aUser) aUser.hitBy.push(bUser);
    if (bUser) bUser.hitBy.push(aUser);
  };

  world.SetContactListener(listener);
}

Scene.prototype.add = function (object) {
  object.hitBy = [];
  object.body.SetUserData(object);
  this.gameObjects.push(object);
};

Scene.prototype.remove = function (object) {
  object.deleted = true;
};

Scene.prototype.update = function (time) {
  var self = this;

  self.gameObjects.forEach(function(obj) {
    if (obj.update) obj.update(self, time);
  });

  self.gameObjects.forEach(function (o, i) {
    o.hitBy.length = 0;

    if (o.deleted) {
      self.gameObjects.splice(i, 1);
      self.world.DestroyBody(o.body);
    }
  });

  self.world.Step(1/60, 2, 1);
  self.world.ClearForces();
};

Scene.prototype.drawScene = function (context, scale) {
  context.save();
  context.translate(context.canvas.width/2, context.canvas.height/2);
  context.scale(scale, -scale);
  this.gameObjects.forEach(function(obj) { drawObject(context, obj); });
  context.restore();
};

Scene.prototype.drawDebug = function (context, scale) {
  if (!this.debugDraw) {
    this.debugDraw = new B2DebugDraw();
    this.debugDraw.SetSprite(context);
    this.debugDraw.m_sprite.graphics.clear = function () {};
    this.debugDraw.SetDrawScale(scale);
    this.debugDraw.SetFillAlpha(0.3);
    this.debugDraw.SetLineThickness(1.0);
    this.debugDraw.SetFlags(B2DebugDraw.e_shapeBit | B2DebugDraw.e_jointBit);
    this.world.SetDebugDraw(this.debugDraw);
  }

  context.save();
  context.translate(context.canvas.width/2, context.canvas.height/2);
  context.scale(1, -1);
  this.world.DrawDebugData();
  context.restore();
};

//
// BlastroidsPlayer
//
function BlastroidsPlayer() {
  this.score = 0;
}

//
// BlastroidsInputControl
//
function BlastroidsInputControl() {
  var self = this,
      bodyElement = document.getElementsByTagName('body')[0],
      steerTouchId, triggerTouchId, downX = -1, lastX = -1, downY = -1, lastY = -1,
      _leftPressed = false, _rightPressed = false;

  this.steering = 0;
  this.angle = undefined;
  this.throttle = 0;
  this.trigger = false;
  this.bomb = false;

  bodyElement.addEventListener("keydown", function (e) {
    switch (e.keyCode) {
      case 37: // left
        self.steering = 1;
        _leftPressed = true;
        break;
      case 39: // right
        self.steering = -1;
        _rightPressed = true;
        break;
      case 38: // up
        self.throttle = 1;
        break;
      case 32: // space
        self.trigger = true;
        break;
      case 66:
        self.bomb = !self.bomb;
        break;
      default:
        console.log('Unhandled key code: ' + e.keyCode);
    }
  });

  bodyElement.addEventListener("keyup", function (e) {
    switch (e.keyCode) {
      case 37: // left
        self.steering = _rightPressed? -1 : 0;
        _leftPressed = false;
        break;
      case 39: // right
        self.steering = _leftPressed? 1 : 0;
        _rightPressed = false;
        break;
      case 38: // up
        self.throttle = 0;
        break;
      case 32: // space
        self.trigger = false;
        break;
      default:
        console.log('Unhandled key code: ' + e.keyCode);
    }
  });

  function touchWithId(list, id) {
    var i, item;
    for (i = list.length - 1; i >= 0; i--) {
      item = list.item(i);
      if (item.identifier === id) return item;
    }
  }

  bodyElement.addEventListener("touchstart", function (e) {
    var i, item;

    for (i = 0; i < e.changedTouches.length; i++) {
      item = e.changedTouches.item(i);
      if (item.clientX < window.innerWidth/2) {
        if (steerTouchId === undefined) {
          steerTouchId = item.identifier;
          downX = lastX = item.clientX;
          downY = lastY = item.clientY;
        }
      }
      else {
        if (triggerTouchId === undefined) {
          triggerTouchId = item.identifier;
          self.trigger = true;
        }
      }
    }
  });

  bodyElement.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (steerTouchId !== undefined) {
      var t = touchWithId(e.changedTouches, steerTouchId);
      if (t) {
        var dx = t.clientX - lastX, dy = t.clientY - lastY;
        self.angle = -dx/(window.innerWidth/24);
        self.steering = 0;
        self.throttle = Math.max(0, -(t.clientY - downY)/(window.innerHeight/4));

        lastX = t.clientX;
        lastY = t.clientY;
      }
    }
  });

  bodyElement.addEventListener("touchend", function (e) {
    var item = touchWithId(e.changedTouches, steerTouchId);
    if (item) {
      self.throttle = 0;
      steerTouchId = undefined;
    }

    item = touchWithId(e.changedTouches, triggerTouchId);
    if (item) {
      self.trigger = false;
      triggerTouchId = undefined;
    }
  });
}

////////////////////////////////////////////////////////////////////////////////
//
// Wall
//
function Wall(scene, centerX, centerY, width, height) {
  var bdef = new B2BodyDef(), fdef = new B2FixtureDef();
  bdef.type = B2Body.b2_staticBody;
  bdef.position.Set(centerX, centerY);
  fdef.shape = new B2PolygonShape();
  fdef.shape.SetAsBox(width/2, height/2);
  fdef.restitution = 1;

  this.body = scene.world.CreateBody(bdef);
  this.body.CreateFixture(fdef);
  this.width = width;
  this.height = height;
}

//
// Explosion
//
function Explosion(scene, position) {
  var bdef = new B2BodyDef(), fdef = new B2FixtureDef();
  bdef.type = B2Body.b2_staticBody;
  bdef.position.SetV(position);
  fdef.shape = new B2CircleShape();
  fdef.shape.m_radius = 2;
  this.body = scene.world.CreateBody(bdef);
  this.body.CreateFixture(fdef);
  this.body.SetActive(false);

  this.width = this.height = 4;
  this.img = document.getElementById('explosion');
}

Explosion.prototype.update = function (scene, time) {
  if (this.createdAt === undefined) this.createdAt = time;
  else if (this.createdAt + 100 < time) {
    scene.remove(this);
  }
};

//
// Bullet
//
function Bullet(scene, position, angle, velocity) {
  var bdef = new B2BodyDef(), fdef = new B2FixtureDef();
  bdef.type = B2Body.b2_dynamicBody;
  bdef.position.SetV(position);
  bdef.angle = angle;
  bdef.linearVelocity.SetV(velocity);
  fdef.shape = new B2CircleShape();
  fdef.shape.m_radius = 0.5;
  fdef.filter.groupIndex = -1;
  this.body = scene.world.CreateBody(bdef);
  this.body.CreateFixture(fdef);

  this.width = this.height = 1;
  this.velocity = velocity;
  this.img = document.getElementById('bullet');
}

Bullet.prototype.update = function (scene, time) {
  if (this.hitBy.length > 0) {
    scene.add(new Explosion(scene, this.body.GetPosition()));
    scene.remove(this);
  }
};

//
// Asteroid
//
function Asteroid(player, scene, scale, position, velocity) {
  this.scale = scale;
  this.width = this.height = 4 * scale;

  var bdef = new B2BodyDef(), fdef = new B2FixtureDef();
  bdef.type = B2Body.b2_dynamicBody;
  bdef.position.SetV(position);
  bdef.linearVelocity.SetV(velocity);
  fdef.shape = new B2CircleShape();
  fdef.shape.m_radius = 0.9*this.width/2;
  fdef.density = 1;
  fdef.restitution = 1;
  this.body = scene.world.CreateBody(bdef);
  this.body.CreateFixture(fdef);

  this.img = document.getElementById('asteroid');
  this.player = player;
}

Asteroid.prototype.update = function (scene, time) {
  var pos = this.body.GetPosition(), v1, v2;

  if (hitBy(this, Bullet).length > 0) {
    if (this.scale >= 0.49) {
      playSound('asteroid_explosion');

      v1 = new B2Vec2(20*Math.random()-10, 20*Math.random()-10);
      v2 = new B2Vec2(-v1.x, -v1.y);
      scene.add(new Asteroid(this.player, scene, this.scale/2, this.body.GetPosition(), v1));
      scene.add(new Asteroid(this.player, scene, this.scale/2, this.body.GetPosition(), v2));

      this.player.score += 25;
    }
    else {
      playSound('asteroid_last_explosion');
      this.player.score += 100;
    }
    scene.remove(this);
  }
};

//
// Ship
//
function Ship(scene, inputControl, player) {
  this.img = document.getElementById('ship');
  this.width = 1;
  this.height = 2;

  var bdef = new B2BodyDef(), fdef = new B2FixtureDef();
  bdef.type = B2Body.b2_dynamicBody;
  bdef.linearDamping = 5;
  bdef.angularDamping = 8;
  fdef.shape = new B2PolygonShape();
  fdef.shape.SetAsBox(0.5, 1);
  fdef.density = 1;
  fdef.restitution = 1;
  fdef.filter.groupIndex = -1;
  this.body = scene.world.CreateBody(bdef);
  this.body.CreateFixture(fdef);

  this.inputControl = inputControl;
  this.player = player;
  this.lastShot = 0;
}

Ship.prototype.update = function (scene, time) {
  var control = this.inputControl,
      body = this.body,
      throttleForce,
      bulletPos, bulletVelocity, shipPos;

  throttleForce = new B2Vec2(0, control.throttle*100);
  body.ApplyForce(body.GetWorldVector(throttleForce), body.GetWorldCenter());

  if (control.angle !== undefined) {
    body.SetAngle(body.GetAngle() + control.angle);
    control.angle = undefined;
  }
  else {
    body.ApplyTorque(control.steering*45);
  }

  if (control.trigger && this.lastShot + 250 <= time || this.lastShot > time) {
    playSound('shot');

    bulletPos = new B2Vec2(0, 1.0);
    bulletVelocity = body.GetWorldVector(new B2Vec2(0, 25));
    shipPos = body.GetWorldPoint(bulletPos);
    scene.add(new Bullet(scene, shipPos, body.GetAngle(), bulletVelocity));

    this.player.score -= 2;
    this.lastShot = time;
  }

  if (hitBy(this, Asteroid).length > 0) {
    playSound('ship_explosion');
    this.player.score -= 200;
  }
};

////////////////////////////////////////////////////////////////////////////////
//
// Blastroids
//
function Blastroids(canvas) {
  this.background = document.getElementById('background');
  this.player = new BlastroidsPlayer();
  this.scene = new Scene(new B2World(new B2Vec2(0, 0), true));
  this.control = new BlastroidsInputControl();
}

Blastroids.prototype.placeWalls = function (scale) {
  var scene = this.scene,
      scaledWidth = window.innerWidth/scale,
      scaledHeight = window.innerHeight/scale;

  scene.gameObjects.filter(function (obj) { return isA(obj, Wall); }).forEach(scene.remove);

  scene.add(new Wall(scene, 0, -scaledHeight/2, scaledWidth, 0.5));
  scene.add(new Wall(scene, 0, scaledHeight/2, scaledWidth, 0.5));
  scene.add(new Wall(scene, -scaledWidth/2, 0, 0.5, scaledHeight));
  scene.add(new Wall(scene, scaledWidth/2, 0, 0.5, scaledHeight));
};

Blastroids.prototype.initLevel = function (level) {
  var i, asteroid, pos, vel;

  for (i = 0; i < 5 + level; i++) {
    pos = new B2Vec2(18*Math.random()-9, 18*Math.random()-9);
    vel = new B2Vec2(20*Math.random()-10, 20*Math.random()-10);
    asteroid = new Asteroid(this.player, this.scene, 1, pos, vel);
    this.scene.add(asteroid);
  }
};

Blastroids.prototype.renderOverlay = function (context) {
  context.textBaseline = 'top';
  context.font = '20pt Arial';
  context.fillStyle = 'black';
  context.fillText('Score: ' + this.player.score, 12, 12);
  context.fillStyle = 'yellow';
  context.fillText('Score: ' + this.player.score, 10, 10);
};

Blastroids.prototype.asteroidCount = function () {
  var asteroids = this.scene.gameObjects.filter(function (obj) {
    return isA(obj, Asteroid);
  });

  return asteroids.length;
};

Blastroids.prototype.gameOn = function () {
  var self = this, level = 1,
      canvas = document.getElementById('canvas'),
      context = canvas.getContext('2d');

  function scaleCanvasAndPlaceWalls(e) {
    canvas.setAttribute("width", window.innerWidth + "px");
    canvas.setAttribute("height", window.innerHeight + "px");

    self.placeWalls(window.innerHeight/20);
    if (self.scene.debugDraw) self.scene.debugDraw.SetDrawScale(window.innerHeight/20);
  }

  function updateGraphics(time) {
    window.requestAnimationFrame(updateGraphics);

    if (self.asteroidCount() === 0) {
      self.initLevel(level++);
    }

    context.drawImage(self.background, 0, 0, context.canvas.width, context.canvas.height);
    if (!self.control.bomb) self.scene.update(time);
    self.scene.drawScene(context, window.innerHeight/20);
    if (Blastroids.DEBUG) self.scene.drawDebug(context, window.innerHeight/20);
    self.renderOverlay(context);
  }

  scaleCanvasAndPlaceWalls();
  this.scene.add(new Ship(this.scene, this.control, this.player));

  window.addEventListener('resize', scaleCanvasAndPlaceWalls);
  window.requestAnimationFrame(updateGraphics);
};

window.addEventListener("load", function () {
  Blastroids.DEBUG = false;
  new Blastroids(document.getElementById('canvas')).gameOn();
});
