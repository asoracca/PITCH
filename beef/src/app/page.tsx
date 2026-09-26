"use client";

import { useEffect, useState } from "react";
import { socket } from "../socket";

export default function ServerCheck() {
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");
  const [backend, setBackend] = useState("Checking…");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    let active = true;
    function onUpgrade(value: { name: string }) { setTransport(value.name); }
    function onConnect() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);
      socket.io.engine.off("upgrade", onUpgrade);
      socket.io.engine.on("upgrade", onUpgrade);
      socket.emit("ready");
      socket.emit("hello", "from client");
    }
    function onDisconnect() { setIsConnected(false); setTransport("N/A"); }
    function onHello(value: string) { setGreeting(value); }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("hello", onHello);
    socket.connect();
    if (socket.connected) onConnect();
    fetch("/api/health").then(async response => {
      const data = await response.json();
      if (active) setBackend(response.ok && data.database === "ready" ? "Database connected" : "Backend needs configuration");
    }).catch(() => { if (active) setBackend("Backend unavailable"); });
    return () => {
      active = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("hello", onHello);
      socket.io.engine?.off("upgrade", onUpgrade);
      socket.disconnect();
    };
  }, []);

  return (
    <main>
      <h1>Local server integration check</h1>
      <p>Backend: {backend}</p>
      <p>Socket.IO: {isConnected ? "connected" : "disconnected"}</p>
      <p>Transport: {transport}</p>
      <p>Greeting: {greeting || "Waiting"}</p>
      <p>This development check is available through the custom local server.</p>
      <p><a href="/api/pitch/config">View shared game rules</a></p>
    </main>
  );
}
