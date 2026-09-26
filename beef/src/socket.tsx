"use client";

import { io } from "socket.io-client";

// Connect only after mounting the local server-check screen, never during SSR.
export const socket = io({ autoConnect: false });
