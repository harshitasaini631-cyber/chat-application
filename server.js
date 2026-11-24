const express = require("express");
const http = require("http");
const {Server} = require("socket.io");

const app = express();
const httpserver = http.createServer(app);

const io = new Server(httpserver);

let count = 0

io.on("connection",(socket) =>{
    count++;
    console.log("Active User: ", count);

    socket.emit("active",count);

    console.log("Connected established");

    socket.emit("chat", "Hello from server side");

    socket.broadcast.emit("join", "New User Joined");

    socket.on("msg", (cb)=>{
        console.log(cb);
    });

    socket.on("disconnect", ()=>{
        count--;
        console.log("Active User: ", count);
        io.emit("active", count);
    });

    io.emit("announce", "Only 5hr class left");
});

httpserver.listen(8080,()=>{
    console.log("Server started");
});