var triceratops = function() {
  var socket, self, editor, hline;
  var cursors = {};

  var self = linkage.link({});
  var place = linkage.link({});
  var workspace = linkage.link({});
  var workspaces = linkage.link({});
  var coders = linkage.link({});

  // WEBSOCKETS
  var openWebSocket = function() {
    if (window.MozWebSocket) {
      window.WebSocket = window.MozWebSocket;
    }
    if (window.WebSocket) {
      socket = new WebSocket('ws://127.0.0.1:11122');
      socket.onopen    = function(event) { $('#alert').html('channel open!'); };
      socket.onclose   = function(event) { $('#alert').html('channel closed'); };
      socket.onmessage = function(event) { receive(event.data); };
    } else {
      alert('Your browser does not support WebSockets yet.');
    }
  };

  var closeWebSocket = function() {
    socket.close();
  };

  var send = function(message) {
    if (!window.WebSocket) { return; }
    if (socket.readyState == (WebSocket.OPEN || 1)) {
      var encoded = JSON.stringify(message);
      console.log("<-- "+encoded);
      socket.send(encoded);
    } else {
      alert('The WebSocket is not open!');
    }
  };

  // CODERS
  var updateCursor = function(message) {
    var nick = message.nick;
    var cursor = message.cursor;
    var ws = message.workspace;

    var next = {line: cursor.line, ch: cursor.ch+1};
    if (coders()[nick]) {
      if (cursors[nick]) cursors[nick].clear();
      cursors[nick] = editor.markText(cursor, next, {className: nick+'cursor other'});

      workspaces()[ws].cursors[nick] = message.cursor;
      coders()[nick].cursors[ws] = message.cursor;
    }
  }

  var updateCode = function(message) {
    if (message.nick !== self().nick) {
      editor.replaceRange(message.info.text[0], message.info.from, message.info.to);
    }
  }

  var coderConnect = function(base) {
    coders.update(base.coder.nick, base.coder);
  };

  var coderJoin = function(base) {
    workspaces.update(base.workspace.name, base.workspace);
    if (base.coder.nick === self().nick || base.workspace.name === workspace().name) {
      workspace(base.workspace);
    }
  };

  var coderSay = function(message) {
    $('#out')
      .append('<div class="chat"><span class="nick">'
              +message.nick
              +': </span><span class="statement">'
              +message.message
              +"</span></div>");
  }

  var coderLeave = function(base) {
    if (workspaces()[base.workspace].cursors[base.nick]) {
      workspaces.delIn([base.workspace, 'cursors', base.nick]);
      workspace.delIn(['cursors', base.nick]);
      coders.delIn([base.nick, 'cursors', base.workspace]);
    }
  };

  var commands = {
    status: function(message) {
      // self(message.self);
      workspaces(message.workspaces);
      coders(message.coders);
    },
    connect: function(message) {
      coderConnect(message); 
    },
    join: function(message) {
      coderJoin(message); 
    },
    leave: function(message) {
      coderLeave(message);
    },
    say: function(message) {
      coderSay(message);
    },
    cursor: function(message) {
      updateCursor(message);
    },
    code: function(message) {
      updateCode(message);
    },
    disconnect: function(message) {
      coders.del(message.nick);
      $('#out').append(message.nick+" left<br/>");
    }
  }

  var receive = function(raw) {
    console.log("--> "+raw);
    var message = JSON.parse(raw);
    commands[message.op](message);
  };

  var say = function(voice) {
    send({
      workspace: workspace().name,
      nick: self().nick,
      op: 'say',
      message: voice
    });
  };

  var gl = function() {
    var camera, scene, renderer;
    var geometry, material, mesh;

    var init = function() {
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
      camera.position.z = 1000;
      scene.add( camera );

      geometry = new THREE.CubeGeometry( 200, 200, 200 );
      material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

      mesh = new THREE.Mesh( geometry, material );
      scene.add( mesh );

      var radius = 50, segments = 16, rings = 16;
      var sphereMaterial = new THREE.MeshLambertMaterial({
        color: 0xCC0000
      });

      var sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius,
                                 segments,
                                 rings),
        sphereMaterial);

      // add the sphere to the scene
      scene.add(sphere);

      // create a point light
      var pointLight = new THREE.PointLight( 0xFFFFFF );

      // set its position
      pointLight.position.x = 10;
      pointLight.position.y = 50;
      pointLight.position.z = 130;

      // add to the scene
      scene.add(pointLight);

      renderer = new THREE.WebGLRenderer();
      renderer.setSize( window.innerWidth, window.innerHeight );

      $('#gl').append( renderer.domElement );
    };

    var animate = function() {
      requestAnimationFrame( animate );
      render();
    };

    var render = function() {
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.02;

      renderer.render( scene, camera );
    };

    return {
      init: init,
      animate: animate,
      render: render,

      camera: camera, 
      scene: scene, 
      renderer: renderer,
      geometry: geometry, 
      material: material, 
      mesh: mesh
    };
  }();

  var cursorActivity = function() {
    var my = self();
    editor.removeLineClass(hline, null);
    hline = editor.addLineClass(editor.getCursor().line, "activeline");
    my.cursor = editor.getCursor();
    my.selection = editor.getSelection();
    send({
      workspace: workspace().name,
      nick: my.nick, 
      op: 'cursor', 
      cursor: my.cursor, 
      selection: my.selection
    });
  };

  var compareCursors = function(a, b) {
    return (a.line === b.line) && ((a.ch === b.ch) || (1 === a.ch - b.ch));
  };

  var unrollNext = function(info) {
    var full = info.text;
    while (info.next) {
      info = info.next;
      full += info.text;
    }
    return full;
  };

  var codeChange = function(editor, info) {
    var my = self();
    my.cursor = editor.getCursor();
    my.selection = editor.getSelection();
    info.text = unrollNext(info);

    console.log(info);
    if (info.origin === 'input') {
      send({
        workspace: workspace().name,
        nick: my.nick,
        op: 'code',
        info: info
        // code: editor.getValue()
      });
    }
  };

  var keyEvent = function(ed, e) {
    if (e.type === 'keypress' && e.keyIdentifier === "Enter") {
      console.log(ed.getCursor());
      send({
        workspace: workspace().name,
        nick: self().nick, 
        op: 'newline', 
        info: {
          from: ed.getCursor(),
          to: ed.getCursor()
        },
        code: editor.getValue()
      });
    }
  };

  var setupCodeMirror = function() {
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
      mode: "javascript",
      lineNumbers: true
      // onCursorActivity: cursorActivity, 
      // onChange: codeChange,
      // onKeyEvent: keyEvent
    });
    editor.on("change", codeChange);
    editor.on("cursorActivity", cursorActivity);
    hline = editor.addLineClass(0, "activeline");
  };

  var hatch = function() {
    window.onstatechange = function() {routing.act()};
    openWebSocket();
    routing.act();
  };

  var die = function() {
    if (self().nick) {
      if (workspace().name) {
        send({
          workspace: workspace().name,
          nick: self().nick,
          op: 'leave'
        });
      }

      send({
        nick: self().nick, 
        op: 'disconnect'
      });
    }

    closeWebSocket();
  };

  var watchInput = function(selector, callback) {
    $(selector).keypress(function(e) {
      if (e.which === 13) {
        var val = $(selector).val();
        callback(val);
        $(selector).val('');
      }
    });
  }

  var actions = {
    home: function(params) {
      return {
        name: '!home',
        url: '/a/home',
        arrive: function() {
          watchInput('#funnel input', function(val) {
            routing.go('/w/'+val);
          });
        },
        depart: function() {
          
        }
      }
    },

    workspace: function(params) {
      var updateWorkspace = function(updated) {
        var codersList = _.map(_.keys(updated.cursors), function(nick) {return '<li style="color: '+updated.cursors[nick].color+'">'+nick+'</li>'}).join('');
        $('#coders ul').html(codersList);
      };

      place.update('name', params.workspace);
      return {
        name: params.workspace,
        url: '/a/workspace',
        arrive: function() {
          watchInput('#voice input', say);
          gl.init();
          gl.animate();
          setupCodeMirror();
          workspace.watch(updateWorkspace);
          send({
            op: 'join',
            workspace: params.workspace,
            nick: self().nick
          });
        },

        depart: function() {
          workspace.unwatch(updateWorkspace);
        }
      }
    }
  };

  var chooseNick = function(after) {
    return function(nick) {
      self({
        nick: nick,
        color: '#5533cc',
        cursors: {}
      });

      send({
        op: 'connect', 
        nick: nick,
        color: self().color
      });

      $('#identify').hide();
      $('#triceratops').show();
      after();
    }
  };

  var identify = function(after) {
    $('#triceratops').hide();
    $('#identify').show();
    watchInput('#nick input', chooseNick(after));
  }

  var arrive = function(destination) {
    place(destination);
    $.ajax({
      url: destination.url,
      success: function(body) {
        $('#triceratops').html(body);
        destination.arrive();
      }
    });
  }

  var action = function(purpose) {
    return function(params) {
      var destination = purpose(params);
      var consummate = function() {
        if (place().depart) {
          place().depart();
        } 
        arrive(destination);
      }

      if (!self().nick) {
        identify(consummate);
      } else {
        consummate();
      }
    }
  }

  routing.add('/', 'home', action(actions.home));
  routing.add('/w/:workspace', 'workspace', action(actions.workspace));

  return {
    socket: socket,
    send: send,
    hatch: hatch,
    die: die,
    actions: actions,
    gl: gl,

    coders: coders,
    self: self,
    place: place,
    workspace: workspace,
    workspaces: workspaces,
    editor: function() {return editor}
  };
}();
