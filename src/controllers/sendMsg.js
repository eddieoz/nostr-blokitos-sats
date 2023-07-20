import { relayInit, getEventHash, getSignature, generatePrivateKey, getPublicKey, nip04, nip19, SimplePool} from "nostr-tools";
import 'dotenv/config';
import * as crypto from "crypto";
import 'websocket-polyfill';
import { encMessageEvent } from "../models/models.js";

globalThis.crypto = crypto;
let nostrPK, nostrSK;

// from .env
if (process.env.NOSTR_SK){
    nostrSK = await nip19.decode(process.env.NOSTR_SK).data;
    nostrPK = getPublicKey(nostrSK);    
} else {
    nostrSK = generatePrivateKey();
    nostrPK = getPublicKey(nostrSK);
}

export async function sendMsg(message, dstPubkey){
    let pubkey = nip19.decode(dstPubkey).data
    
    let encodedMessage = await nip04.encrypt(nostrSK, pubkey, message)
    
    let event = await encMessageEvent(nostrPK, pubkey, encodedMessage)
    console.log(event)

    event.id = getEventHash(event);
    event.sig = getSignature(event, nostrSK);

    const pool = new SimplePool()
    let relays = ['wss://nos.lol', 'wss://relay.damus.io']
    
    let pubs = await pool.publish(relays, event)
    
}