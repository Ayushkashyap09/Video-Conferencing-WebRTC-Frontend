import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000"); // Connect to signaling server

const VideoChat: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const [isCallActive, setIsCallActive] = useState<boolean>(false);

    useEffect(() => {
        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        peerConnection.current.ontrack = (event: RTCTrackEvent) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                stream.getTracks().forEach(track => peerConnection.current?.addTrack(track, stream));
            })
            .catch((error) => console.error("Error accessing media devices:", error));

        socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
            if (!peerConnection.current) return;
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit("answer", answer);
        });

        socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
            if (!peerConnection.current) return;
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on("candidate", (candidate: RTCIceCandidateInit) => {
            if (!peerConnection.current) return;
            peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        });

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) socket.emit("candidate", event.candidate);
        };
    }, []);

    const startCall = async () => {
        if (!peerConnection.current) return;
        setIsCallActive(true);
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("offer", offer);
    };

    return (
        <div>
            <video ref={localVideoRef} autoPlay playsInline style={{ width: "300px", border: "2px solid black" }} />
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "300px", border: "2px solid red" }} />
            {!isCallActive && <button onClick={startCall}>Start Call</button>}
        </div>
    );
};

export { VideoChat };