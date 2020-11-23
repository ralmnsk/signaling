// variables -----------------------------------------
var conn;
var peerConnection;
var inStream;
var countIceCandidate = 0;
var countCalls = 0;
var msgPoints = "...";
var msg="You have a call";
var uuid;

// information message on the page
function createMsg(msg) {
    var line = document.getElementById("line");
    line.innerHTML = "<h3 id=\"msg\">"+msg+"</h3>";
    console.log("message: ", msg);
}

function changeMsg(msg){
    document.getElementById("msg").remove();
    // setTimeout(function (){console.log('delete msg')},3000);
    createMsg(msg);
}

//connecting to our signaling server

function createConnection(){
    if (uuid){
        conn = new WebSocket('wss://app-webrtc2020.herokuapp.com/socket');
    } else {
        let msg = "uuid is null, cannot connect to the server";
        changeMsg(msg);
        return;
    }

    conn.onopen = function() {
        initialize();
        changeMsg("connected to the signaling server");
    };

    conn.onclose = function () {
        if(closeStatus === "close") {
            changeMsg("Connection closed.");
            return;
        }
        reconnect();        
    };

    conn.onmessage = function(msg) {
        console.log("Got message", msg);
        let content = JSON.parse(msg.data);
        let data = content.data;
        if(content.uuid != uuid){
            console.log("recieved uuid is not equal to the user uuid: ", content.uuid);
            return;
        }
        switch (content.event) {
            // when somebody wants to call us
            case "offer":
                handleOffer(data);
                break;
            case "answer":
                handleAnswer(data);
                break;
            // when a remote peer sends an ice candidate to us
            case "candidate":
                handleCandidate(data);
                break;
            case "call":
                youHaveCall(data);
                break;
            case "hangUp":
                hangUp();
                break;
            default:
                break;
        }
    };
}

var closeStatus = "";
function closeConnection(status){
    closeStatus = status;
    conn.close();
    changeMsg("Disconnected from the signaling server");
}

function reconnect(){
    console.log("try to reconnect")
    if(!conn){
        createConnection();
    }
    // stopCall();
    createOffer("reconnect");
}
//-----------------general functions---------------------------------------------

function send(message) {
    conn.send(JSON.stringify(message));
}

//-----------------UUID functions---------------------------------------------

function createUUID(){
    // console.log("started create uuid");
    return 'xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        // console.log("create UUID: ", v.toString(16));
        return v.toString(16);
      });
}

window.onload = function () {
    setUUID();
}

function setUUID(){
    uuid = createUUID();
    const elements = document.getElementsByClassName('uuid');
    elements[0].value = createUUID();
    changeMsg("set uuid: "+uuid);
}

function setNewUUID(){
    const elements = document.getElementsByClassName('uuid');
    uuid = elements[0].value;
    changeMsg("New uuid was set: "+ uuid);
}

function generateUUID(){
    const elements = document.getElementsByClassName('uuid');
    const newUUID = createUUID();
    elements[0].value = newUUID;
    changeMsg("New uuid was generated: "+newUUID);
}

// peerConnection initialization ------------------------------------------------
function initialize() {
    let configuration = {
        'iceServers': [{
            'urls': ['stun:stun.l.google.com:19302' ]
        }]
    };

    peerConnection = new RTCPeerConnection(configuration,
        {
        optional : [ {
            RtpDataChannels : true
        } ]
    }
    );

    // Setup ice handling
    peerConnection.onicecandidate = function(event) {
        let isReconnect = false;
        if (event.candidate) {
            send({
                event : "candidate",
                data : event.candidate,
                uuid : uuid,
                isReconnect: isReconnect
            });
            countIceCandidate = countIceCandidate + 1;
            console.log("peerConnection.onicecandidate");
        }
    };
    peerConnection.ontrack = function (event) {
        inStream = new MediaStream();
        inStream.addTrack(event.track);
        document.getElementById("remoteVideo").srcObject = inStream;
        changeMsg('peerConnection.ontrack');
    };
    closeStatus = "";
}


function createOffer(isReconnect) {
    peerConnection.createOffer(function(offer) {
        send({
            event: "offer",
            data: offer,
            uuid: uuid,
            isReconnect: isReconnect
        });
        peerConnection.setLocalDescription(offer);
    }, function(err) {
        changeMsg("createOffer() :"+err);
    });
    changeMsg("createOffer()");
}

// handlers------------
function handleOffer(offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    let isReconnect;
    if (offer.isReconnect === true){
        isReconnect = true;
    }
    // create and send an answer to an offer
    peerConnection.createAnswer(function(answer) {
        peerConnection.setLocalDescription(answer);
        send({
            event : "answer",
            data : answer,
            uuid: uuid,
            isReconnect: isReconnect
        });
    }, function() {
        changeMsg("handleOffer");
    });

    peerConnection.onclose = function () {
        changeMsg('peerConnection closed');
    }
}


function handleCandidate(candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    // countIceCandidate = countIceCandidate + 1;
    changeMsg("handleCandidate");
}


function handleAnswer(answer) {
    let isReconnect = false;
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    if (answer.isReconnect){
        isReconnect = true;
    }
    changeMsg("handleAnswer(answer), countCalls :"+countCalls);
    if(countCalls > 0 && countIceCandidate == 0){
        createOffer(isReconnect);
    }
}

function youHaveCall(data){
    countCalls = countCalls+1;
    changeMsg('youHaveCall, countCalls :'+countCalls);
    if(data.isReconnect === true){
        call();
    }
}

// call commands ----------------------------------------------------------------
function call() {
    let isReconnect = false;
        createOffer();
    send({
        event:"call",
        data:"call",
        uuid: uuid,
        isReconnect: isReconnect
    });
    navigator.mediaDevices.getUserMedia({
        // video: {
        //     width: 480,
        //     height: 360
        // },
        video: false,
        audio: true
    })
        .then(function (stream) {
            document.getElementById("localVideo").srcObject = stream;
            peerConnection.addTrack(stream.getTracks()[0], stream);
        });

        changeMsg("call(): media track was added and createOffer was made");
}

function hangUp() {
    changeMsg(msgPoints);
    document.getElementById("remoteVideo").srcObject = null;
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    var stream = document.getElementById("localVideo").srcObject;
    if(stream){
        stream.stop = function (){
            this.getTracks().forEach(function(track) { track.stop(); });
        }
        stream.stop();
        countIceCandidate = 0;
        countCalls = 0;
        peerConnection.close();
        initialize();
    }

    var videos = document.getElementById("videos");
    document.getElementById("localVideo").remove();
    document.getElementById("remoteVideo").remove();
    videos.innerHTML += "<video id=\"localVideo\" autoplay></video><video id=\"remoteVideo\" autoplay></video>";
    changeMsg("hangUp()");
}

function stopCall() {
    let isReconnect = false;
    hangUp();
    send({
        event: "hangUp",
        data: "hangUp",
        uuid: uuid,
        isReconnect: isReconnect
    });
    changeMsg("stop call");
}

// register and login commands
var loginReg;
var passwordReg;
var address;
var email;
var login;
var password;

// function sendRegistrationData(){
//     loginReg = document.getElementById("loginReg").value;
//     passwordReg = document.getElementById("passwordReg").value;
//     address = document.getElementById("address").value;
//     email = document.getElementById("email").value;
//     send({
//         event:"user",
//         data:{
//             login:loginReg,
//             password:passwordReg,
//             address:address,
//             email:email,
//             id:""
//         },
//     });
// }

        //show regDiv
function regDiv() {
    showElement("regDiv");
}
        //show logDiv
function logDiv() {
    showElement("logDiv");
}
        //show any element
function showElement(element) {
    var x = document.getElementById(element);
    if (x.style.display === "block") {
        x.style.display = "none";
    } else {
        x.style.display = "block";
    }
}


//--------------------------------------------------------------------------
// function test() {
//     peerConnection.createOffer(function(answer) {
//         send({
//             event: "answer",
//             data: answer,
//         });
//         peerConnection.setLocalDescription(answer);
//     }, function(err) {
//         console.log("error createOffer() :"+err);
//     });
//     console.log("createOffer() in test");
// }



