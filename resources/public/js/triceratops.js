var triceratops = function() {
  var socket, self, editor, hline, workspace;
  var coders = {};

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
      socket.send(JSON.stringify(message));
    } else {
      alert('The WebSocket is not open!');
    }
  };

  // CODERS
  var coder = function(base) {
    return {
      nick: base.nick,
      color: "#bb3377"
    };
  };

  var updateCodersList = function(codersMaster) {
    var codersList = _.map(_.keys(codersMaster), function(nick) {return '<li style="color: '+codersMaster[nick].color+'">'+nick+'</li>'}).join('');
    $('#coders ul').html(codersList);
  };

  var updateCursor = function(nick, cursor) {
    var next = {line: cursor.line, ch: cursor.ch+1};
    var other = coders[nick];

    if (other.box) other.box.clear();
    other.cursor = cursor;
    other.box = editor.markText(cursor, next, 'other');
  }

  var updateCode = function(message) {
    console.log(message);
    if (message.nick !== self.nick) {
      editor.replaceRange(message.info.text[0], message.info.from, message.info.to);
    }
  }

  var addCoder = function(base) {
    coders[base.nick] = coder(base);
    updateCodersList(coders);
  };

  var commands = {
    coders: function(message) {
      coders = message.coders;
      updateCodersList(coders);
    },
    connect: function(message) {
      addCoder(message); 
    },
    say: function(message) {
      $('#out').append('<div class="chat"><span class="nick">'+message.nick+': </span><span class="statement">'+message.message+"</span></div>");
    },
    cursor: function(message) {
      updateCursor(message.nick, message.cursor);
    },
    code: function(message) {
      updateCode(message);
    },
    disconnect: function(message) {
      delete coders[message.nick];
      updateCodersList(coders);
      $('#out').append(message.nick+" left<br/>");
    }
  }

  var receive = function(raw) {
    var message = JSON.parse(raw);
    commands[message.op](message);
  };

  var identify = function(nick) {
    self = coder({nick: nick});
    send({
      op: 'identify', 
      message: nick
    });

    $('#nick').hide();
    $('#funnel').show();
  };

  var say = function(voice) {
    send({
      workspace: workspace,
      nick: self.nick,
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
    editor.setLineClass(hline, null);
    hline = editor.setLineClass(editor.getCursor().line, "activeline");
    self.cursor = editor.getCursor();
    self.selection = editor.getSelection();
    send({
      workspace: workspace,
      nick: self.nick, 
      op: 'cursor', 
      cursor: self.cursor, 
      selection: self.selection
    });
  }

  var compareCursors = function(a, b) {
    console.log(''+a.ch+' '+b.ch);
    return (a.line === b.line) && ((a.ch === b.ch) || (1 === a.ch - b.ch));
  }

  var codeChange = function(editor, info) {
    console.log(info);
    self.cursor = editor.getCursor();
    self.selection = editor.getSelection();
    if (compareCursors(self.cursor, info.from)) {
      send({
        workspace: workspace,
        nick: self.nick, 
        op: 'code', 
        info: info
      });
    }
  }

  var setupCodeMirror = function() {
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
      mode: "javascript",
      lineNumbers: true,
      onCursorActivity: cursorActivity, 
      onChange: codeChange
    });
    hline = editor.setLineClass(0, "activeline");
  };

  var hatch = function() {
    window.onstatechange = function() {routing.act()};
    openWebSocket();
    routing.act();
  };

  var die = function() {
    send({
      nick: self.nick, 
      op: 'disconnect'
    });

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

  var home = function() {
    $.ajax({
      url: '/a/home',
      success: function(body) {
        $('#triceratops').html(body);

        watchInput('#nick input', identify);
        watchInput('#funnel input', function(val) {
          workspace = val;
          routing.go('/w/'+val);
        });

        $('#funnel').hide();
      }
    });
  };

  var workspace = function() {
    if (!self) {
      routing.go('/');
    } else {
      $.ajax({
        url: '/a/workspace',
        success: function(body) {
          $('#triceratops').html(body);

          watchInput('#voice input', say);
          gl.init();
          gl.animate();
          setupCodeMirror();
        }
      });
    }
  }

  routing.add('/', 'home', home);
  routing.add('/w/:workspace', 'workspace', workspace);

  return {
    send: send,
    hatch: hatch,
    die: die,
    home: home,
    gl: gl,
    coders: coders,

    self: function() {return self},
    editor: function() {return editor}
  };
}();
