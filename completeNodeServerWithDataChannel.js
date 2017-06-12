var static = require('node-static');

var https = require('https');

// Change directory to path of current JavaScript program
var process = require('process');
process.chdir(__dirname);
//descomentar las dos líneas anteriores si no se quiere poner el subdirectorio al final, por ej. https://...:8080/cap5/

// Read key and certificates required for https
var fs = require('fs');
var path = require('path');

var options = {
  key: fs.readFileSync(path.join(__dirname,'key.pem')),
  //key: fs.readFileSync(path.join(__dirname,'key.pem')),
  cert: fs.readFileSync(path.join(__dirname,'cert.pem'))
};
// Create a node-static server instance
var file = new(static.Server)();

// We use the http moduleÕs createServer function and
// rely on our instance of node-static to serve the files
var app = https.createServer(options, function (req, res) {
  file.serve(req, res);
}).listen(8080);

// Use socket.io JavaScript library for real-time web applications
var io = require('socket.io').listen(app);

//Lista de clientes
var clientes = [];

// Let's start managing connections...
io.sockets.on('connection', function (socket){
    
  //Evento que se ejecuta cuando algun usuario cierra su navegador
 socket.on('disconnect', function () {  
     var i = clientes.indexOf(socket);
      clientes.splice(i, 1);
     console.log('Se ha ido uno. Lista de clientes: ', clientes);
    socket.broadcast.emit('user disconnected', clientes);
  });

  socket.on('create or join', function (room,username) { // Handle 'create or join' messages
    var numClients = io.sockets.adapter.rooms[room]?io.sockets.adapter.rooms[room].length:0;
    clientes.push({username:username, room:room});
    console.log('S --> Room ' + room + ' has ' + numClients + ' client(s)');
    console.log('S --> Request to create or join room', room);
    console.log('lista de clientes: ', clientes);

    if(numClients == 0){ // First client joining...
      socket.join(room);
      socket.emit('created', room, username);
    } else if (numClients <= 4) { // ...
      io.sockets.in(room).emit('join', room,clientes, numClients);
      socket.join(room);
      socket.emit('joined', room, clientes);
    } else { // max 4 clients
      socket.emit('full', room);
    }
  });

  socket.on('message', function (message) { // Handle 'message' messages
    console.log('S --> got message: '+message.message+' from: '+message.username);
    // channel-only broadcast...
    socket.broadcast.to(message.channel).emit('message', message);
  });

  function log(){
    var array = [">>> "];
    for (var i = 0; i < arguments.length; i++) {
      array.push(arguments[i]);
    }
    socket.emit('log', array);
  }

});
