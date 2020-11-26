// variables -----------------------------------------
var conn;
var peerConnection;
var inStream;
var countIceCandidate = 0;
var countCalls = 0;
var msgPoints = "...";
var msg="You have a call";
var uuid = 1;
// var sendChannel;
var receiveChannel;

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
        // conn = new WebSocket('ws://localhost:8080/socket');
    } else {
        let msg = "uuid is null, cannot connect to the server";
        changeMsg(msg);
        return;
    }

    conn.onopen = function() {
        initialize();
        changeMsg("conn.onopen the signaling server");
    };


    conn.onclose = function () {
        console.log("conn.onclose status:", closeStatus);
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
    if(conn){
        conn.close();
    }
    conn = null;
    changeMsg("Disconnected from the signaling server");
}

function reconnect(){
    createConnection();
    // stopCall();
    createOffer("reconnect");
    console.log("try to reconnect, websocket connection:", conn.readyState);
}
//-----------------general functions---------------------------------------------

function send(message) {
    if(conn){
        conn.send(JSON.stringify(message));
        console.log("sent message: ", message);
    }else{
        console.log("cannot send to the server");
    }
}

// function sendChatMessage(){
//     let chatMessageElement = document.getElementById("chatMessage");
//     console.log("sendChatMessage: ", chatMessageElement.innerHTML);
//     sendChannel.send(chatMessageElement.innerHTML);
//     chatMessageElement.innerHTML = "";
// }

window.onload = function () {
    setUUID();
    hideElementByClass('helpInfo');
    hideElementByClass('helpInfo');
    initBtns();
}

//-----------------buttons blocking-------------------------------------------
var setBtn;
var generateBtn;
var connectBtn;
var disconnectBtn;
var callBtn;
var hangupBtn;
let buttons = new Set();

function initBtns(){
    setBtn = document.getElementById('setUUID');
    generateBtn = document.getElementById('generateUUID');
    connectBtn = document.getElementById('connectServerBtn');
    disconnectBtn = document.getElementById('disconnectServerBtn');
    disconnectBtn.disabled = true;
    callBtn = document.getElementById('btn');
    callBtn.disabled = true;
    hangupBtn = document.getElementById('btnStop');
    hangupBtn.disabled = true;
    buttons.add(setBtn);
    buttons.add(generateBtn);
    buttons.add(connectBtn);
    buttons.add(disconnectBtn);
    buttons.add(callBtn);
    buttons.add(hangupBtn);
    console.log("initBtns: ", buttons);
}

window.addEventListener("click", function (e){
    let path = e.path;
    if (!path) {
        return;
    }
    let id = path[0].id;
    if(!id){
        return;
    }
    console.log("window event element id: ", id);
    blockBtnsByNameOfClicked(id);
});

function blockBtnsByNameOfClicked(buttonName){
    switch (buttonName){
        case "connectServerBtn":
            setBtn.disabled = true;
            generateBtn.disabled = true;
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            callBtn.disabled = false;
            hangupBtn.disabled = true;
            break;
        case "disconnectServerBtn":
            setBtn.disabled = false;
            generateBtn.disabled = false;
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            callBtn.disabled = true;
            hangupBtn.disabled = true;
            break;
        case "btn":
            callBtn.disabled = true;
            hangupBtn.disabled = false;
            break;
        case "btnStop":
            callBtn.disabled = false;
            hangupBtn.disabled = true;
            break;                
    }
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
// dataChannel initialization ---------------------------------------------------
// function initDataChannel(){
//     if(!peerConnection){
//         console.log("peerConnection was not created");
//         return;
//     }
//     sendChannel = peerConnection.createDataChannel("sendChannel");
//     console.log("sendChannel was created");
//     sendChannel.onopen = function(){
//         console.log("sendChannel was opened");
//     }
//     sendChannel.onclose = function(){
//         console.log("sendChannel was closed");
//     }
// }
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

    // initDataChannel();
    peerConnection.ondatachannel = function(event){
        receiveChannel = event.channel;
        receiveChannel.onmessage = function(message){
            console.log("message ondatachannel: ", message);
        }
        receiveChannel.onopen = function(){
            console.log("receiveChannel was opened");
        }
        receiveChannel.onclose = function(){
            console.log("receiveChannel was closed");
        }
    }
}


function createOffer(isReconnect) {
    if(!peerConnection){
        console.log("cannot create offer, peerConnection is not created");
        return;
    }
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
    if(!peerConnection){
        console.log("peerConnection is not established");
        return;
    }
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
    if (peerConnection){
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
    }
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
    console.log("showElement: ",element);
}

function hideElementByClass(element){
    var elems = document.getElementsByClassName(element);
    var x = elems[0];
    if (x.style.display === "block") {
        x.style.display = "none";
    } else {
        x.style.display = "block";
    }
    console.log("showElement: ",element);
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



