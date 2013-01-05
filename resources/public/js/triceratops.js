var triceratops = function() {
  var socket, self, editor, hline;
  var cursors = {};

  var self = linkage.link({});
  var place = linkage.link({});
  var workspace = linkage.link({});
  var workspaces = linkage.link({});
  var coders = linkage.link({});

  var triceratopsHost = window.location.toString().match(/^https?:\/\/([^:/]+)/)[1];
  var triceratopsPort = 11122;

  var createWebSocket = function(host, port) {
    return new WebSocket('ws://'+host+':'+port);
  }

  // WEBSOCKETS
  var openWebSocket = function() {
    if (window.MozWebSocket) {
      window.WebSocket = window.MozWebSocket;
    }
    if (window.WebSocket) {
      socket = createWebSocket(triceratopsHost, triceratopsPort);
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

  var evaluateCode = function(code) {
    try {
      eval(code);
      $('#error').html('');
    } catch(error) {
      $('#error').html(error.name+': '+error.message);
    }
  }

  var isCurrentWorkspace = function(ws) {
    return workspace().name === ws;
  }

  var setCursor = function(ws, nick, cursor) {
    var next = {line: cursor.line, ch: cursor.ch+1};
    if (coders()[nick]) {
      workspaces()[ws].cursors[nick] = cursor;
      coders()[nick].cursors[ws] = cursor;

      if (isCurrentWorkspace(ws)) {
        if (cursors[nick]) cursors[nick].clear();
        cursors[nick] = editor.markText(cursor, next, {className: nick+'cursor other'});
      }
    }
  }

  var updateCursor = function(message) {
    var ws = message.workspace;
    var nick = message.nick;
    var cursor = message.cursor;
    setCursor(ws, nick, cursor);
  }

  var updateCode = function(message) {
    if (message.nick !== self().nick) {
      editor.replaceRange(message.info.text, message.info.from, message.info.to);
      evaluateCode(editor.getValue());
    }
  }

  var coderConnect = function(base) {
    coders.update(base.coder.nick, base.coder);
  };

  var coderJoin = function(base) {
    workspaces.update(base.workspace.name, base.workspace);
    var selfJoin = base.coder.nick === self().nick;
    if (selfJoin || isCurrentWorkspace(base.workspace.name)) {
      workspace(base.workspace);

      if (selfJoin) editor.setValue(base.workspace.code.join("\n"));

      for (var nick in base.workspace.cursors) {
        var cursor = base.workspace.cursors[nick].pos;
        setCursor(base.workspace.name, nick, cursor);
      }

      if (selfJoin) evaluateCode(editor.getValue());
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
      if (cursors[base.nick]) cursors[base.nick].clear();
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

  var joinIfArray = function(something) {
    if (something instanceof Array) {
      return something.join("");
    } else {
      return something;
    }
  }

  var previousLine = function(pos) {
    var previous = pos.line - 1;
    if (previous < 0) {
      return {line: 0, ch: 0};
    } else {
      console.log("previous"+previous);
      var line = editor.lineInfo(previous);
      console.log("line text: "+line.text);
      return {line: previous, ch: line.text.length - 1};
    }
  }

  var unrollNext = function(info) {
    console.log(info);
    var full = joinIfArray(info.text);
    var to = info.to;
    var from = info.from;

    if ('\n' === info.text[0]) {
      from = previousLine(from);
    }

    if (info.origin === 'delete') {
      return {text: '', from: from, to: to}
    } else if (!info.next && full === '') {
      full += "\n";
    }

    while (info.next) {
      info = info.next;
      full += "\n" + joinIfArray(info.text);
    }

    return {text: full, from: from, to: to};
  };

  var codeChange = function(editor, info) {
    var my = self();
    my.cursor = editor.getCursor();
    my.selection = editor.getSelection();
    var message = unrollNext(info);

    if (info.origin === 'input' || info.origin === 'delete') {
      send({
        workspace: workspace().name,
        nick: my.nick,
        op: 'code',
        info: message
      });
    }

    evaluateCode(editor.getValue());
  };

  // var keyEvent = function(ed, e) {
  //   if (e.type === 'keypress' && e.keyIdentifier === "Enter") {
  //     console.log("ENTER"+ed.getCursor());
  //     send({
  //       workspace: workspace().name,
  //       nick: self().nick, 
  //       op: 'newline', 
  //       info: {
  //         from: ed.getCursor(),
  //         to: ed.getCursor()
  //       },
  //       code: editor.getValue()
  //     });
  //   }
  // };

  var setupCodeMirror = function() {
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
      mode: "javascript",
      lineNumbers: true
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

    coders: coders,
    self: self,
    place: place,
    workspace: workspace,
    workspaces: workspaces,
    editor: function() {return editor}
  };
}();
