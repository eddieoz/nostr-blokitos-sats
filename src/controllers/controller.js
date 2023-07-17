import { LightningAddress } from "alby-tools";
import { webln } from "alby-js-sdk";
import 'websocket-polyfill';
import * as crypto from "crypto";
import { finishEvent, getPublicKey, nip05, nip19, relayInit } from "nostr-tools";
import 'dotenv/config';

globalThis.crypto = crypto;

// from .env
const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
    throw new Error("Please set .env variables");
}

// transfer sats to nostr pubkey
export async function zapNostr(req, res) {

    let destination = req.query.profile.toString().trim()
    let sats = req.query.value.toString().trim()

    if (!destination || !sats) {
        return res.status(400).send({ 'message': 'All fields are required' })
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

    // Check if it is npub, otherwise consider it as nip-05
    if (destination.match('npub')) {
        try {
            let { type, data } = nip19.decode(destination)
            dstNostrPubkey = data
        } catch {
            return res.status(200).send('Please input NIP05 or Nostr npub... pubkey')
        }
        
    } else {
        try {
            let nostrProfile = await nip05.queryProfile(destination)
            if (nostrProfile !== null && nostrProfile.hasOwnProperty('pubkey')) {
                dstNostrPubkey = nostrProfile.pubkey;
            } else {
                return res.status(200).send('Please input NIP05 or Nostr npub... pubkey')
            }
        } catch {
            return res.status(200).send('Please input NIP05 or Nostr npub... pubkey')
        }    
    }

    if (!dstNostrPubkey) {
        return res.status(200).send('Please input NIP05 or Nostr npub... pubkey')
    }

    // Connect relay
    const relay = relayInit('wss://relay.damus.io')
    relay.on('connect', () => {
        console.log('connected to', relay.url)
    })
    relay.on('error', () => {
        console.log('failed to connect to', relay.url)
    })

    await relay.connect()

    // Retrieve Nostr profile
    let events = await relay.list([{ kinds: [0], authors: [dstNostrPubkey] }])

    console.log(events)

    await relay.close()


    // Get LN Address from Nostr Profile
    let content = JSON.parse(events[0].content)
    const lnAddress = content.lud16.toString().trim()

    if (!lnAddress) {
        return res.status(200).send('Lightning Address not found in this Nostr Profile')
    }

    // Validate LN Address
    const ln = new LightningAddress(lnAddress, {
        webln: nostrWeblnProvider,
    });

    await ln.fetch()
        .catch(error => {
            return res.status(200).send('Invalid LN Address')
        });

    if (!ln.lnurlpData) {
        return res.status(200).send('Invalid LN Address');
    }

    ln.nostrPubkey = dstNostrPubkey

    if (!ln.nostrPubkey) {
        return res.status(200).send('Nostr pubkey not found')
    }

    
    // Prepare zap
    const zapArgs = {
        satoshi: sats,
        comment: "Morning Crypto: Blokitos <> Sats",
        relays: ["wss://relay.damus.io"],
    }

    // Return msg to bot because of timeout (botrix has a fixed pretty small timeout) and send zap.
    // Everything is ready to send zap
    res.status(200).send(`sending ${sats} sats to ${destination}`);
    const response = await ln.zap(zapArgs, { nostr: nostrProvider })
        .then(success => {
            console.log('Enviado!')
            console.log(new Date().toISOString(), 'amount:', sats, 'to', destination, 'preimage:', success.preimage)
            nostrWeblnProvider.close();
            return;   
        })
        .catch(error => {
            console.log('Não Enviado!')
            console.log('err: ', error)
            nostrWeblnProvider.close();
            return;
        })
    
}
