var ws;
var pc;
var uuid = generateID();
var remoteUuid;
var configuration = {
    'iceServers': [{
        'urls': ['stun:stun.l.google.com:19302' ]
    }]
};

function generateID(){
    return 'xxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
}

function checkRemoteUuid(){
    if(remoteUuid){
        return true;
    }
    let uuidElements = document.getElementsByClassName('uuid remote');
    let uuidElement = uuidElements[0];
    uuidElement.value="INSERT UUID";
    return false;
}

function setRemoteUuid(){
    let uuidElements = document.getElementsByClassName('uuid remote');
    let uuidElement = uuidElements[0];
    remoteUuid = uuidElement.value;
    console.log('set remote uuid:', remoteUuid);
    return remoteUuid;
}

window.onload = function(){
    console.log("window loaded");
    connect();
}

function connect(){
    console.log("connecting started");
    let uuidElements = document.getElementsByClassName('uuid');
    let uuidElement = uuidElements[0];
    uuidElement.value=uuid;
    
    ws = new WebSocket('ws://app-webrtc2020.herokuapp.com/socket');
    // ws = new WebSocket('ws://localhost:8080/socket');
    ws.onopen = function(){
        console.log('ws opened');
        pcCreate();
    };
    ws.onmessage = function(msg){
        const content = JSON.parse(msg.data);
        if(content.uuid === uuid){
            console.log('skip own messsage');
            return;
        }
        console.log('ws message: ',msg);
        const event = content.event;
        const data = content.data;
        switch (event){
            case "offer":
                handleOffer(data);
                break;
            case "answer":
                handleAnswer(data);
                break;
            case "call":
                handleCall(content);
                break;
            case "candidate":
                handleCandidate(data);
                break;
        }
    }
    ws.onclose = function(){
        connect();
    }
}

function stop(){
    createMsg("Call has been canceled");
    if(localStream){
        let localTracks = localStream.getTracks();
        localTracks.forEach(function(track) {
            track.stop();
        });
        document.getElementById('circleOne').className = "circle whiteColor";
    }
    if(remoteStream){
        let remoteTracks = remoteStream.getTracks();
        remoteTracks.forEach(function(track) {
            track.stop();
        });
        document.getElementById('circleTwo').className = "circle whiteColor";
    }
      localStream = null;
      remoteStream = null;
    document.getElementById('remote').srcObject = null;
    document.getElementById('local').srcObject = null;
    if(pc) pc.close();
    pc = null;
    pcCreate();
    callLine = 'none';
    console.log('pc closed');
}

var callLine = 'none'; // phone line has 3 states: in, out, none, busy
function makeCall(){
    if(callLine === 'none'){ //outcoming call
        createLocalMedia();
        send({
            event: "call",
            uuid: uuid,
            remoteUuid: setRemoteUuid()
        });
        callLine = 'out';
        console.log('outcoming call');
        return;
    }
    if(callLine === 'in'){ //incoming call
        call();
        callLine = 'busy';
        console.log('incoming call');
        return;
    }
}

function call(){
    createLocalMedia();
    setRemoteUuid();
    if(!checkRemoteUuid()){
        return;
    }
    createOffer();
}

var remoteStream; //remote media stream
var localStream; //local media stream
function createLocalMedia(){
    navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
    }).then(function(stream){
        document.getElementById('local').srcObject = stream;
        pc.addTrack(stream.getTracks()[0], stream);
        localStream = stream;
        document.getElementById('circleOne').className = "circle redColor";
    });
}

function pcCreate(){
    pc = new RTCPeerConnection(configuration,
        {
        optional : [ {
            RtpDataChannels : true
        } ]
    }
    );

    pc.onopen = function(){
        console.log('pc opened');
    }

    pc.onmessage = function(msg){
        console.log('pc message: ', msg);
        
    }

    pc.onclose = function(){
        console.lot('pc closed');
    }

    pc.onicecandidate = function(event){
        console.log('pc.onicecandidate', event);
        if (event.candidate) {
            send({
                event : "candidate",
                data : event.candidate,
                uuid : uuid,
                remoteUuid: remoteUuid
            });
        }
    }

    pc.ontrack = function(event){
        console.log('pc.ontrack', event);
        document.getElementById('remote').srcObject = event.streams[0];
        remoteStream = event.streams[0];
        document.getElementById('circleTwo').className = "circle redColor";
    }

    console.log('pcCreate done');
}

function createOffer(){
    if(pc.iceConnectionState === "connected"){
        return;
    }
    pc.createOffer(function(offer) {
        send({
            event: "offer",
            data: offer,
            uuid: uuid,
            remoteUuid: remoteUuid
        });
        pc.setLocalDescription(offer);
        console.log("pc.createOffer setLocalDescription: ", offer);
    }, function(err) {
        console.log("pc cannot create offer");
    });
}

function send(message) {
        ws.send(JSON.stringify(message));
        console.log('send message: ', message);
}

function handleOffer(offer){
    console.log('got offer: ',offer);
    // pc.setRemoteDescription(new RTCSessionDescription(offer));
    pc.setRemoteDescription(offer);
    // create and send an answer to an offer
    pc.createAnswer(function(answer) {
        pc.setLocalDescription(answer);
        send({
            event : "answer",
            data : answer,
            uuid: uuid,
            remoteUuid: remoteUuid
        });
        console.log('pc.createAnswer: ', answer);
    }, function() {
        console.log('pc.createAnswer error');
    });
}

function handleAnswer(answer){
    pc.setRemoteDescription(answer);
    console.log("handleAnswer, setRemoteDescription: ", answer);
    createOffer();
}

function handleCall(content){
    let uuidElements = document.getElementsByClassName('uuid remote');
    let uuidElement = uuidElements[0];
    uuidElement.value = content.uuid;
    console.log('handleCall: ', content);
    createMsg("YOU HAVE A CALL");
    callLine ='in';
}

function handleCandidate(candidate){
    pc.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('handleCandidate: ', candidate);
}

function createMsg(msg) {
    var line = document.getElementById("line");
    line.innerHTML = "<h3 id=\"msg\">"+msg+"</h3>";
    console.log("message: ", msg);
}
