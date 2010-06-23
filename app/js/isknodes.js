(function() {

  function quoteString(str) {
    return '"' + str.replace(/\\/, '\\\\').replace(/"/, '\\"') + '"';
  }


  ISKFrame = Class.$extend({
    __init__ : function() {
      this.postponed = [];
    },

    postpone : function(stmt) {
      this.postponed.push(stmt);
    },

    writePostponed : function(g) {
      if (this.postponed.length)
        g.write(this.postponed.join(''));
    }
  });


  ISKGetController = function(node) {
    var node = $(node);
    var body = $('body')[0];
    while (node[0] != body) {
      var controller = $(node).data('nodeController');
      if (controller)
        return controller;
      node = node.parent();
    }
  };


  ISKJavaScriptGenerator = Class.$extend({
    __init__ : function() {
      this.code = [];
      this.lastIdentifier = 0;
      this.frameStack = [];
      this.spriteStack = [];
      this.images = [];
    },

    addImage : function(image) {
      this.images.push(image);
    },

    hasImages : function() {
      return !!this.images.length;
    },

    enterFrame : function() {
      this.frameStack.push(new ISKFrame());
    },

    leaveFrame : function() {
      var frm = this.frameStack.pop();
      frm.writePostponed(this);
    },

    enterSprite : function(sprite) {
      this.spriteStack.push(sprite);
    },

    leaveSprite : function() {
      this.spriteStack.pop();
    },

    getFrame : function() {
      return this.frameStack[this.frameStack.length - 1];
    },

    getSprite : function() {
      return this.spriteStack[this.spriteStack.length - 1];
    },

    nextIdentifier : function() {
      return 'l' + this.lastIdentifier++;
    },

    write : function(code) {
      this.code.push(code);
    },
  
    generateSingle : function(controller, key) {
      var c = controller.controllers[key];
      if (c)
        c.generateCode(this);
    },

    generateAll : function(controller, key) {
      for (var c = controller.controllers[key]; c; c = c.controllers.next)
        c.generateCode(this);
    },

    getCode : function() {
      return this.code.join("");
    }
  });


  ISKCostume = Class.$extend({
    __init__ : function(href) {
      this.image = new Image();
      this.image.src = href;
      this.sprite = null;
    },

    getSprite : function() {
      return this.sprite;
    },

    getImage : function() {
      return this.image;
    },

    getVar : function() {
      return 'rt.stash[' + quoteString('image/' + this.getHref()) + ']';
    },

    getHref : function() {
      return this.image.src;
    }
  });


  ISKNodeController = Class.$extend({
    __init__ : function() {
      this.node = $('<div class=node></div>');
      this.node.data('nodeController', this);
      this.parent = null;
      this.boundToSlot = null;
      this.controllers = {};
      this.slots = {};
    },

    getDescription : function() {
      return '';
    },

    getCategory : function() {
      return 'generic';
    },

    setController : function(key, controller) {
      if (this.controllers[key])
        this.controllers[key].parent = null;
      this.controllers[key] = controller;
      if (controller != null) {
        $('.placeholder', this.slots[key]).hide();
        controller.node.appendTo(this.slots[key]);
        controller.parent = this;
        controller.boundToSlot = key;
      }
      else
        $('.placeholder', this.slots[key]).show();
    },

    remove : function() {
      if (!this.boundToSlot) /* toplevel nodes */
        return this.parent.removeCode(this);
      var controller = this.parent.controllers[this.boundToSlot];
      if (!controller)
        return;
      if (this.boundToSlot)
        $('.placeholder', this.parent.slots[this.boundToSlot]).show();
      this.parent.controllers[this.boundToSlot] = null;
      this.node.remove();

      /* reattach next if you can */
      if (this.controllers.next)
        this.parent.setController(this.boundToSlot, this.controllers.next);

      this.parent = this.boundToSlot = null;
    },

    generateCode : function(g) {
    }
  });


  ISKApplicationNodeController = ISKNodeController.$extend({
    __init__ : function() {
      this.$super();
      this.sprites = [];
    },

    addSprite : function(sprite) {
      this.sprites.push(sprite);
      this.node.append(sprite.node);
    },

    removeSprite : function(sprite) {
      for (var i = 0, n = this.sprites.length; i != n; ++i)
        if (this.sprites[i] === sprite) {
          this.sprites.splice(i, 1);
          sprite.node.remove();
          return true;
        }
      return false;
    },

    moveSpriteUp : function(sprite) {
      for (var i = 0, n = this.sprites.length; i != n; ++i)
        if (this.sprites[i] === sprite) {
          var tmp = this.sprites[i - 1];
          this.sprites[i - 1] = this.sprites[i];
          this.sprites[i] = tmp;
          return true;
        }
      return false;
    },

    generateCode : function(g) {
      g.write('(ISKApplication.$extend({');
      g.write('setupSprites : function(rt) {')
      g.enterFrame();
        for (var i = 0, n = this.sprites.length; i != n; ++i)
          this.sprites[i].generateCode(g);
      g.leaveFrame();
      g.write('}, preloadImages : function(rt, readyFunc) {');
      if (g.hasImages()) {
        g.write('var loaded = 0; function probeLoaded() {');
        g.write('if (++loaded == ' + g.images.length + ') readyFunc();');
        g.write('}');
        for (var i = 0, n = g.images.length; i != n; ++i)
          g.write(g.images[i].getVar() + ' = this.loadImage(' +
                  quoteString(g.images[i].getHref()) + ', probeLoaded);');
      }
      else
        g.write('readyFunc();');
      g.write('}}))');
    },

    run : function(canvas) {
      var g = new ISKJavaScriptGenerator();
      this.generateCode(g);
      if (console && console.log)
        console.log('CODE', g.getCode());
      var appcls = eval(g.getCode());
      var app = new appcls(canvas);
      app.run();
      return app;
    }
  });


  ISKSpriteNodeController = ISKNodeController.$extend({
    __init__ : function(name) {
      this.$super();
      this.node.addClass('sprite-node');
      this.x = this.y = 0;
      this.name = name;
      this.costumes = [];
      this.code = [];
    },

    addCode : function(controller) {
      this.code.push(controller);
      this.node.append(controller.node);
      controller.parent = this;
    },

    removeCode : function(controller) {
      for (var i = 0, n = this.code.length; i != n; ++i)
        if (this.code[i] === controller) {
          this.code.splice(i, 1);
          controller.node.remove();
          return true;
        }
      return false;
    },

    addCostume : function(costume) {
      this.costumes.push(costume);
      costume.sprite = this;
    },

    removeCostume : function(index) {
      this.costumes.splice(index, 1); 
    },

    getVar : function() {
      return 'rt.stash[' + quoteString('sprite/' + this.name) + ']';
    },

    generateCode : function(g) {
      for (var i = 0, n = this.costumes.length; i != n; ++i)
        g.addImage(this.costumes[i]);
      g.write(this.getVar() + ' = new (ISKSprite.$extend({');
      g.write('__init__ : function() {');
      g.write('this.$super(' + this.x + ', ' + this.y + ');');
      for (var i = 0, n = this.costumes.length; i != n; ++i)
        g.write('this.costumes.push(' + this.costumes[i].getVar() + ');');
      g.write('}, run : function(rt) {');
      g.enterFrame();
        g.enterSprite(this);
          for (var i = 0, n = this.code.length; i != n; ++i)
            this.code[i].generateCode(g);
        g.leaveSprite();
      g.leaveFrame();
      g.write('}}))(); rt.sprites.push(' + this.getVar() + ');');
    }
  });


  ISKForeverNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Für immer']],
                       ['nested', ['stmt', 'first']]]];
    },

    getCategory : function() {
      return 'loop';
    },

    generateCode : function(g) {
      var temp = g.nextIdentifier();
      g.write('var ' + temp + ' = function() {');
      g.enterFrame();
        g.generateAll(this, 'first');
        g.write('rt.defer(' + temp + ');');
      g.leaveFrame();
      g.write('}; rt.defer(' + temp + ');');
    }
  });


  ISKRepeatNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Wiederhole '],
                                      ['expr', 'times'],
                                      ['text', ' mal']],
                       ['nested', ['stmt', 'first']]], ['next']];
    },

    getCategory : function() {
      return 'loop';
    },

    generateCode : function(g) {
      var ftemp = g.nextIdentifier();
      var ctemp = g.nextIdentifier();
      var atemp = g.nextIdentifier();

      g.write('var ' + atemp + ', ' + ctemp + ' = 0;');
      g.write('var ' + ftemp + ' = function() {');
      g.enterFrame();
        g.generateAll(this, 'first');
        g.write('if (++' + ctemp + ' < ');
        g.generateSingle(this, 'times');
        g.write(') rt.defer(' + ftemp + '); else rt.defer(' + atemp + ')');
      g.leaveFrame();
      g.write('}; if (');
      g.generateSingle(this, 'times');
      g.write(' > 0) rt.defer(' + ftemp + '); ' + atemp + ' = function() {');
      g.getFrame().postpone('};');
      g.generateAll(this, 'next');
    }
  });


  ISKWaitNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Warte '],
                                      ['expr', 'timeout', 'a timeout'],
                                      ['text', ' Sekunden']]],
              ['next']];
    },

    getCategory : function() {
      return 'control';
    },

    generateCode : function(g) {
      g.write('rt.wait(+(');
      g.generateSingle(this, 'timeout');
      g.write('), function() {\n');
      g.getFrame().postpone('});');
    }
  });


  ISKSwitchToCostumeNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Wechsel zu Kostüm '],
                                      ['expr', 'costume']]], ['next']];
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.setCostume(');
      g.generateSingle(this, 'expr');
      g.write(');');
    }
  });


  ISKNextCostumeNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Nächstes Kostüm']]], ['next']];
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.nextCostume();');
    }
  });

  ISKPreviousCostumeNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Voriges Kostüm']]], ['next']];
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.prevCostume();');
    }
  });

  ISKShowNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Zeigen']]], ['next']];
    },

    getCategory : function() {
      return 'control';
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.visible = true;');
    }
  });


  ISKHideNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar', ['text', 'Verstecken']]], ['next']];
    },

    getCategory : function() {
      return 'control';
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.visible = false;');
    }
  });

  ISKSetPositionNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar',
        ['text', 'Setze x = '],
        ['expr', 'xpos', 'eine Zahl'],
        ['text', ' y = '],
        ['expr', 'ypos', 'eine Zahl']]], ['next']];
    },

    getCategory : function() {
      return 'control';
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.x = +(');
      g.generateSingle(this, 'xpos');
      g.write(');');

      g.write(g.getSprite().getVar() + '.y = +(');
      g.generateSingle(this, 'ypos');
      g.write(');');
    }
  });


  ISKMoveNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['bar',
        ['text', 'Bewege x = '],
        ['expr', 'xpos', 'eine Zahl'],
        ['text', ' y = '],
        ['expr', 'ypos', 'eine Zahl']]], ['next']];
    },

    getCategory : function() {
      return 'control';
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.x += +(');
      g.generateSingle(this, 'xpos');
      g.write(');');

      g.write(g.getSprite().getVar() + '.y += +(');
      g.generateSingle(this, 'ypos');
      g.write(');');
    }
  });


  ISKConstNodeController = ISKNodeController.$extend({
    __init__ : function() {
      this.$super();
      this.value = '10';
    },

    getDescription : function() {
      return ['node', ['box', ['input', 'value']]];
    },

    getCategory : function() {
      return 'const';
    },

    generateCode : function(g) {
      g.write(quoteString(this.value));
    }
  });


  ISKXPosNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['text', 'X-Position']]];
    },

    getCategory : function() {
      return 'sensor';
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.x');
    }
  });


  ISKYPosNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['text', 'Y-Position']]];
    },

    getCategory : function() {
      return 'sensor';
    },

    generateCode : function(g) {
      g.write(g.getSprite().getVar() + '.y');
    }
  });


  ISKBinNodeController = ISKNodeController.$extend({
    getDescription : function() {
      return ['node', ['box', ['expr', 'left'],
                              ['text', ' ' + this.operation() + ' '],
                              ['expr', 'right']]];
    },

    getCategory : function() {
      return 'math';
    },

    generateCode : function(g) {
      g.write('+(');
      g.generateSingle(this, 'left');
      g.write(') ' + this.operation() + ' +(');
      g.generateSingle(this, 'right');
      g.write(')');
    }
  });


  ISKAddNodeController = ISKBinNodeController.$extend({
    operation : function() { return '+'; }
  });

  ISKSubNodeController = ISKBinNodeController.$extend({
    operation : function() { return '-'; }
  });

  ISKMulNodeController = ISKBinNodeController.$extend({
    operation : function() { return '*'; }
  });

  ISKDivNodeController = ISKBinNodeController.$extend({
    operation : function() { return '/'; }
  });
})();
