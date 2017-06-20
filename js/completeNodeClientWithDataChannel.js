'use strict';

// Look after different browser vendors' ways of calling the getUserMedia() API method:
// Opera --> getUserMedia
// Chrome --> webkitGetUserMedia
// Firefox --> mozGetUserMedia
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// Clean-up function:
// collect garbage before unloading browser's window
window.onbeforeunload = function(e){
  hangup();
}

// Data channel information
var sendChannel, receiveChannel;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
//var receiveTextarea = document.getElementById("dataChannelReceive");

//area de mensajes
var div = document.getElementById('mensajes');

// HTML5 <video> elements
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

// Handler associated with 'Send' button
//sendButton.onclick = sendData;

// Flags...
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;

// WebRTC data structures
// Streams
var localStream;
var remoteStream;
// Peer Connection
var pc;

// Peer Connection ICE protocol configuration (either Firefox or Chrome)
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // IP address
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]
};
  
var pc_constraints = {
  'optional': [ {'DtlsSrtpKeyAgreement': true} ]
};

// Session Description Protocol constraints:
var sdpConstraints = {};
/////////////////////////////////////////////

// Let's get started: prompt user for input (room name)
var room;
var username;
function funcionEntrar(){
    room = document.getElementById('channel').value;
    username = document.getElementById('uname').value;
    document.getElementById('id01').style.display='none';
    if ((room !== "") && (username != "")) {
	console.log('Intentando unirse o crear: ', room);
	// enviar el mensaje 'create or join' al servidor
	socket.emit('create or join', room, username);
    document.getElementById('roomName').insertAdjacentHTML('afterbegin',room);
    } else {
        div.insertAdjacentHTML( 'beforeEnd', '<p class="system"> Nombre de usuario y/o de la sala vac\u00EDo. Actualice la p\u00E1gina y rellene todos los campos para continuar.</p><br>');
        alert("Complete los campos antes de continuar");
    }
}

//para habilitar el enter enviar
document.getElementById("uname").onkeydown = function () {
    if (window.event.keyCode == '13') {
        funcionEntrar();
    }
}
document.getElementById("channel").onkeydown = function () {
    if (window.event.keyCode == '13') {
        funcionEntrar();
    }
}
document.getElementById("mensajeEnviar").onkeydown = function () {
    if (window.event.keyCode == '13') {
        sendData();
    }
}


function funcionEnviar(){
	var myResponse = document.getElementById('mensajeEnviar').value;
    document.getElementById('mensajeEnviar').value = '';
    div.insertAdjacentHTML( 'beforeEnd', '<p class="local">' +
		myResponse + '</p><br>');
    myResponse = username+": "+myResponse;
	//Send it to remote peer (through server)
	/*socket.emit('message', {
		channel: room,
		message: myResponse,
        username:username});
        */
    return myResponse;
}

function iniciarVideollamada(){
    document.getElementById('videoContainer').style.display='block';
}

function finalizarVideollamada(){
    document.getElementById('videoContainer').style.display='none';
}

var urlServer = location.origin;
console.log("socket.io client connecting to server ", urlServer );
// Connect to signalling server
var socket = io.connect(urlServer);

// Set getUserMedia constraints
var constraints = {video: true, audio: true};

// From this point on, execution proceeds based on asynchronous events...

/////////////////////////////////////////////

// getUserMedia() handlers...
/////////////////////////////////////////////
function handleUserMedia(stream) {
  source: localStream = stream;
  attachMediaStream(localVideo, stream);
  console.log('Adding local stream.');
  sendMessage('got user media');
}

function handleUserMediaError(error){
  console.log('navigator.getUserMedia error: ', error);
}
/////////////////////////////////////////////


// Server-mediated message exchanging...
/////////////////////////////////////////////

// 1. Server-->Client...
/////////////////////////////////////////////

// Handle 'created' message coming back from server:
// this peer is the initiator
socket.on('created', function (clientes){
  console.log('Se ha creado la sala ' + room);
  isInitiator = true;
  actualizarListaNombres(clientes);
  div.insertAdjacentHTML( 'beforeEnd', '<p class="systemOK"> Se ha creado la sala '+room+'</p><br>');
    //document.getElementById("user0").insertAdjacentHTML('afterbegin',username);
  // Call getUserMedia()
  navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
  console.log('Getting user media with constraints', constraints);
  
  checkAndStart();
});

// Handle 'full' message coming back from server:
// this peer arrived too late :-(
socket.on('full', function (room){
  console.log('Room ' + room + ' is full');
  div.insertAdjacentHTML( 'beforeEnd', '<p class="system"> Esta sala est&aacute; llena, por favor, actualice la p&aacute;gina e int&eacute;ntelo de nuevo con otra sala</p><br>');
});

// nombre repetido
socket.on('repeated',function(){
  div.insertAdjacentHTML( 'beforeEnd', '<p class="system"> Este nombre est&aacute; siendo utilizado por otra persona, por favor, actualice la p&aacute;gina e int&eacute;ntelo de nuevo con otro nombre</p><br>');
});

/////////////////////////////////////////////////////////////////////////////////////
//Control de presencia
//Mensaje 'disconnected' que viene del servidor cuando otro usuario cierra el navegador
socket.on('other peer disconnected', function(clientes, username){
    console.log(username+' ha abandonado la conversaci&oacute;n');
    div.insertAdjacentHTML( 'beforeEnd', '<p class="system">'+username+' ha abandonado la conversaci\u00F3n</p><br>');
    actualizarListaNombres(clientes);
});
//Funcion para actualizar la lista de usuarios conectados. Coge el total de clientes y mira los que son de la misma sala
function actualizarListaNombres(clientes){
    //var roomClients = [];
    //cuenta con el índice de la nueva lista
    var j = 0;
    //limpiar la lista antigua. Pone vacios todos los campos user de index.html
    for (var i = 0; i < 2; i++) {
        document.getElementById("user"+i).innerHTML = ""; 
    }
    for (var i = 0; i < clientes.length; i++) {
      if(clientes[i].room == room){
          document.getElementById("user"+j).innerHTML = clientes[i].username; 
          j++;
          }
      }  
}

var fileInput = document.querySelector('input#fileInput');
fileInput.addEventListener('change', handleFileInputChange, false);
function handleFileInputChange(){
    document.getElementById("enviarArchivo").style.display = 'block';
}


function enviarArchivo() {
    document.getElementById("enviarArchivo").style.display = 'none';
  var file = fileInput.files[0];
    if(file.size==0){
        alert("Seleccione un archivo");
    }
  console.log('Enviando archivo');
  var chunkSize = 100000;
  var sliceFile = function(offset) {
    var reader = new window.FileReader();
    reader.onload = (function() {
      return function(e) {
          if(isInitiator){
               sendChannel.send("file");
               sendChannel.send(file.name);
               sendChannel.send(e.target.result);
          } else {
               receiveChannel.send("file");
               receiveChannel.send(file.name);
               receiveChannel.send(e.target.result);
          }
       
        if (file.size > offset + e.target.result.byteLength) {
          window.setTimeout(sliceFile, 0, offset + chunkSize);
        }
      };
    })(file);
    var slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  };
  sliceFile(0);
}

var downloadAnchor = document.querySelector('a#download');
function onReceiveMessageCallback(event, fileNameReceived) {
  // trace('Received Message ' + event.data.byteLength);
    console.log("reciviendo fichero");
  var receiveBuffer = [];
  receiveBuffer.push(event.data);
  var receivedSize = event.data.byteLength;
  // we are assuming that our signaling protocol told
  // about the expected file size (and name, hash, etc).
    var received = new window.Blob(receiveBuffer);
    receiveBuffer = [];
    downloadAnchor.href = URL.createObjectURL(received);
    downloadAnchor.download = fileNameReceived;
    downloadAnchor.textContent = "Haga click para descargar "+fileNameReceived;
    downloadAnchor.style.display = 'block'; 
}

// Handle 'join' message coming back from server:
// another peer is joining the channel
socket.on('join', function (clientes, username){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  //var roomClients = actualizarListaNombres(clientes, room);
  //var roomSize = roomClients.length-1;
  //document.getElementById("user"+roomSize).insertAdjacentHTML('afterbegin',roomClients[roomSize].username);
  isChannelReady = true;
  actualizarListaNombres(clientes);
  div.insertAdjacentHTML( 'beforeEnd', '<p class="systemOK"> Se ha conectado '+username+' a la sala '+room+'</p><br>');
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on('joined', function (clientes){
  console.log('This peer has joined room ' + room);
  isChannelReady = true;
  //var roomClients = actualizarListaNombres(clientes, room);
    //for (var i = 0; i < roomClients.length; i++) {
      // document.getElementById("user"+i).insertAdjacentHTML('afterbegin',roomClients[i].username);
    //}
  // Call getUserMedia()
  navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
  console.log('Getting user media with constraints', constraints);
  actualizarListaNombres(clientes);
  div.insertAdjacentHTML( 'beforeEnd', '<p class="systemOK">Se ha conectado con &eacute;xito a la sala '+room+'</p><br>');
});

// Server-sent log message...
socket.on('log', function (array){
  console.log.apply(console, array);
});

// Receive message from the other peer via the signalling server
socket.on('message', function (message){
  console.log('Received message:', message);
  if (message.message === 'got user media') {
    checkAndStart();
  } else if (message.message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      checkAndStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message.message));
    doAnswer();
  } else if (message.message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message.message));
  } else if (message.message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.message.label,
      candidate:message.message.candidate});
    pc.addIceCandidate(candidate);
  } else if (message.message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});
////////////////////////////////////////////////

// 2. Client-->Server
////////////////////////////////////////////////
// Send message to the other peer via the signalling server
function sendMessage(message){
  console.log('Sending message: ', message);
  socket.emit('message', {
              channel: room,
              message: message,
              username: username});
}
////////////////////////////////////////////////////

////////////////////////////////////////////////////
// Channel negotiation trigger function
function checkAndStart() {
  if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {  
    createPeerConnection();
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }
}

/////////////////////////////////////////////////////////
// Peer Connection management...
function createPeerConnection() {
    console.log("cretarepeerConnection");
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    
    console.log("Calling pc.addStream(localStream)! Initiator: " + isInitiator);
    pc.addStream(localStream);
    
    pc.onicecandidate = handleIceCandidate;
    console.log('Created RTCPeerConnnection with:\n' +
      '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
      '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.'); 
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }

  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;

  if (isInitiator) {
    try {
      // Create a reliable data channel
      sendChannel = pc.createDataChannel("sendDataChannel",
        {reliable: true});
      trace('Created send data channel');
    } catch (e) {
      alert('Failed to create data channel. ');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onmessage = handleMessage;
    sendChannel.onclose = handleSendChannelStateChange;
  } else { // Joiner    
    pc.ondatachannel = gotReceiveChannel;
  }
}

// Data channel management
function sendData() {
  var data = funcionEnviar();
  if(isInitiator) sendChannel.send(data);
  else receiveChannel.send(data);
  trace('Sent data: ' + data);
}
// Handlers...

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

//controlar los eventos recibidos en datachannel
var receivingFile=false;
var receivingFile2=false;
var fileNameReceived;
function handleMessage(event) {
  trace('Received message: ' + event.data);
    if(event.data == "file"){ 
        console.log("Estado 1");
        receivingFile=true;
    } else if (receivingFile == true){
        console.log("Estado 2");
        receivingFile = false;
        receivingFile2=true;
        fileNameReceived = event.data;
    } else if (receivingFile2 ==true){
        div.insertAdjacentHTML( 'beforeEnd', '<p class="remote">Has recibido un fichero. Mira en el men&uacute; lateral para descargarlo</p><br>');  
        onReceiveMessageCallback(event, fileNameReceived);
        receivingFile2 = false;
    } else{
        console.log("Normal");
     div.insertAdjacentHTML( 'beforeEnd', '<p class="remote">'+event.data+'</p><br>');   
    }
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
   // dataChannelSend.disabled = false;
    //dataChannelSend.focus();
    //dataChannelSend.placeholder = "";
    //sendButton.disabled = false;
  } else {
    //dataChannelSend.disabled = true;
    //sendButton.disabled = true;
  }
}

function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
	    //dataChannelSend.disabled = false;
	    //dataChannelSend.focus();
	    //dataChannelSend.placeholder = "";
	    //sendButton.disabled = false;
	  } else {
	    //dataChannelSend.disabled = true;
	    //sendButton.disabled = true;
	  }
}

// ICE candidates management
function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate});
  } else {
    console.log('End of candidates.');
  }
}

// Create Offer
function doCall() {
  console.log('Creating Offer...');
  pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Signalling error handler
function onSignalingError(error) {
	console.log('Failed to create signaling message : ' + error.name);
}

// Create Answer
function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, onSignalingError, sdpConstraints);  
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

/////////////////////////////////////////////////////////
// Remote stream handlers...

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  attachMediaStream(remoteVideo, event.stream);
  console.log('Remote stream attached!!.');
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}
/////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
// Clean-up functions...

function hangup() {
  socket.emit('user disconnected', username);
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  if (pc) pc.close();  
  pc = null;
  sendButton.disabled=true;
}

///////////////////////////////////////////
