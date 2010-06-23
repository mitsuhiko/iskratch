var ISKApplication = (iskratch.Application.$extend({
  setupSprites : function(rt) {
    rt.stash["sprite/Background"] = iskratch.Sprite.$extend({
      __init__ : function() {
        this.$super(0, 0);
        this.costumes.push(rt.stash["image/background.png"]);
      },
      run : function(rt) {
        var l1 = function() {
          rt.stash["sprite/Background"].x = +((+(rt.stash["sprite/Background"].x) - +(5)));
          if (((rt.stash["sprite/Background"].x) <= (-640))) {
            rt.stash["sprite/Background"].x = +(0);
          }
          rt.wait(0.050000000000000003, function() {
          rt.defer(l1);
          }); /* close what needs to be closed */
        };
        rt.defer(l1);
        rt.stash["sprite/Background"].customDraw = function() {
          rt.stash["sprite/Background"].lowlevelDraw(rt);
          rt.ctx.translate(640, 0);
          rt.stash["sprite/Background"].lowlevelDraw(rt);
        };
      }
    })();
    rt.sprites.push(rt.stash["sprite/Background"]);
    rt.stash["sprite/Octopus"] = iskratch.Sprite.$extend({
      __init__ : function() {
        this.$super(50, 120);
        this.costumes.push(rt.stash["image/octopus1.png"]);
        this.costumes.push(rt.stash["image/octopus2.png"]);
      },
      run : function(rt) {
        rt.stash["var/spite/Octopus/life"] = 3;
        var l2 = function() {
          rt.wait(0.14999999999999999, function() {
          rt.stash["sprite/Octopus"].nextCostume();
          rt.defer(l2);
          }); /* close what needs to be closed */
        };
        rt.defer(l2);
        rt.subscribeKeyDown(38, function() {
          var l3 = function() {
            if (((rt.stash["sprite/Octopus"].y) > (30))) {
              rt.stash["sprite/Octopus"].y = +((+(rt.stash["sprite/Octopus"].y) - +(15)));
            }
            rt.wait(0.10000000000000001, function() {
            if (rt.isKeyDown(38)) rt.defer(l3);
            }); /* close what needs to be closed */
          };
          rt.defer(l3);
        });
        rt.subscribeKeyDown(40, function() {
          var l4 = function() {
            if (((rt.stash["sprite/Octopus"].y) < (340))) {
              rt.stash["sprite/Octopus"].y = +((+(rt.stash["sprite/Octopus"].y) + +(15)));
            }
            rt.wait(0.10000000000000001, function() {
            if (rt.isKeyDown(40)) rt.defer(l4);
            }); /* close what needs to be closed */
          };
          rt.defer(l4);
        });
        rt.subscribeKeyDown(37, function() {
          var l5 = function() {
            if (((rt.stash["sprite/Octopus"].x) > (0))) {
              rt.stash["sprite/Octopus"].x = +((+(rt.stash["sprite/Octopus"].x) - +(15)));
            }
            rt.wait(0.10000000000000001, function() {
            if (rt.isKeyDown(37)) rt.defer(l5);
            }); /* close what needs to be closed */
          };
          rt.defer(l5);
        });
        rt.subscribeKeyDown(39, function() {
          var l6 = function() {
            if (((rt.stash["sprite/Octopus"].x) < (200))) {
              rt.stash["sprite/Octopus"].x = +((+(rt.stash["sprite/Octopus"].x) + +(15)));
            }
            rt.wait(0.10000000000000001, function() {
            if (rt.isKeyDown(39)) rt.defer(l6);
            }); /* close what needs to be closed */
          };
          rt.defer(l6);
        });
        rt.subscribeToMessage("player touched starfish", function() {
          rt.stash["sound/rattle.ogg"].play();
          rt.stash["var/spite/Octopus/life"] = (+(rt.stash["var/spite/Octopus/life"]) - +(1));
          if (((rt.stash["var/spite/Octopus/life"]) <= (0))) {
            rt.inputDisabled = true;
            rt.stash["sprite/Octopus"].thinkMessage = "Ouch!  That was too much";
            var l8;
            var l7 = function() {
              rt.sendMessage("hide starfish");
              rt.stash["sprite/Octopus"].y = +((+(rt.stash["sprite/Octopus"].y) + +(18)));
              rt.wait(0.025000000000000001, function() {
              if (!(((rt.stash["sprite/Octopus"].y) > (350)))) rt.defer(l7);
              else rt.defer(l8);
              }); /* close what needs to be closed */
            };
            if (!(((rt.stash["sprite/Octopus"].y) > (350)))) rt.defer(l7);
            else rt.defer(function() { l8(); });
            l8 = function() {
            rt.app.stop();
            }; /* close what needs to be closed */
          }
          else {
            rt.stash["sprite/Octopus"].thinkMessage = (("Ouch! Lifes left: ").toString() + (rt.stash["var/spite/Octopus/life"]).toString());
            rt.wait(1, function() {
            rt.stash["sprite/Octopus"].thinkMessage = null;
            }); /* close what needs to be closed */
          }
        });
      }
    })();
    rt.sprites.push(rt.stash["sprite/Octopus"]);
    rt.stash["sprite/Starfish"] = iskratch.Sprite.$extend({
      __init__ : function() {
        this.$super(640, 120);
        this.costumes.push(rt.stash["image/starfish1.png"]);
        this.costumes.push(rt.stash["image/starfish2.png"]);
      },
      run : function(rt) {
        var l9 = function() {
          rt.wait(0.29999999999999999, function() {
          rt.stash["sprite/Starfish"].nextCostume();
          rt.stash["sprite/Starfish"].rotate(15);
          rt.defer(l9);
          }); /* close what needs to be closed */
        };
        rt.defer(l9);
        var l10 = function() {
          rt.wait(0.10000000000000001, function() {
          rt.stash["sprite/Starfish"].x = +((+(rt.stash["sprite/Starfish"].x) - +((+(15) + +(rt.getRandomNumber(5, 15))))));
          if (rt.stash["sprite/Starfish"].touches(rt.stash["sprite/Octopus"], 40)) {
            rt.sendMessage("reset starfish");
            rt.sendMessage("player touched starfish");
            rt.stash["sprite/Starfish"].sayMessage = "Gotcha!";
            rt.wait(2, function() {
            rt.stash["sprite/Starfish"].sayMessage = null;
            }); /* close what needs to be closed */
          }
          else {
            if (((rt.stash["sprite/Starfish"].x) <= (-120))) {
              rt.sendMessage("reset starfish");
            }
          }
          rt.defer(l10);
          }); /* close what needs to be closed */
        };
        rt.defer(l10);
        rt.subscribeToMessage("reset starfish", function() {
          rt.stash["sprite/Starfish"].x = +((+(640) + +(rt.getRandomNumber(0, 50))));
          rt.stash["sprite/Starfish"].y = +(rt.getRandomNumber(80, 400));
        });
        rt.subscribeToMessage("hide starfish", function() {
          rt.stash["sprite/Starfish"].visible = false;
          rt.stash["sprite/Starfish"].x = +(9999999);
        });
        rt.subscribeToClick(rt.stash["sprite/Starfish"], function() {
          rt.stash["sound/bump.ogg"].play();
          rt.stash["sprite/Starfish"].sayMessage = "Hey!";
          rt.wait(0.5, function() {
          rt.stash["sprite/Starfish"].sayMessage = null;
          }); /* close what needs to be closed */
        });
      }
    })();
    rt.sprites.push(rt.stash["sprite/Starfish"]);
  },
  preloadImages : function(rt, readyFunc) {
    var loaded = 0;
    function probeLoaded() {
      if (++loaded == 5) readyFunc();
    }
    rt.stash["image/octopus2.png"] = this.loadImage("octopus2.png", probeLoaded);
    rt.stash["image/starfish1.png"] = this.loadImage("starfish1.png", probeLoaded);
    rt.stash["image/starfish2.png"] = this.loadImage("starfish2.png", probeLoaded);
    rt.stash["image/octopus1.png"] = this.loadImage("octopus1.png", probeLoaded);
    rt.stash["image/background.png"] = this.loadImage("background.png", probeLoaded);
  },
  preloadSounds : function(rt) {
    rt.stash["sound/bump.ogg"] = this.loadSound("bump.ogg");
    rt.stash["sound/rattle.ogg"] = this.loadSound("rattle.ogg");
  }
}));
