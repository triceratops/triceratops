var triceratops = function() {
  var socket;
  var name;
  var editor;
  var hline;

  var openWebSocket = function() {
    if (window.WebSocket) {
      socket = new WebSocket('ws://127.0.0.1:11122');
      socket.onopen    = function(event) { $('#alert').html('channel open!'); };
      socket.onclose   = function(event) { $('#alert').html('channel closed'); };
      socket.onmessage = function(event) { parse(event.data); };
    } else {
      alert('Your browser does not support WebSockets yet.');
    }
  };

  var closeWebSocket = function() {
    socket.close();
  }

  var send = function(message) {
    if (!window.WebSocket) { return; }
    if (socket.readyState == (WebSocket.OPEN || 1)) {
      socket.send(message);
    } else {
      alert('The WebSocket is not open!');
    }
  }

  var parse = function( response ) {
    $('#out').append(response+"<br/>");
  }

  var sendName = function() {
    name = $('#name').val();
    send(name); 
    $('title').html(name);
    $('#pre').hide();
    $('#chat').show();
  }



  var sendVoice = function() {
    send($('#voice').val()); 
    $('#voice').val('');
  }

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

      renderer = new THREE.WebGLRenderer();
      renderer.setSize( window.innerWidth, window.innerHeight );

      document.body.appendChild( renderer.domElement );
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

  var setupCodeMirror = function() {
    editor = CodeMirror.fromTextArea(document.getElementById("code"), {
      mode: "javascript",
      lineNumbers: true,
      onCursorActivity: function() {
        editor.setLineClass(hlLine, null);
        hlLine = editor.setLineClass(editor.getCursor().line, "activeline");
      }
    });
    hlLine = editor.setLineClass(0, "activeline");
  };

  var hatch = function() {
    setupCodeMirror();
    openWebSocket();

    $('#chat').hide();
    $('#name').keypress(function(e) {
      if (e.which === 13) {
        sendName();
      }
    });

    $('#code').keypress(function(e) {
      if (e.which === 13) {
        sendVoice();
      }
    });

    gl.init();
    gl.animate();
  }

  var die = function() {
    closeWebSocket();
  }

  return {
    send: send,
    hatch: hatch,
    die: die,
    gl: gl
  }
}();
