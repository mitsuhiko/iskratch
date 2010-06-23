from iskprototype import *

# the background image
background = SpriteNode('Background', costumes=[
    'background.png'
])

background.code = [
    ForeverNode([
        SetXNode(SubNode(GetXNode(), ConstNode(5))),
        IfNode(LeNode(GetXNode(), ConstNode(-640)), [
            SetXNode(ConstNode(0))
        ], []),
        WaitNode(ConstNode(0.05))
    ]),
    CustomDrawNode([
        StampNode(),
        TranslateDrawNode(ConstNode(640), ConstNode(0)),
        StampNode()
    ])
]

# the octopus
octopus = SpriteNode('Octopus', costumes=[
    'octopus1.png',
    'octopus2.png'
], x=50, y=120)

# attach code that animates that thing
octopus.code = [
    SetNode(SpriteVariableNode('life'), ConstNode(3)),
    ForeverNode([
        WaitNode(ConstNode(0.15)),
        NextCostumeNode()
    ]),
    ForAsLongKeyPressedNode('arrow up', [
        IfNode(GtNode(GetYNode(), ConstNode(30)), [
            SetYNode(SubNode(GetYNode(), ConstNode(15)))
        ], []),
        WaitNode(ConstNode(0.1))
    ]),
    ForAsLongKeyPressedNode('arrow down', [
        IfNode(LtNode(GetYNode(), ConstNode(340)), [
            SetYNode(AddNode(GetYNode(), ConstNode(15)))
        ], []),
        WaitNode(ConstNode(0.1))
    ]),
    ForAsLongKeyPressedNode('arrow left', [
        IfNode(GtNode(GetXNode(), ConstNode(0)), [
            SetXNode(SubNode(GetXNode(), ConstNode(15)))
        ], []),
        WaitNode(ConstNode(0.1))
    ]),
    ForAsLongKeyPressedNode('arrow right', [
        IfNode(LtNode(GetXNode(), ConstNode(200)), [
            SetXNode(AddNode(GetXNode(), ConstNode(15)))
        ], []),
        WaitNode(ConstNode(0.1))
    ]),
    ReceiveMessageNode('player touched starfish', [
        PlaySoundNode('rattle.ogg'),
        SetNode(SpriteVariableNode('life'),
                SubNode(SpriteVariableNode('life'),
                        ConstNode(1))),
        IfNode(LeNode(SpriteVariableNode('life'), ConstNode(0)), [
            DisableInputNode(),
            ThinkNode(ConstNode('Ouch!  That was too much')),
            RepeatUntilNode(GtNode(GetYNode(), ConstNode(350)), [
                SendMessageNode('hide starfish'),
                SetYNode(AddNode(GetYNode(), ConstNode(18))),
                WaitNode(ConstNode(0.025))
            ]),
            StopAllNode()
        ], [
            ThinkForNode(ConstNode(1), ConcatNode(ConstNode('Ouch! Lifes left: '),
                                                  SpriteVariableNode('life')))
        ])
    ])
]

# the starfish
starfish = SpriteNode('Starfish', costumes=[
    'starfish1.png',
    'starfish2.png'
], x=640, y=120)

starfish.code = [
    ForeverNode([
        WaitNode(ConstNode(0.3)),
        NextCostumeNode(),
        RotateNode(ConstNode(15))
    ]),
    ForeverNode([
        WaitNode(ConstNode(0.1)),
        SetXNode(SubNode(GetXNode(), AddNode(ConstNode(15),
            RandomNumberNode(ConstNode(5), ConstNode(15))))),
        IfNode(SpriteTouchesNode(octopus, ConstNode(40)), [
            SendMessageNode('reset starfish'),
            SendMessageNode('player touched starfish'),
            SayForNode(ConstNode(2), ConstNode('Gotcha!'))
        ], [
            IfNode(LeNode(GetXNode(), ConstNode(-120)), [
                SendMessageNode('reset starfish')
            ], [])
        ])
    ]),
    ReceiveMessageNode('reset starfish', [
        SetXNode(AddNode(ConstNode(640),
                         RandomNumberNode(ConstNode(0), ConstNode(50)))),
        SetYNode(RandomNumberNode(ConstNode(80), ConstNode(400)))
    ]),
    ReceiveMessageNode('hide starfish', [
        HideNode(),
        SetXNode(ConstNode(9999999))
    ]),
    WhenSpriteClickedNode([
        PlaySoundNode('bump.ogg'),
        SayForNode(ConstNode(0.5), ConstNode('Hey!'))
    ])
]

# create the application with one sprite
app = ApplicationNode()
app.sprites.append(background)
app.sprites.append(octopus)
app.sprites.append(starfish)

# and write it to the application.js file
with open('application.js', 'w') as f:
    generate_code(f, app)
