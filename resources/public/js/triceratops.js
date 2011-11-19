var socket;
var name;

function openWebSocket() {
  if (window.WebSocket) {
    socket = new WebSocket('ws://triceratops.me:11122');
    socket.onopen    = function(event) { $('#alert').html('channel open!'); };
    socket.onclose   = function(event) { $('#alert').html('channel closed'); };
    socket.onmessage = function(event) { parse(event.data); };
  } else {
    alert('Your browser does not support WebSockets yet.');
  }
}

function init() {
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

function closeWebSocket() {
  socket.close();
}

function send(message) {
  if (!window.WebSocket) { return; }
  if (socket.readyState == (WebSocket.OPEN || 1)) {
    socket.send(message);
  } else {
    alert('The WebSocket is not open!');
  }
}

function parse( response ) {
  $('#out').append(response+"<br/>");
}

function sendName() {
  name = $('#name').val();
  send(name); 
  $('title').html(name);
  $('#pre').hide();
  $('#chat').show();
}

function sendVoice() {
  send($('#voice').val()); 
  $('#voice').val('');
}

