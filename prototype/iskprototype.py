from __future__ import with_statement

import sys
from contextlib import contextmanager

try:
    from simplejson import dumps as dump_json
except ImportError:
    from json import dumps as dump_json


KEYCODES = {
    'arrow up':     38,
    'arrow down':   40,
    'arrow left':   37,
    'arrow right':  39,
    'space':        32,
    'enter':        13,
    'backspace':    8
};


def get_key_code(name):
    if len(name) == 1:
        return ord(name[0])
    return KEYCODES[name]


class Frame(object):

    def __init__(self):
        self.postponed = []

    def postpone(self, stmt):
        self.postponed.append(stmt)

    def write_postponed(self, g):
        if self.postponed:
            g.writeline(''.join(self.postponed) +
                        ' /* close what needs to be closed */')


class JSGenerator(object):

    def __init__(self, file):
        self.file = file
        self.last_identifier = 0
        self.indentation = 0
        self.images = set()
        self.sounds = set()
        self.frame_stack = []
        self.sprite_stack = []

    def image_var(self, image):
        return 'rt.stash[%s]' % dump_json('image/' + image)

    def sound_var(self, sound):
        return 'rt.stash[%s]' % dump_json('sound/' + sound)

    @contextmanager
    def subframe(self):
        self.indentation += 1
        self.frame_stack.append(Frame())
        yield
        frame = self.frame_stack.pop()
        frame.write_postponed(self)
        self.indentation -= 1

    @contextmanager
    def spritebound(self, sprite):
        self.sprite_stack.append(sprite)
        yield
        self.sprite_stack.pop()

    @property
    def frame(self):
        return self.frame_stack[-1]

    @property
    def sprite(self):
        return self.sprite_stack[-1]

    def next_identifier(self):
        self.last_identifier += 1
        return 'l%s' % self.last_identifier

    def write(self, code):
        self.file.write(code)

    def write_indentation(self):
        self.file.write('  ' * self.indentation)

    def write_with_indentation(self, code):
        self.write_indentation()
        self.write(code)

    def writeline(self, code):
        self.write_with_indentation(code + '\n')

    @contextmanager
    def indented_block(self):
        self.indentation += 1
        yield
        self.indentation -= 1


class Node(object):

    def generate_code(self, g):
        pass


class ApplicationNode(Node):

    def __init__(self):
        self.sprites = []

    def generate_code(self, g):
        g.writeline('(iskratch.Application.$extend({')
        with g.indented_block():
            g.writeline('setupSprites : function(rt) {')
            with g.indented_block():
                for sprite in self.sprites:
                    sprite.generate_code(g)
            g.writeline('},')
            g.writeline('preloadImages : function(rt, readyFunc) {')
            with g.indented_block():
                if g.images:
                    g.writeline('var loaded = 0;')
                    g.writeline('function probeLoaded() {')
                    with g.indented_block():
                        g.writeline('if (++loaded == %d) readyFunc();' % len(g.images))
                    g.writeline('}')
                    for image in g.images:
                        g.writeline('%s = this.loadImage(%s, probeLoaded);'
                                    % (g.image_var(image), dump_json(image)))
                else:
                    g.writeline('readFunc();')
            g.writeline('},')
            g.writeline('preloadSounds : function(rt) {')
            with g.indented_block():
                for sound in g.sounds:
                    g.writeline('%s = this.loadSound(%s);'
                                % (g.sound_var(sound), dump_json(sound)))
            g.writeline('}')
        g.write('}))')


# ARMIN
class ConstNode(Node):

    def __init__(self, value):
        self.value = value

    def generate_code(self, g):
        g.write(dump_json(self.value))


class BinNode(Node):
    force = None

    def __init__(self, lhs, rhs):
        self.lhs = lhs
        self.rhs = rhs

    def write_expr(self, expr, g):
        if self.force == 'number':
            g.write('+(')
        else:
            g.write('(')
        expr.generate_code(g)
        if self.force == 'string':
            g.write(').toString()')
        else:
            g.write(')')

    def generate_code(self, g):
        g.write('(')
        self.write_expr(self.lhs, g)
        g.write(' %s ' % self.operation)
        self.write_expr(self.rhs, g)
        g.write(')')


class UnaryNode(Node):

    def __init__(self, expr):
        self.expr = expr

    def generate_code(self, g):
        g.write('(%s' % self.operation)
        self.expr.generate_code(g)
        g.write(')')


class EqNode(BinNode):
    operation = '=='


class NeNode(BinNode):
    operation = '!='


class GtNode(BinNode):
    operation = '>'


class GeNode(BinNode):
    operation = '>='


class LtNode(BinNode):
    operation = '<'


class LeNode(BinNode):
    operation = '<='


class NotNode(UnaryNode):
    operation = '!'


class NegNode(UnaryNode):
    operation = '-'


class PosNode(UnaryNode):
    operation = '+'


class AddNode(BinNode):
    operation = '+'
    force = 'number'


class SubNode(BinNode):
    operation = '-'
    force = 'number'


class MulNode(BinNode):
    operation = '*'
    force = 'number'


class DivNode(BinNode):
    operation = '/'
    force = 'number'


class ConcatNode(BinNode):
    operation = '+'
    force = 'string'


class AndNode(BinNode):
    operation = '&&'


class OrNode(BinNode):
    operation = '||'


class ModNode(BinNode):
    operation = '%'


class GetLetterNode(Node):

    def __init__(self, index, string):
        self.index = index
        self.string = string

    def generate_code(self, g):
        g.write('(')
        self.string.generate_code(g)
        g.write(').toString()[')
        self.index.generate_code(g)
        g.write(']')


class GetLengthOfStringNode(Node):

    def __init__(self, string):
        self.string = string

    def generate_code(self, g):
        g.write('(')
        self.string.generate_code(g)
        g.write(').toString().length')
# ENDARMIN


class AddItemNode(Node):

    def __init__(self, list, item):
        self.list = list
        self.item = item

    def generate_code(self, g):
        g.write_indentation()
        self.string.generate_code(g)
        g.write('.push(')
        self.item.generate_code(g)
        g.write(');\n')


class RemoveLastItemNode(Node):

    def __init__(self, list):
        self.list = list

    def generate_code(self, g):
        g.write_indentation()
        self.string.generate_code(g)
        g.write('.pop();\n')


class GetLengthOfListNode(Node):

    def __init__(self, list):
        self.list = list

    def generate_code(self, g):
        self.list.generate_code(g)
        g.write('.length')


class DoesListContainNode(Node):

    def __init__(self, list, item):
        self.list = list
        self.item = item

    def generate_code(self, g):
        g.write('rt.doesListContain(')
        self.list.generate_code(g)
        g.write(', ')
        self.item.generate_code(g)
        g.write(')')


class SetListItemToNode(Node):

    def __init__(self, list, index, item):
        self.list = list
        self.index = index
        self.item = item

    def generate_code(self, g):
        g.write_indentation()
        self.list.generate_code(g)
        g.write('[(')
        self.index.generate_code(g)
        g.write(') - 1] = ')
        self.item.generate_code(g)
        g.write(';\n')


class ClearListNode(Node):

    def __init__(self, list):
        self.list = list

    def generate_code(self, g):
        g.write_indentation()
        self.list.generate_code(g)
        g.write('.length = 0;\n')

# -----------------
class MathFuncNode(Node):
    name = None

    def __init__(self, expr):
        self.expr = expr

    def generate_code(self, g):
        g.write('Math.%s(')
        self.expr.generate_code(g)
        g.write(')')


class SqrtNode(MathFuncNode):
    name = 'sqrt'


class AbsNode(MathFuncNode):
    name = 'abs'


class SinNode(MathFuncNode):
    name = 'sin'


class CosNode(MathFuncNode):
    name = 'cos'


class TanNode(MathFuncNode):
    name = 'tan'


class AsinNode(MathFuncNode):
    name = 'asin'


class AcosNode(MathFuncNode):
    name = 'acos'


class AtanNode(MathFuncNode):
    name = 'atan'


class LogNode(MathFuncNode):
    name = 'log'


class ExpNode(MathFuncNode):
    name = 'exp'


class GlobalVariableNode(Node):

    def __init__(self, name):
        self.name = name

    def generate_code(self, g):
        g.write('rt.stash[%s]' % parse_json('var/global/' + self.name))


class GlobalListNode(Node):

    def __init__(self, name):
        self.name = name

    def generate_code(self, g):
        g.write('rt.stash[%s]' % parse_json('list/global/' + self.name))


class SpriteVariableNode(Node):

    def __init__(self, name):
        self.name = name

    def generate_code(self, g):
        g.write(g.sprite.variable(self.name))


class SpriteListNode(Node):

    def __init__(self, name):
        self.name = name

    def generate_code(self, g):
        g.write(g.sprite.list(self.name))


class ThinkNode(Node):

    def __init__(self, expr):
        self.expr = expr

    def generate_code(self, g):
        g.write_with_indentation('%s.thinkMessage = ' % g.sprite.var)
        self.expr.generate_code(g);
        g.write(';\n')


class StopThinkingNode(Node):

    def generate_code(self, g):
        g.writeline('%s.thinkMessage = null;' % g.sprite.var)


class ThinkForNode(Node):

    def __init__(self, timeout, expr):
        self.timeout = timeout
        self.expr = expr

    def generate_code(self, g):
        ThinkNode(self.expr).generate_code(g)
        WaitNode(self.timeout).generate_code(g)
        StopThinkingNode().generate_code(g)

#------------------------------------------
class SayNode(Node):

    def __init__(self, expr):
        self.expr = expr

    def generate_code(self, g):
        g.write_with_indentation('%s.sayMessage = ' % g.sprite.var)
        self.expr.generate_code(g);
        g.write(';\n')


class StopTalkingNode(Node):

    def generate_code(self, g):
        g.writeline('%s.sayMessage = null;' % g.sprite.var)


class SayForNode(Node):

    def __init__(self, timeout, expr):
        self.timeout = timeout
        self.expr = expr

    def generate_code(self, g):
        SayNode(self.expr).generate_code(g)
        WaitNode(self.timeout).generate_code(g)
        StopTalkingNode().generate_code(g)


class SpriteNode(Node):
    _identifier = 0

    def __init__(self, name, costumes=None, code=None, x=0, y=0):
        self.name = name
        if costumes is None:
            costumes = []
        self.costumes = costumes
        if code is None:
            code = []
        self.code = code
        self.x = x
        self.y = y

    @property
    def var(self):
        return 'rt.stash[%s]' % dump_json('sprite/' + self.name)

    def variable(self, name):
        return 'rt.stash[%s]' % dump_json('var/spite/%s/%s' % (self.name, name))

    def list(self, name):
        return 'rt.stash[%s]' % dump_json('list/splite/list/%s/%s' % (self.name, name))

    def generate_code(self, g):
        for costume in self.costumes:
            g.images.add(costume)
        g.writeline('%s = iskratch.Sprite.$extend({' % self.var)
        with g.indented_block():
            g.writeline('__init__ : function() {')
            with g.indented_block():
                g.writeline('this.$super(%s, %s);' % (self.x, self.y))
                for costume in self.costumes:
                    g.writeline('this.costumes.push(%s);' % g.image_var(costume))
            g.writeline('},')
            g.writeline('run : function(rt) {')
            with g.indented_block():
                with g.spritebound(self):
                    for node in self.code:
                        node.generate_code(g)
            g.writeline('}')
        g.writeline('})();')
        g.writeline('rt.sprites.push(%s);' % self.var)


class SetNode(Node):

    def __init__(self, target, expr):
        self.target = target
        self.expr = expr

    def generate_code(self, g):
        g.write_indentation()
        self.target.generate_code(g)
        g.write(' = ')
        self.expr.generate_code(g)
        g.write(';\n')


class StopAllNode(Node):

    def generate_code(self, g):
        g.writeline('rt.app.stop();')


class IfNode(Node):

    def __init__(self, expr, body, else_):
        self.expr = expr
        self.body = body
        self.else_ = else_

    def generate_code(self, g):
        g.write_with_indentation('if (')
        self.expr.generate_code(g)
        g.write(') {\n')
        if self.body:
            with g.subframe():
                for node in self.body:
                    node.generate_code(g)
        g.writeline('}')
        if self.else_:
            g.writeline('else {')
            with g.subframe():
                for node in self.else_:
                    node.generate_code(g)
            g.writeline('}')


class WaitNode(Node):

    def __init__(self, timeout):
        self.timeout = timeout

    def generate_code(self, g):
        g.write_with_indentation('rt.wait(')
        self.timeout.generate_code(g)
        g.write(', function() {\n')
        g.frame.postpone('});')


class GetXNode(Node):

    def generate_code(self, g):
        g.write('%s.x' % g.sprite.var)


class GetYNode(Node):

    def generate_code(self, g):
        g.write('%s.y' % g.sprite.var)


class SetXNode(Node):

    def __init__(self, value):
        self.value = value

    def generate_code(self, g):
        g.write_with_indentation('%s.x = +(' % g.sprite.var)
        self.value.generate_code(g)
        g.write(');\n')


class SetYNode(Node):

    def __init__(self, value):
        self.value = value

    def generate_code(self, g):
        g.write_with_indentation('%s.y = +(' % g.sprite.var)
        self.value.generate_code(g)
        g.write(');\n')


class IsVisibleNode(Node):

    def generate_code(self, g):
        g.write('%s.visible' % g.sprite.var)


class ShowNode(Node):

    def generate_code(self, g):
        g.writeline('%s.visible = true;' % g.sprite.var)


class HideNode(Node):

    def generate_code(self, g):
        g.writeline('%s.visible = false;' % g.sprite.var)


class GetRotationNode(Node):

    def generate_code(self, g):
        g.writeline('%s.angle' % g.sprite.var)


class SetRotationNode(Node):

    def __init__(self, angle):
        self.angle = angle

    def generate_code(self, g):
        g.write_with_indentation('%s.setRotation(' % g.sprite.var)
        self.angle.generate_code(g)
        g.write(');\n')


class RotateNode(Node):

    def __init__(self, angle):
        self.angle = angle

    def generate_code(self, g):
        g.write_with_indentation('%s.rotate(' % g.sprite.var)
        self.angle.generate_code(g)
        g.write(');\n')


class NextCostumeNode(Node):

    def generate_code(self, g):
        g.writeline('%s.nextCostume();' % g.sprite.var)


class SetCostumeNode(Node):

    def __init__(self, number):
        self.number = number

    def generate_code(self, g):
        g.write_with_indentation('%s.activeCostume = (+(' % g.sprite.var)
        self.number.generate_code(g)
        g.write(') %% %s.activeCostume.length);\n' % g.sprite.var)


class SpriteTouchesNode(Node):

    def __init__(self, other_sprite, delta=None):
        self.other_sprite = other_sprite
        self.delta = delta

    def generate_code(self, g):
        g.write('%s.touches(%s' % (
            g.sprite.var,
            self.other_sprite.var
        ))
        if self.delta is not None:
            g.write(', ')
            self.delta.generate_code(g)
            g.write(')')


class MouseXNode(Node):

    def generate_code(self, g):
        return g.write('rt.mouse.x')


class MouseYNode(Node):

    def generate_code(self, g):
        return g.write('rt.mouse.y')


class RandomNumberNode(Node):

    def __init__(self, lower, upper):
        self.lower = lower
        self.upper = upper

    def generate_code(self, g):
        g.write('rt.getRandomNumber(')
        self.lower.generate_code(g)
        g.write(', ')
        self.upper.generate_code(g)
        g.write(')')


class ForeverNode(Node):

    def __init__(self, body):
        self.body = body

    def generate_code(self, g):
        temp = g.next_identifier()
        g.writeline('var %s = function() {' % temp)
        with g.subframe():
            for node in self.body:
                node.generate_code(g)
            g.writeline('rt.defer(%s);' % temp)
        g.writeline('};')
        g.writeline('rt.defer(%s);' % temp)


class RepeatNode(Node):

    def __init__(self, times, body):
        self.times = times
        self.body = body

    def generate_code(self, g):
        ftemp = g.next_identifier()
        ctemp = g.next_identifier()
        atemp = g.next_identifier()
        g.writeline('var %s, %s = 0;' % (atemp, ctemp))
        g.writeline('var %s = function() {' % ftemp)
        with g.subframe():
            for node in self.body:
                node.generate_code(g)
            g.write_with_indentation('if (++%s < ' % ctemp)
            self.times.generate_code(g)
            g.write(') rt.defer(%s);\n' % ftemp)
            g.writeline('else rt.defer(%s)' % atemp)
        g.writeline('};')
        g.write_with_indentation('if (')
        self.times.generate_code(g)
        g.write(' > 0) rt.defer(%s);\n' % ftemp)
        g.writeline('%s = function() {' % atemp)
        g.frame.postpone('};')


class RepeatUntilNode(Node):

    def __init__(self, condition, body):
        self.condition = condition
        self.body = body

    def generate_code(self, g):
        def generate_jump(indirect=False):
            g.write_with_indentation('if (!(')
            self.condition.generate_code(g)
            g.write(')) rt.defer(%s);\n' % ftemp)
            callable = atemp
            if indirect:
                callable = 'function() { %s(); }' % atemp
            g.writeline('else rt.defer(%s);' % callable)
        ftemp = g.next_identifier()
        atemp = g.next_identifier()
        g.writeline('var %s;' % atemp)
        g.writeline('var %s = function() {' % ftemp)
        with g.subframe():
            for node in self.body:
                node.generate_code(g)
            generate_jump()
        g.writeline('};')
        generate_jump(True)
        g.writeline('%s = function() {' % atemp)
        g.frame.postpone('};')


class ForAsLongKeyPressedNode(Node):

    def __init__(self, key, body):
        self.key = key
        self.body = body

    def generate_code(self, g):
        temp = g.next_identifier()
        kc = dump_json(get_key_code(self.key))
        g.writeline('rt.subscribeKeyDown(%s, function() {' % kc)
        with g.indented_block():
            g.writeline('var %s = function() {' % temp)
            with g.subframe():
                for node in self.body:
                    node.generate_code(g)
                g.writeline('if (rt.isKeyDown(%s)) rt.defer(%s);' % (kc, temp))
            g.writeline('};')
            g.writeline('rt.defer(%s);' % temp)
        g.writeline('});')


class WhenSpriteClickedNode(Node):

    def __init__(self, body):
        self.body = body

    def generate_code(self, g):
        g.writeline('rt.subscribeToClick(%s, function() {' % g.sprite.var)
        with g.subframe():
            for node in self.body:
                node.generate_code(g)
        g.writeline('});')


class ReceiveMessageNode(Node):

    def __init__(self, message, body):
        self.message = message
        self.body = body

    def generate_code(self, g):
        msg = dump_json(self.message)
        g.writeline('rt.subscribeToMessage(%s, function() {' % msg)
        with g.subframe():
            for node in self.body:
                node.generate_code(g)
        g.writeline('});')


class SendMessageNode(Node):

    def __init__(self, message):
        self.message = message

    def generate_code(self, g):
        g.writeline('rt.sendMessage(%s);' % dump_json(self.message))


class CustomDrawNode(Node):

    def __init__(self, body):
        self.body = body

    def generate_code(self, g):
        g.writeline('%s.customDraw = function() {' % g.sprite.var)
        with g.subframe():
            for node in self.body:
                node.generate_code(g)
        g.writeline('};')


class StampNode(Node):

    def generate_code(self, g):
        g.writeline('%s.lowlevelDraw(rt);' % g.sprite.var)


class TranslateDrawNode(Node):

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def generate_code(self, g):
        g.write_with_indentation('rt.ctx.translate(')
        self.x.generate_code(g)
        g.write(', ')
        self.y.generate_code(g)
        g.write(');\n')


class SoundNode(Node):

    def __init__(self, sound):
        self.sound = sound

    def generate_code(self, g):
        g.writeline(g.sound_var(self.sound) + '.play();')


class PlaySoundNode(SoundNode):

    def generate_code(self, g):
        g.sounds.add(self.sound)
        g.writeline(g.sound_var(self.sound) + '.play();')


class PauseSoundNode(SoundNode):

    def generate_code(self, g):
        g.writeline(g.sound_var(self.sound) + '.pause();')


class StopSoundNode(SoundNode):

    def generate_code(self, g):
        g.writeline(g.sound_var(self.sound) + '.pause();')
        g.writeline(g.sound_var(self.sound) + '.currentTime = 0;')


class DisableInputNode(Node):

    def generate_code(self, g):
        g.writeline('rt.inputDisabled = true;')


class EnableInputNode(Node):

    def generate_code(self, g):
        g.writeline('rt.inputDisabled = false;')


def generate_code(file, node):
    assert isinstance(node, ApplicationNode)
    file.write('var ISKApplication = ')
    g = JSGenerator(file)
    node.generate_code(g)
    file.write(';\n')
