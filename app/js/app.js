(function() {
  jQT = $.jQTouch({
    icon: 'img/iSkratch60.png',
    statusBar: 'black',
    addGlossToIcon: false,

    /* use an explicit slide selector */
    slideSelector: '.push'
  });

  // bind versus click
  var isMobile = RegExp(" Mobile/").test(navigator.userAgent);
  $.fn.bindTap = function(callback) {
    return this.bind(isMobile ? 'tap' : 'click', callback);
  }
})();

$(function() {
  var $app = new ISKApplicationNodeController();
  APP = $app;
  var $activeSprite = null;
  var $activeController = null;
  var $activeSlot = null;

  var COSTUMES = [
    ['Fish', 'Fisch', ['fish.png']],
    ['Indoors', 'Drinnen', ['clothing-store.png', 'hall.png', 'kitchen.png']],
    ['Ciley', 'Ciley', ['ciley1.png', 'ciley2.png', 'ciley3.png',
                        'ciley4.png', 'ciley5.png']],
    ['Nature', 'Natur', ['beach-malibu.png', 'gravel-desert.png', 'lake.png', 'stars.png']],
    ['Outdoors', 'Draußen', ['all-sports-mural.png', 'boardwalk.png', 'brick-wall2.png',
                             'city-with-water2.png', 'pool.png', 'train-tracks1.png']],
    ['Sports', 'Sport', ['basketball-court1-a.png', 'basketball-court1-b.png',
                        'playing-field.png']]
  ];
  var STMT_CLASSES = [
    ['Endlosschleife', ISKForeverNodeController],
    ['Wiederholen', ISKRepeatNodeController],
    ['Warten', ISKWaitNodeController],
    ['Zeigen', ISKShowNodeController],
    ['Verstecken', ISKHideNodeController],
    ['Nächstes Kostüm', ISKNextCostumeNodeController],
    ['Vorheriges Kostüm', ISKPreviousCostumeNodeController],
    ['Wechsle zu Kostüm', ISKSwitchToCostumeNodeController],
    ['Setze Position', ISKSetPositionNodeController],
    ['Bewege', ISKMoveNodeController]
  ];
  var EXPR_CLASSES = [
    ['Konstanter Wert', ISKConstNodeController],
    ['X-Position', ISKXPosNodeController],
    ['Y-Position', ISKYPosNodeController],
    ['Addition', ISKAddNodeController],
    ['Subtraktion', ISKSubNodeController],
    ['Multiplikation', ISKMulNodeController],
    ['Division', ISKDivNodeController]
  ];

  function injectFromDescription(controller, node, category, description) {
    var key = description.splice(0, 1)[0];

    switch (key) {
      // root node def
      case "node":
        $('<a href=# class=delete>x</a>')
          .bindTap(function() {
            var controller = ISKGetController(this);
            if (controller)
              controller.remove();
          })
          .appendTo(node);
        for (var i = 0, n = description.length; i != n; ++i)
          injectFromDescription(controller, node, category, description[i]);
        break;
      // a box
      case "box":
        var barNode = $('<div class=box></div>')
          .addClass('box-' + category)
          .appendTo(node);
        for (var i = 0, n = description.length; i != n; ++i)
          injectFromDescription(controller, barNode, category, description[i]);
        break;
      // a bar (or handle)
      case "bar":
        var barNode = $('<div class=bar></div>').appendTo(node);
        for (var i = 0, n = description.length; i != n; ++i)
          injectFromDescription(controller, barNode[0], category, description[i]);
        break;
      // just text
      case 'text':
        var textNode = $('<span class=text></span>').appendTo(node);
        textNode.text(description.join(' '));
        break;
      // input thingies
      case 'input':
        var inputField = $('<input type=text size=10>')
          .val(controller[description[0]])
          .appendTo(node)
          .bind('change', function() {
            controller[description[0]] = inputField.val();
          });
        break;
      // nested blocks
      case 'nested':
        var nestedNode = $('<div class=nested></div>').appendTo(node);
        for (var i = 0, n = description.length; i != n; ++i)
          injectFromDescription(controller, nestedNode, category, description[i]);
        break;
      // next blocks, alias
      case 'next':
        description = ['next'];
      // regular statements
      case 'stmt':
        var wrapperNode = $('<div class=stmt></div>')
          .addClass('node-' + description[0] + '-slot')
          .appendTo(node);
        var placeholderNode = $('<a href=#statement class="placeholder slideup">' +
                                'Tippe für neues Statement</a>')
          .appendTo(wrapperNode)
          .bindTap(function() {
            $activeController = controller;
            $activeSlot = description[0];
          });
        controller.slots[description[0]] = wrapperNode;
        break;
      // expressions
      case 'expr':
        var wrapperNode = $('<span class=expr></span>')
          .appendTo(node);
        var placeholderNode = $('<a href=#expression class="placeholder slideup"></span>')
          .text('Tippe für ' + (description[1] || 'ein Ausdruck'))
          .appendTo(wrapperNode)
          .bindTap(function() {
            $activeController = controller;
            $activeSlot = description[0];
          });
        controller.slots[description[0]] = wrapperNode;
        break;
      default:
        alert('unhandled case ' + key);
    }
  }
  
  function createController(cls) {
    var instance = new cls();
    injectFromDescription(instance, instance.node, instance.getCategory(),
                          instance.getDescription());
    instance.node.addClass('node-category-' + instance.getCategory());
    return instance;
  }

  CREATECONTROLLER=createController;

  /* syncs the object list */
  function syncObjectList() {
    var list = $('#canvas ul.objectlist').empty();
    if ($activeSprite)
      $('#objects h1').text($activeSprite.name);
    $.each($app.sprites, function(idx) {
      var obj = this;
      var link = $('<a href=#objects class=push></a>')
        .text(obj.name)
        .bindTap(function() {
          $activeSprite = obj;
          $('div.sprite-node', $app.node).hide();
          $activeSprite.node.show();
          $('#objects h1').text(obj.name);
        })
        .appendTo($('<li>').appendTo(list));
       if (idx != 0)
          link.prepend($('<a href=# class=upbtn><span>^</span></a>')
          .bindTap(function() {
            $app.moveSpriteUp(obj);
            syncObjectList();
            return false;
          }))
    });
  }

  /* sync the costume list */
  function syncCostumeList() {
    var costumes = $('#costumes ul').empty();
    for (var i = 0, n = $activeSprite.costumes.length; i != n; ++i)
      costumes.append($('<li class=image></li>')
        .append($('<a href=# class=delete><span>delete</span></a>')
          .bindTap((function(index) { return function() {
            $activeSprite.removeCostume(index);
            syncCostumeList();
            return false;
          };})(i)))
        .append($activeSprite.costumes[i].getImage()));
  }

  /* creates a new project */
  function newProject() {
    $app.addSprite(new ISKSpriteNodeController("Hintergrund"));
    syncObjectList();
  }

  /* the add button of the new-object pane adds an object */
  (function() {
    var pane = $('#new-object');
    $('a.add', pane)
      .bindTap(function() {
        var value = $('input[name="name"]', pane).val();
        if (!value.length) {
          alert("Gib bitte einen Namen ein.");
          return false;
        }
        $app.addSprite(new ISKSpriteNodeController(value));
        syncObjectList();
        jQT.goBack();
      });
  })();

  /* the add button of the edit-object pane renames the object */
  (function() {
    var pane = $('#edit-object');
    pane.bind('pageAnimationStart', function() {
      $('input[name="name"]', pane).val($activeSprite.name);
    });
    $('a.add', pane)
      .bindTap(function() {
        $activeSprite.name = $('input[name="name"]', pane).val();
        syncObjectList();
        jQT.goBack();
      });
  })();

  /* the delete button of the edit-object pane delete the object */
  (function() {
    var pane = $('#edit-object');
    pane.bind('pageAnimationStart', function() {
      $('input[name="name"]', pane).val($activeSprite.name);
    });
    $('a.delete', pane)
      .bindTap(function() {
        $activeSprite.name = $('input[name="name"]', pane).val();
        $app.removeSprite($activeSprite);
        syncObjectList();
        jQT.goBack(2);
      });
  })();

  /* register all statement nodes */
  (function() {
    function updateList(selector, collection) {
      var list = $(selector + ' form ul');
      $.each(collection, function() {
        var cls = this[1];
        $('<a href="#"></a>')
          .text(this[0])
          .bindTap(function() {
            var obj = createController(cls);
            if ($activeController)
              $activeController.setController($activeSlot, obj);
            else
              $activeSprite.addCode(obj);
            jQT.goBack();
            return false;
          }).appendTo($('<li></li>').appendTo(list));
      });
    }
    updateList('#statement', STMT_CLASSES);
    updateList('#expression', EXPR_CLASSES);
  })();

  /* unset controller and stuff for standard add-statement link */
  (function() {
    $('#script a.add')
      .bindTap(function() {
        $activeController = null;
      });
  })();

  /* add the application node */
  (function() {
    $('#script div.scriptholder').append($app.node);
  })();

  /* add all costumes to that thingy */
  (function() {
    var pane = $('#costumes').bind('pageAnimationStart', function() {
      syncCostumeList();
    });

    var list = $('#add-costumes ul');
    for (var i = 0, ni = COSTUMES.length; i != ni; ++i) {
      var category = COSTUMES[i][0];
      var costumes = COSTUMES[i][2];
      list.append($('<li></li>').append($('<em></em>').text(COSTUMES[i][1])));
      for (var j = 0, nj = costumes.length; j != nj; ++j)
        list.append($('<li class=image></li>').append($('<a href=#></a>')
          .append($('<img>').attr('src', 'img/costumes/' + category + '/' + costumes[j]))
          .bindTap(function() {
            jQT.goBack();
            $activeSprite.costumes.push(new ISKCostume($('img', this).attr('src')));
            syncCostumeList();
            return false;
          })));
    }
  })();

  /* playing area */
  (function() {
    var app = null;
    var pane = $('#play').bind('pageAnimationEnd', function() {
      try {
        app = $app.run('#player');
      }
      catch (e) {}
    });

    $('.cancel', pane).bindTap(function() {
      if (!app)
        return;
      try {
        app.stop();
      }
      catch (e) {}
      app = null;
    });
  })();

  // create new project on start
  newProject();
});
