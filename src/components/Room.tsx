import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";

const URL = "http://localhost:3000";
// sendingPc.iceConnectionState==="disconnected"
export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [lobby, setLobby] = useState(true);
    const [Queue_length, setQueue_length] = useState(0);

    const [reffresh, setreffresh] = useState(true);
    const [ShowVideo, setShowVideo] = useState(true);
    const [msgs, setmsgs] = useState('');
    const [RoomID, setRoomID] = useState(null);
    const [conversation, setConversation] = useState<string[]>([]);
    const [typing, settyping] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>();
    const localVideoRef = useRef<HTMLVideoElement>();
    // //console.log(sendingPc, '<======== connection hay ')

    useEffect(() => {
        const socket = io(URL);
        // setShowVideo(false)
        remoteVideoRef.current && remoteVideoRef.current.pause();
        socket.on("user_disconnected", (data) => {
            console.log(data);
            remoteVideoRef.current && remoteVideoRef.current.pause();

            // Optionally reset other state (if needed):
            // setRemoteMediaStream(null);
            setreffresh(!reffresh)
            setRemoteVideoTrack(null);
            setRemoteAudioTrack(null);
        });


        socket.on('send-offer', async ({ roomId }) => {
            // socket.emit("disconnect_room", { targetSocketId: roomId })
            // socket.emit("connect_room", { targetSocketId: roomId })
            setLobby(false);
            const pc = new RTCPeerConnection();
            setRoomID(roomId);
            setSendingPc(pc);
            if (localVideoTrack) {
                //console.error("added tack");
                //console.log(localVideoTrack)
                pc.addTrack(localVideoTrack)
            }
            if (localAudioTrack) {
                //console.error("added tack");
                //console.log(localAudioTrack)
                pc.addTrack(localAudioTrack)
            }

            pc.onicecandidate = async (e) => {
                //console.log("receiving ice candidate locally");
                if (e.candidate) {
                    socket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "sender",
                        roomId
                    })
                }
            }

            pc.onnegotiationneeded = async () => {
                //console.log("on negotiation neeeded, sending offer");
                const sdp = await pc.createOffer();
                //@ts-ignore
                pc.setLocalDescription(sdp)
                socket.emit("offer", {
                    sdp,
                    roomId
                })
            }
        });
        socket.on('connection', () => {
            setConversation([])
            
          });
        socket.on("recv_msg", (data) => {
            setConversation((prevConversation) => [...prevConversation, `Stranger : ${data.msg} `]);
            console.log(data)
        })
        socket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
            //console.log("received offer");
            setLobby(false);
            setRoomID(roomId);
            // socket.emit("disconnect_room", { targetSocketId: roomId })
            socket.emit("connect_room", { targetSocketId: roomId })
            const pc = new RTCPeerConnection();
            pc.setRemoteDescription(remoteSdp)
            const sdp = await pc.createAnswer();
            //@ts-ignore
            pc.setLocalDescription(sdp)
            const stream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.play();
                remoteVideoRef.current.srcObject = stream;
            }
            setRemoteMediaStream(stream);
            // trickle ice 
            setReceivingPc(pc);
            window.pcr = pc;
            pc.ontrack = (e) => {
                alert("ontrack");
                // //console.error("inside ontrack");
                // const {track, type} = e;
                // if (type == 'audio') {
                //     // setRemoteAudioTrack(track);
                //     // @ts-ignore
                //     remoteVideoRef.current.srcObject.addTrack(track)
                // } else {
                //     // setRemoteVideoTrack(track);
                //     // @ts-ignore
                //     remoteVideoRef.current.srcObject.addTrack(track)
                // }
                // //@ts-ignore
                // remoteVideoRef.current.play();
            }

            pc.onicecandidate = async (e) => {
                if (!e.candidate) {
                    return;
                }
                //console.log("omn ice candidate on receiving seide");
                if (e.candidate) {
                    socket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "receiver",
                        roomId
                    })
                }
            }

            socket.emit("answer", {
                roomId,
                sdp: sdp
            });
            setRoomID(roomId);
            
            socket.on('recv_event', (data) => {
                // Broadcast the event to all other users except the sender
                //console.log(data)
                remoteVideoRef.current?.pause()
                setreffresh(!reffresh)
                setShowVideo(false)
                console.log('hi')
                // remoteVideoRef?.current?.play()
            });
            socket.on('Queue_length', data => {
                console.log(data, '<== queu hay ')
                setQueue_length(data)
            })
            setTimeout(() => {
                const track1 = pc.getTransceivers()[0].receiver.track
                const track2 = pc.getTransceivers()[1].receiver.track
                //console.log(track1);
                if (track1.kind === "video") {
                    setRemoteAudioTrack(track2)
                    setRemoteVideoTrack(track1)
                } else {
                    setRemoteAudioTrack(track1)
                    setRemoteVideoTrack(track2)
                }
                //@ts-ignore
                remoteVideoRef.current.srcObject.addTrack(track1)
                //@ts-ignore
                remoteVideoRef.current.srcObject.addTrack(track2)
                //@ts-ignore
                remoteVideoRef.current.play();
                // if (type == 'audio') {
                //     // setRemoteAudioTrack(track);
                //     // @ts-ignore
                //     remoteVideoRef.current.srcObject.addTrack(track)
                // } else {
                //     // setRemoteVideoTrack(track);
                //     // @ts-ignore
                //     remoteVideoRef.current.srcObject.addTrack(track)
                // }
                // //@ts-ignore
            }, 5000)
        });

        socket.on("answer", ({ roomId, sdp: remoteSdp }) => {
            setLobby(false);
            setSendingPc(pc => {
                pc?.setRemoteDescription(remoteSdp)
                return pc;
            });
            //console.log("loop closed");
            socket.on("lobby", () => {
                setLobby(true);
                
                // socket.emit("disconnect_room", { targetSocketId: roomId })
                socket.emit("connect_room", { targetSocketId: roomId })
            })
        })

       

        socket.on("add-ice-candidate", ({ candidate, type }) => {
            //console.log("add ice candidate from remote");
            //console.log({ candidate, type })
            if (type == "sender") {
                setReceivingPc(pc => {
                    if (!pc) {
                        //console.error("receicng pc nout found")
                    } else {
                        //console.error(pc.ontrack)
                    }
                    pc?.addIceCandidate(candidate)
                    return pc;
                });
            } else {
                setSendingPc(pc => {
                    if (!pc) {
                        //console.error("sending pc nout found")
                    } else {
                        // //console.error(pc.ontrack)
                    }
                    pc?.addIceCandidate(candidate)
                    return pc;
                });
            }
        })

        setSocket(socket)
    }, [name, reffresh])

    useEffect(() => {
        if (localVideoRef.current) {
            if (localVideoTrack) {
                localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
                localVideoRef.current.play();
            }
        }
    }, [localVideoRef])

    
    const Next = () => {
        setShowVideo(false)
        if (sendingPc) {
            setreffresh(!reffresh)
            socket?.emit('send_event')
        }
        if (receivingPc) {
            setreffresh(!reffresh)
            socket?.emit('send_event')
        }
        const stream = new MediaStream();
        if (remoteVideoRef.current) {

            remoteVideoRef.current.play();
            remoteVideoRef.current.srcObject = stream;
        }
        socket?.emit('send_event')
        socket?.emit("disconnect_room", { targetSocketId: RoomID })
        // remoteVideoRef?.current&&remoteVideoRef.current.srcObject = null
    };

    console.log({ RoomID })

    const Submit_chat = (e: any) => {
        e.preventDefault();
        socket?.emit("msg", { message: msgs, targetSocketId: RoomID })  
        setConversation((prevConversation) => [...prevConversation, ` ${msgs} `]);
        setmsgs("");
    }
    useEffect(()=>{
        setShowVideo(true)
    },[lobby,RoomID])
    return <div>
        Hi {name}
        {Queue_length > 0 ?
            <button onClick={() => Next()}>Next</button> :
            "All users are connected!"
        }
        {/* mein chahta hun yahan aggar Queue_length ==0 ho tuh bina kisi timeout searching karta rahay user ko */}
        {/* <button onClick={() => Next()}>Next</button>  */}
        <video autoPlay width={400} height={400} ref={localVideoRef} />
        {lobby ? "Waiting to connect you to someone" : null}
        {/* ShowVideo */}
        {ShowVideo&&<video width={400} height={400} ref={remoteVideoRef} />}

        {/* chatting */}
        <div style={{ width: '100%', height: "400px", backgroundColor: 'gray' }}>
            <div style={{ width: "100%", height: "90%", backgroundColor: "lightgrey" }}>
                {conversation.map((x: string, index: number) => (
                    <div key={index} style={{ textAlign: x.includes("Stranger") ? 'left' : 'right' }}>
                        {x}
                        {/* <div>
                            <div></div>
                            <div></div>
                        </div> */}
                    </div>
                ))}
            </div>
            <div style={{ width: "100%", height: "10%", backgroundColor: "lightslategray" }}>
                <form onSubmit={Submit_chat}>
                    <input
                        type="text"
                        style={{ width: "100%" }}
                        onChange={e => setmsgs(e.target.value)}
                    />
                </form>
            </div>
        </div>
    </div>
}

