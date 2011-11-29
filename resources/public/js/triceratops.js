var triceratops = function() {
  var socket;
  var name;
  var editor;
  var hline;

  var openWebSocket = function() {
    if (window.MozWebSocket) {
      window.WebSocket = window.MozWebSocket;
    }
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
  };

  var send = function(message) {
    if (!window.WebSocket) { return; }
    if (socket.readyState == (WebSocket.OPEN || 1)) {
      socket.send(message);
    } else {
      alert('The WebSocket is not open!');
    }
  };

  var parse = function( response ) {
    $('#out').append(response+"<br/>");
  };

  var identify = function() {
    name = $('#name').val();
    send(name); 
    $('title').html(name);
    $('#pre').hide();
    $('#workspace').show();
  };

  var say = function() {
    var voice = $('#voice').val() || ':say';
    send(":say "+voice);
    $('#voice').val('');
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

      // set up the sphere vars
      var radius = 50, segments = 16, rings = 16;

      var sphereMaterial = new THREE.MeshLambertMaterial(
        {
          color: 0xCC0000
        });

      // create a new mesh with sphere geometry -
      // we will cover the sphereMaterial next!
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

  var setupCodeMirror = function() {
    editor = CodeMirror.fromTextArea(document.getElementById("code"), {
      mode: "javascript",
      lineNumbers: true,
      onCursorActivity: function() {
        editor.setLineClass(hline, null);
        hline = editor.setLineClass(editor.getCursor().line, "activeline");
      }
    });
    hline = editor.setLineClass(0, "activeline");
  };

  var hatch = function() {
    setupCodeMirror();
    openWebSocket();

    $('#workspace').hide();
    $('#name').keypress(function(e) {
      if (e.which === 13) {
        identify();
      }
    });

    $('#voice').keypress(function(e) {
      if (e.which === 13) {
        say();
      }
    });

    gl.init();
    gl.animate();
  };

  var die = function() {
    send(':leave');
    closeWebSocket();
  };

  return {
    send: send,
    hatch: hatch,
    die: die,
    gl: gl
  };
}();
