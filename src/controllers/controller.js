import { LightningAddress } from "alby-tools";
import { webln } from "alby-js-sdk";
import 'websocket-polyfill';
import * as crypto from "crypto";
import { finishEvent, getPublicKey, nip05, nip19, relayInit, SimplePool } from "nostr-tools";
import 'dotenv/config';
import { sendMsg } from './sendMsg.js'
import { zapArgs } from "../models/models.js";

globalThis.crypto = crypto;

// from .env
const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
    throw new Error("Please set .env variables");
}

// transfer sats to nostr pubkey
export async function zapNostr(req, res) {

    let apiKey = req.query.apikey.toString().trim()
    let destination = req.query.profile.toString().trim()
    let sats = req.query.value.toString().trim()
    let message = ''

    if (apiKey != process.env.API_KEY){
        return res.status(200).send('api key needed')
    }

    if (!destination || !sats) {
        return res.status(200).send('All fields are required')
    }

    if (sats <= 0) {
        return res.status(200).send('amount cant be <= 0')
    }


    // Use Nostr Wallet Connect (getAlby)
    const nostrWeblnProvider = new webln.NostrWebLNProvider({ nostrWalletConnectUrl })
    const srcPrivateKey = nostrWeblnProvider.secret;

    // Establish NostrProvider
    const nostrProvider = {
        getPublicKey: () => Promise.resolve(getPublicKey(srcPrivateKey)),
        signEvent: (event) => Promise.resolve(finishEvent(event, srcPrivateKey)),
    }

    let dstNostrPubkey = ''
    message = 'Please input NIP05 or Nostr npub... pubkey'
    // Check if it is npub, otherwise consider it as nip-05
    if (destination.match('npub')) {
        try {
            let { type, data } = nip19.decode(destination)
            dstNostrPubkey = data
            res.status(200).send(`Yes master! Check the DM of [${destination.substr(0,6)}...${destination.substr(-4)}] for updates`);
        } catch {
            return res.status(200).send(message)
        }
    } else {
        try {
            let nostrProfile = await nip05.queryProfile(destination)
            if (nostrProfile !== null && nostrProfile.hasOwnProperty('pubkey')) {
                dstNostrPubkey = nostrProfile.pubkey;
                res.status(200).send(`Yes master! Check the DM of ${destination} for updates`);
            } else {
                return res.status(200).send(message)
            }
        } catch {
            return res.status(200).send(message)
        }
    }
    if (!dstNostrPubkey) {
        return res.status(200).send(message)
    }

    message = ''

    // Connect relay
    const pool = new SimplePool()
    let relays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nostr.zbd.gg', 'wss://nostr.rocks', 'wss://relay.nostrplebs.com', 'wss://nostr.bitcoiner.social']

    let events = []
    try {
        // Retrieve Nostr profile
        events = await pool.list(relays, [{ kinds: [0], authors: [dstNostrPubkey] }])
        console.log(events)
    } catch {
        message = `Relay unavailable now. Try again later.`
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    }

    if (!events) {
        message = `Profile unavailable now. Try again later.`
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    }

    // Get LN Address from Nostr Profile
    let content = '';
    if (events && events[0].hasOwnProperty('content')) {
        content = JSON.parse(events[0].content)
    } else {
        message = `Lightning Address (LN Address) not found in this Nostr Profile.`
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    }

    let lnAddress = '';
    if (content.hasOwnProperty('lud16')) {
        lnAddress = content.lud16.toString().trim()
    } else {
        message = 'Lightning Address (LN Address) not found in this Nostr Profile.'
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    }

    // Validate LN Address
    const ln = new LightningAddress(lnAddress, {
        webln: nostrWeblnProvider,
    });

    await ln.fetch()
    .catch(error => {
        message = 'Invalid LN Address'
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    });

    if (!ln.lnurlpData) {
        message = 'Invalid LN Address'
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    }
    
    ln.nostrPubkey = dstNostrPubkey
    if (!ln.nostrPubkey) {
        message = 'Nostr pubkey not found'
        sendMsg(message, nip19.npubEncode(dstNostrPubkey))
        return 
    }

    // Everything is ready to send zap
    const response = await ln.zap(zapArgs(sats), { nostr: nostrProvider })
        .then(success => {
            console.log('Enviado!')
            console.log(new Date().toISOString(), 'amount:', sats, 'to', destination, 'preimage:', success.preimage)
            
            message = `Hello!! You received ${sats} sats from Morning Crypto\n\nYour receipt is ${success.preimage}`
            sendMsg(message, nip19.npubEncode(dstNostrPubkey))
            
            nostrWeblnProvider.close();
            return;
        })
        .catch(error => {
            console.log('Não Enviado!')
            console.log('err: ', error)

            message = `Hey!! There was an error sending ${sats} sats :(`
            sendMsg(message, nip19.npubEncode(dstNostrPubkey))
            
            nostrWeblnProvider.close();
            return;
        })
}
