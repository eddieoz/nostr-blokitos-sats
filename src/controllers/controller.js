import { LightningAddress } from "alby-tools";
import { webln } from "alby-js-sdk";
import 'websocket-polyfill';
import * as crypto from "crypto";
import { finishEvent, getPublicKey, nip05, nip19, relayInit, SimplePool } from "nostr-tools";
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
        return res.status(200).send({ 'message': 'All fields are required' })
    }

    if (sats <= 0) {
        return res.status(200).send({ 'message': 'amount cant be <= 0' })
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

    const pool = new SimplePool()
    let relays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nostr.zbd.gg', 'wss://nostr.rocks', 'wss://relay.nostrplebs.com', 'wss://nostr.bitcoiner.social']

    let events = []
    try {
        // Retrieve Nostr profile
        events = await pool.list(relays, [{ kinds: [0], authors: [dstNostrPubkey] }])

        console.log(events)

    } catch {
        return res.status(200).send('Relay unavailable now. Try again later.')
    }

    if (!events) {
        return res.status(200).send('Profile unavailable now. Try again later.')
    }

    let content = '';
    if (events && events[0].hasOwnProperty('content')) {
        // Get LN Address from Nostr Profile
        content = JSON.parse(events[0].content)
    } else {
        return res.status(200).send('Lightning Address not found in this Nostr Profile.')
    }

    let lnAddress = '';
    if (content.hasOwnProperty('lud16')) {
        lnAddress = content.lud16.toString().trim()
    } else {
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
        comment: `Morning Crypto: ${sats} blokitos <> ${sats} sats`,
        relays: ["wss://relay.damus.io", "wss://relay.snort.social", "wss://nostr.mom", "wss://nos.lol", "wss://nostr.zbd.gg", "wss://nostr.rocks", "wss://nostr.bitcoiner.social", "wss://nostr-pub.semisol.dev", "wss://relay.nostrplebs.com/", "wss://eden.nostr.land", "wss://nostr.mutinywallet.com"],
        kind: 1
    }

    // Return msg to bot before because of timeout (botrix has a fixed pretty small timeout) and send zap.
    // Everything is ready to send zap
    res.status(200).send(`sending ${sats} sats to ${destination}`);

    try {
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

    } catch {
        return res.status(200).send('Error sending sats');
    }

}
