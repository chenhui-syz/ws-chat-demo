const WebSocket = require('ws')
const http = require('http')
const wss = new WebSocket.Server({
    port: 3000
})
// const jwt = require('jsonwebtoken')

// 心跳检测间隔时间
const timeInterval = 30000

// 多聊天室的功能
// roomid => 对应相同的roomid进行广播消息
let group = {}
wss.on('connection', function connection(ws) {
    // 初始的心跳状态
    ws.isAlive = true
    console.log('one client is connected')
    // 接收客户端发来的消息
    ws.on('message', function (msg) {
        const msgObj = JSON.parse(msg)
        if (msgObj.event === 'enter') {
            // 下面加的name和roomid都是会伴随当此连接的全过程，ws就代表当此连接
            ws.name = msgObj.message
            ws.roomid = msgObj.roomid
            if (typeof group[ws.roomid] === 'undefined') {
                group[ws.roomid] = 1
            } else {
                group[ws.roomid]++
            }
        }
        // // 鉴权
        // if (msgObj.event === 'auth') {
        //     jwt.verify(msgObj.message, 'secret', (err, decode) => {
        //         if (err) {
        //             // websoket返回给前台鉴权失败的消息
        //             console.log('auth error')
        //             ws.send(JSON.stringify({
        //                 event: 'noauth',
        //                 message: 'please auth again'
        //             }))
        //             return
        //         } else {
        //             // 鉴权通过
        //             console.log('鉴权通过', decode)
        //             ws.isAuth = true
        //             return
        //         }
        //     })
        //     return
        // }
        // // 拦截非鉴权的请求
        // if (!ws.isAuth) {
        //     return
        // }
        // 心跳检测
        if (msgObj.event === 'heartbeat' && msgObj.message === 'pong') {
            ws.isAlive = true
            return
        }
        // 服务端收到消息之后把这个消息再发送回去
        // ws.send('form server'+msg)
        // 广播消息
        wss.clients.forEach((client) => {
            // 连接状态，才去广播消息
            if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
                // 给返回的消息添加name
                msgObj.name = ws.name
                // 添加当前在线人数
                msgObj.num = group[ws.roomid]
                client.send(JSON.stringify(msgObj))
            }
        })
    })
    // 当ws客户端断开连接的时候
    ws.on('close', function () {
        // ws.name有值，则表示当前连接是有效的
        if (ws.name) {
            group[ws.roomid]--
        }
        let msgObj = {}
        wss.clients.forEach((client) => {
            // 连接状态，才去广播消息
            if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
                // 给返回的消息添加name
                msgObj.name = ws.name
                // 添加当前在线人数
                msgObj.num = group[ws.roomid]
                msgObj.event = 'out'
                client.send(JSON.stringify(msgObj))
            }
        })
    })
})

setInterval(() => {
    wss.clients.forEach((ws) => {
        // 如果已经是不在线状态了，则直接终止当此连接，房间连接数-1
        if (!ws.isAlive && ws.roomid) {
            group[ws.roomid]--
            delete ws['roomid']
            return ws.terminate()
        }
        // 主动发送心跳检测请求
        // 当客户返回了消息之后，主要设置flag为在线
        ws.isAlive = false
        ws.send(JSON.stringify({
            event: 'heartbeat',
            message: 'ping',
            num: group[ws.roomid]
        }))
    })
}, timeInterval)