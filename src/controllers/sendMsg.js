import { relayInit, getEventHash, getSignature, getPublicKey, nip04, nip19, SimplePool} from "nostr-tools";
import 'dotenv/config';
import * as crypto from "crypto";
import 'websocket-polyfill';

globalThis.crypto = crypto;
let nostrPK, nostrSK;

// from .env
if (process.env.NOSTR_SK){
    nostrSK = await nip19.decode(process.env.NOSTR_SK).data;
    nostrPK = getPublicKey(nostrSK);    
} else {
    nostrSK = generatePrivateKey()
    nostrPK = getPublicKey(sk)
}

export async function sendMsg(message, dstPubkey){
    let pubkey = nip19.decode(dstPubkey).data
    
    let encodedMessage = await nip04.encrypt(nostrSK, pubkey, message)

    let event = {
        kind: 4,
        pubkey: nostrPK,
        tags: [['p', pubkey]],
        content: encodedMessage,
        created_at: Math.floor(Date.now() / 1000),
    }
    
    event.id = getEventHash(event);
    event.sig = getSignature(event, nostrSK);

    const pool = new SimplePool()
    let relays = ['wss://nos.lol', 'wss://relay.damus.io']
    
    let pubs = await pool.publish(relays, event)
    
}