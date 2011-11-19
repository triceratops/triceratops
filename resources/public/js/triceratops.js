var triceratops = function() {
  var socket;
  var name;

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

  var hatch = function() {
    openWebSocket();

    $('#chat').hide();
    $('#name').keypress(function(e) {
      if (e.which === 13) {
        sendName();
      }
    });

    $('#voice').keypress(function(e) {
      if (e.which === 13) {
        sendVoice();
      }
    });
  }

  var die = function() {
    closeWebSocket();
  }

  return {
    send: send,
    hatch: hatch,
    die: die
  }
}();