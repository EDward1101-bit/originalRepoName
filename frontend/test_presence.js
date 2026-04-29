import { Client } from 'stanza';

const client = new Client({
    jid: 'andreibadoi75@localhost',
    password: 'password123', // I don't know the password
    transports: {
        websocket: 'ws://localhost:5280/xmpp-websocket',
        bosh: 'http://localhost:5280/http-bind'
    }
});

client.on('presence', pres => {
    console.log("PRESENCE:", pres);
});

client.connect();
