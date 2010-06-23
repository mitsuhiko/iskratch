ISKGetNextID = (function() {
  var val = 0;
  return function() { return ++val; }
})();

ISKCanvasTools = {
  traceEllipse : function(ctx, x, y, w, h) {
    var kappa = .5522848,
        ox = (w / 2) * kappa,
        oy = (h / 2) * kappa,
        xe = x + w,
        ye = y + h,
        xm = x + w / 2,
        ym = y + h / 2;

    ctx.beginPath();
    ctx.moveTo(x, ym);
    ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
    ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
    ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
    ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
    ctx.closePath();
  },

  traceRoundedRect : function(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.lineTo(x, y + h - r);
    ctx.quadraticCurveTo(x, y + h, x + r, y + h);
    ctx.lineTo(x + w - r, y + h);
    ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    ctx.lineTo(x + w, y + r);
    ctx.quadraticCurveTo(x + w, y, x + w - r, y);
    ctx.lineTo(x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.closePath();
  }
};

ISKSprite = Class.$extend({
  __init__ : function(x, y) {
    this.id = ISKGetNextID();
    this.costumes = [];
    this.activeCostume = 0;
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.visible = true;
    this.flipped = {h: false, v: false};
    this.thinkMessage = null;
    this.sayMessage = null;
    this.customDraw = null
  },

  prevCostume : function() {
    this.activeCostume = this.activeCostume - 1;
    if (this.activeCostume < 0)
      this.activeCostume = this.costumes.length - this.activeCostume;
  },

  nextCostume : function() {
    this.activeCostume = (this.activeCostume + 1) % this.costumes.length;
  },

  getCurrentCostume : function() {
    return this.costumes[this.activeCostume];
  },

  setRotation : function(angle) {
    angle = angle % 360;
    if (angle < 0)
      angle += 360;
    this.angle = angle;
  },

  rotate : function(angle) {
    this.setRotation(this.angle + angle);
  },

  lowlevelDraw : function(rt) {
    var img = this.getCurrentCostume();
    if (!img)
      return;
    rt.ctx.save();
    rt.ctx.translate(this.x, this.y);
    if (this.angle) {
      rt.ctx.translate(img.width / 2, img.height / 2);
      rt.ctx.rotate(this.angle * Math.PI / 180);
      rt.ctx.translate(-img.width / 2, -img.height / 2);
    }
    rt.ctx.drawImage(img, 0, 0, img.width, img.height);
    rt.ctx.restore();
  },

  draw : function(rt) {
    if (!this.visible)
      return;

    if (this.customDraw != null) {
      rt.ctx.save();
      this.customDraw(rt);
      rt.ctx.restore();
    }
    else
      this.lowlevelDraw(rt);

    if (this.sayMessage)
      rt.drawSpeechBubble(this.x + 20, this.y - 20, this.sayMessage);
    else if (this.thinkMessage)
      rt.drawThinkBubble(this.x + 20, this.y - 20, this.thinkMessage);
  },

  /* XXX: this is useless.  If rotation is applied the checks will be
          completely bogus, and even if not it's not pixel perfect.
          Ideally there would be a getBoundingBox() function that
          returns a rect for the bounding box and then each pixel
          of the intersection of the two bounding boxes is tested. */
  touches : function(otherSprite, delta) {
    delta = (delta || 0) / 2;
    var thisCostume = this.getCurrentCostume();
    var otherCostume = otherSprite.getCurrentCostume();
    return !(
      (this.y + thisCostume.height < otherSprite.y + delta) ||
      (this.y > otherSprite.y + otherCostume.height - delta) ||
      (this.x + thisCostume.width < otherSprite.x + delta) ||
      (this.x > otherSprite.x + otherCostume.width - delta)
    );
  },

  touchesCoords : function(coords) {
    var img = this.getCurrentCostume();
    return (
      (coords.x >= this.x && coords.x <= this.x + img.width) &&
      (coords.y >= this.y && coords.y <= this.y + img.height)
    );
  },

  run : function(rt) {
  }
});

ISKApplication = Class.$extend({
  FRAMERATE : 30,

  __init__ : function(canvas) {
    this.canvas = $(canvas)[0];
    this.running = true;
    this.activeIntervals = {};
    this.activeTimeouts = {};
    this.id = ISKGetNextID();
  },

  stop : function() {
    for (var ident in this.activeTimeouts)
      window.clearTimeout(ident);
    for (var ident in this.activeIntervals)
      window.clearInterval(ident);
    this.activeTimeouts = {};
    this.activeIntervals = {};
    this.unbindEventHandlers();
    this.running = false;
  },

  renderLoop : function(rt) {
    this.activeIntervals[window.setInterval(function() {
      rt.ctx.clearRect(0, 0, rt.canvas.width, rt.canvas.height);
      for (var i = 0, n = rt.sprites.length; i != n; ++i)
        rt.sprites[i].draw(rt);
      rt.timestep++;
    }, 1000 / this.FRAMERATE)] = true;
  },

  loadImage : function(filename, readyFunc) {
    var img = new Image();
    if (readyFunc !== null)
      img.onload = readyFunc;
    img.onerror = function() {
      alert("Error: failed to load image " + filename);
    };
    img.src = filename;
    return img;
  },

  loadSound : function(filename) {
    var aud = new Audio();
    aud.preload = true;
    aud.src = filename;
    return aud;
  },

  bindEventHandlers : function(rt) {
    var isMobile = RegExp(" Mobile/").test(navigator.userAgent);
    var ns = 'isk_' + this.id;
    $(document)
      .bind('keydown.' + ns, function(evt) {
        rt.handleKeyDown(evt);
      })
      .bind('keypress.' + ns, function(evt) {
        rt.handleKeyDown(evt);
      })
      .bind('keyup.' + ns, function(evt) {
        rt.handleKeyUp(evt);
      })
      .bind('mousemove.' + ns, function(evt) {
        rt.handleMouseMove(evt);
      })
      .bind((isMobile ? 'tap.' : 'click.') + ns, function(evt) {
        rt.handleClick(evt);
      });
  },

  unbindEventHandlers : function() {
    $(document).unbind('.isk_' + this.id);
  },

  run : function() {
    var self = this;
    var rt = new ISKRuntime(this);
    RT = rt; // expose for testing
    this.bindEventHandlers(rt);
    this.preloadImages(rt, function() {
      self.preloadSounds(rt);
      self.setupSprites(rt);
      this.running = true;
      for (var i = 0, n = rt.sprites.length; i != n; ++i)
        rt.sprites[i].run(rt);
      self.renderLoop(rt);
    });
  },

  /* replaced by generated code */
  setupSprites : function(rt) {
  },

  preloadImages : function(rt, readyFunc) {
  },

  preloadSounds : function(rt, readyFunc) {
  }
});

ISKRuntime = Class.$extend({
  __init__ : function(app, canvas) {
    this.app = app;
    this.canvas = app.canvas;
    this.ctx = app.canvas.getContext('2d');
    this.sprites = [];
    this.stash = {};
    this.mouse = {x: 0, y: 0};
    this.keyDownSubscriptions = {};
    this.clickSubscriptions = {};
    this.messageSubscriptions = {};
    this.keysDown = {};
    this.timestep = 0;
    this.inputDisabled = false;
  },

  translateCoords : function(evt) {
    return {
      x: evt.pageX - this.canvas.offsetLeft,
      y: evt.pageY - this.canvas.offsetTop
    };
  },

  drawBubble : function(x, y, r, fillStyle, text) {
    this.ctx.font = '14px "Verdana", sans-serif';
    var metric = this.ctx.measureText(text);
    this.ctx.fillStyle = fillStyle;
    this.ctx.strokeStyle = '#000000';
    ISKCanvasTools.traceRoundedRect(this.ctx, x, y, metric.width + 20, 30, r);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(text, x + 10, y + 20);
  },

  drawThinkBubble : function(x, y, text) {
    if (!this.ctx.measureText)
      return;
    var fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.drawBubble(x, y, 14, fillStyle, text);
    ISKCanvasTools.traceEllipse(this.ctx, x + 10, y + 33, 20, 10);
    this.ctx.fillStyle = fillStyle;
    this.ctx.fill();
    this.ctx.stroke();
    ISKCanvasTools.traceEllipse(this.ctx, x + 20, y + 45, 15, 8);
    this.ctx.fill();
    this.ctx.stroke();
  },

  drawSpeechBubble : function(x, y, text) {
    if (!this.ctx.measureText)
      return;
    this.drawBubble(x, y, 7, '#ffffff', text);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(x + 10, y + 29);
    this.ctx.lineTo(x + 25, y + 50);
    this.ctx.lineTo(x + 21, y + 29);
    this.ctx.fill();
    this.ctx.stroke();
  },

  subscribeKeyDown : function(keycode, func) {
    var rv = this.keyDownSubscriptions[keycode];
    if (rv == null)
      rv = this.keyDownSubscriptions[keycode] = [];
    rv.push(func);
  },

  subscribeToMessage : function(message, func) {
    var rv = this.messageSubscriptions[message];
    if (rv == null)
      rv = this.messageSubscriptions[message] = [];
    rv.push(func);
  },

  subscribeToClick : function(sprite, func) {
    var rv = this.clickSubscriptions[sprite.id];
    if (rv == null)
      rv = this.clickSubscriptions[sprite.id] = [];
    rv.push(func);
  },

  sendMessage : function(message) {
    var handlers = this.messageSubscriptions[message];
    if (handlers)
      for (var i = 0, n = handlers.length; i != n; ++i)
        this.defer(handlers[i]);
  },

  handleMouseMove : function(evt) {
    this.mouse = this.translateCoords(evt);
  },

  handleClick : function(evt) {
    var pos = this.translateCoords(evt);
    for (var i = this.sprites.length - 1; i; --i) {
      var handlers = this.clickSubscriptions[this.sprites[i].id];
      if (!handlers)
        continue;
      if (this.sprites[i].touchesCoords(this.mouse)) {
        for (var i = 0, n = handlers.length; i != n; ++i)
          this.defer(handlers[i]);
      }
      return;
    }
  },

  handleKeyDown : function(evt) {
    if (!this.keyDownSubscriptions[evt.which])
      return;
    evt.preventDefault();
    if (this.inputDisabled)
      return;
    if (this.keysDown[evt.which])
      return;
    this.keysDown[evt.which] = true;
    var handlers = this.keyDownSubscriptions[evt.which];
    if (handlers)
      for (var i = 0, n = handlers.length; i != n; ++i)
        this.defer(handlers[i]);
  },

  handleKeyUp : function(evt) {
    if (!this.keyDownSubscriptions[evt.which])
      return;
    if (this.inputDisabled)
      return;
    evt.preventDefault();
    if (this.isKeyDown(evt.which))
      this.keysDown[evt.which] = false;
  },

  isKeyDown : function(keyCode) {
    return !!this.keysDown[keyCode];
  },

  defer : function(callback) {
    this.wait(0, callback);
  },

  wait : function(timeout, callback) {
    if (!this.app.running)
      return;
    var app = this.app, ident = window.setTimeout(function() {
      delete app.activeTimeouts[ident];
      callback();
    }, timeout * 1000);
    this.app.activeTimeouts[ident] = true;
  },

  getRandomNumber : function(lower, upper) {
    return parseInt((Math.random() * (upper - lower)) + lower);
  },

  doesListContain : function(list, item) {
    for (var i = 0, n = list.length; i != n; ++i)
      if (list[i] == item)
        return true;
    return false;
  }
});
