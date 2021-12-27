
var html5VideoElement;
var webrtcPeerConnection;
var webrtcConfiguration;
var reportError;
var hostname;
var port;
var path;

var rtc_configuration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }]
};

var ws_conn;
var ws_server = '141.101.180.164';
var ws_port = '18443';

function setStatus(text) {
    console.log(text);
    var span = document.getElementById("status")

}

function setError(text) {
    console.error(text);

}
function generateOffer() {
    webrtcPeerConnection.createOffer().then(onLocalDescription).catch(setError);
}
function onLocalDescription(desc) {
    console.log("Local description: " + JSON.stringify(desc));
    webrtcPeerConnection.setLocalDescription(desc).then(function () {
        ws_conn.send(JSON.stringify({ type: "sdp", "data": webrtcPeerConnection.localDescription }));
    }).catch(reportError);
}


function onIncomingSDP(sdp) {
    console.log("Incoming SDP: " + JSON.stringify(sdp));
    webrtcPeerConnection.setRemoteDescription(sdp).catch(reportError);
    webrtcPeerConnection.createAnswer().then(onLocalDescription).catch(reportError);

}


function onIncomingICE(ice) {
    var candidate = new RTCIceCandidate(ice);
    console.log("Incoming ICE: " + JSON.stringify(ice));
    webrtcPeerConnection.addIceCandidate(candidate).catch(reportError);
}

let remoteStream = new MediaStream();
function onAddRemoteStream(event) {
    // if (html5VideoElement.srcObject !== event.streams[0]) {
    console.log('Incoming stream');
    html5VideoElement.autoplay = true;
    html5VideoElement.srcObject = event.streams[0];

    html5VideoElement.addEventListener("playing", () => {
        console.log(html5VideoElement.videoWidth);
        console.log(html5VideoElement.videoHeight);
        //startMarkerPosition();
    });
    //var play_promise = html5VideoElement.play();

    // if (play_promise !== undefined) {
    //     play_promise.then(_ => {
    //         console.log("Autoplay started!");
    //     }).catch(error => {
    //         console.log("Autoplay was prevented.!");
    //         html5VideoElement.muted = true;
    //         html5VideoElement.play();
    //     });
    // }
    //}
}



function onIceCandidate(event) {
    if (event.candidate == null)
        return;

    console.log("Sending ICE candidate out: " + JSON.stringify(event.candidate));
    ws_conn.send(JSON.stringify({ "type": "ice", "data": event.candidate }));
}

function onConnectionstatechange(event) {
    console.log("Connectionstatechange: " + webrtcPeerConnection.connectionState);
}


function onServerMessage(event) {
    var msg;
    switch (event.data) {
        case "HELLO":
            ws_conn.send('SESSION ' + '100');
            return;
        case "NOT READY":
            console.log("Webrtc not ready.Will try after 15 seconds.");
            setTimeout(() => {
                ws_conn.send('HELLO');
                setStatus("Registering with server");
                return;
            }, 15000);

        case "BUSY":
            setStatus("BUSY");
            alert("BUSY! Try latter");
            return;
        case "SESSION_OK":
            setStatus("Starting negotiation");
            if (!webrtcPeerConnection)
                createCall(null);
            // generateOffer();
            ws_conn.send('OFFER_REQUEST');
            return;
        case "OFFER_REQUEST":
            // The peer wants us to set up and then send an offer
            if (!webrtcPeerConnection)
                createCall(null).then(generateOffer);
            return;
        default:
            if (event.data.startsWith("ERROR")) {
                setStatus(event.data);
                //openModal();
                return;
            }
    }
    // Handle incoming JSON SDP and ICE messages
    try {
        msg = JSON.parse(event.data);
    } catch (e) {
        if (e instanceof SyntaxError) {
            setStatus("Error parsing incoming JSON: " + event.data);
        } else {
            setStatus("Unknown error parsing response: " + event.data);
        }
        return;
    }

    if (msg.sdp)
        onIncomingSDP(msg.sdp);
    else
        if (msg.ice) {
            setTimeout(() => {
                onIncomingICE(msg.ice);
            }, 150);
        }



}

function onServerClose(event) {
    setStatus('Disconnected from server');
    if (webrtcPeerConnection) {
        webrtcPeerConnection.close();
        webrtcPeerConnection = null;
    }
    ws_conn = null;
    // Reset after a second
    window.setTimeout(websocketServerConnect, 10000);
}

function onServerError(event) {
    setError("Unable to connect to server, did you add an exception for the certificate?")
    if (webrtcPeerConnection) {
        webrtcPeerConnection.close();
        webrtcPeerConnection = null;
    }
    ws_conn = null;
    window.setTimeout(websocketServerConnect, 15000);
}

function websocketServerConnect() {
    if (ws_conn)
        return;
    var l = window.location;
    var wsHost = (hostname != undefined) ? hostname : l.hostname;
    var wsPort = (port != undefined) ? port : l.port;
    var wsPath = (path != undefined) ? path : "ws";

    if (window.location.protocol.startsWith("file")) {
        ws_server = ws_server || "127.0.0.1";
    } else if (window.location.protocol.startsWith("http")) {
        ws_server = ws_server || window.location.hostname;
    } else {
        throw new Error("Don't know how to connect to the signalling server with uri" + window.location);
    }
    var ws_url = 'ws://' + ws_server + ':' + ws_port

    //  webrtcConfiguration = rtc_configuration;
    setStatus("Connecting to server " + ws_url);
    ws_conn = new WebSocket(ws_url);

    ws_conn.addEventListener('open', (event) => {
        console.log("Connected to: " + ws_url);
        ws_conn.send('HELLO');
        setStatus("Registering with server");
        createCall(null);
    });
    ws_conn.addEventListener('error', onServerError);
    ws_conn.addEventListener('message', onServerMessage);
    ws_conn.addEventListener('close', onServerClose);
}

window.onload = function () {
    html5VideoElement = document.getElementById("stream");
    // html5VideoElement.srcObject = remoteStream;
    websocketServerConnect();

};
function createCall(msg) {
    if (!webrtcPeerConnection) {
        webrtcPeerConnection = new RTCPeerConnection(rtc_configuration);

        // webrtcPeerConnection.addEventListener('track', async (event) => {
        //     remoteStream.addTrack(event.track, remoteStream);
        // });
        webrtcPeerConnection.ontrack = onAddRemoteStream;
        webrtcPeerConnection.addEventListener('connectionstatechange', event => {
            console.log(webrtcPeerConnection.connectionState);

        });
        webrtcPeerConnection.onicecandidate = onIceCandidate;
    }
};
