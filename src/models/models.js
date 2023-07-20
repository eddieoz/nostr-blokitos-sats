export function zapArgs (sats){
    return {
        satoshi: sats,
        comment: `Morning Crypto: ${sats} blokitos <> ${sats} sats`,
        relays: ["wss://relay.damus.io", "wss://relay.snort.social", "wss://nostr.mom", "wss://nos.lol", "wss://nostr.zbd.gg", "wss://nostr.rocks", "wss://nostr.bitcoiner.social", "wss://nostr-pub.semisol.dev", "wss://relay.nostrplebs.com/", "wss://eden.nostr.land", "wss://nostr.mutinywallet.com"],
    }
}

export async function encMessageEvent(nostrPK, pubkey, encodedMessage)  {
    return {
        kind: 4,
        pubkey: nostrPK,
        tags: [['p', pubkey]],
        content: encodedMessage,
        created_at: Math.floor(Date.now() / 1000)
    }
    
}