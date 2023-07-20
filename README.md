# Nostr-Blokitos-Sats: Convert Stream Points to Satoshis 

The Nostr-Blokitos-Sats project is designed to increase viewer engagement for streamers by enabling them to convert their stream points to Satoshis (sats) for their audience. This opens up a whole new level of interactivity and reward mechanism on your streams.

Additionally, the project promotes the adoption of Nostr, a decentralized and censorship-resistant ecosystem, as the medium to facilitate the transfer of Satoshis. The project is compatible with 'zaps' and supports the lightning network.

## How Does It Work?

The Nostr-Blokitos-Sats project allows streamers who have enabled a point system on their streams (using tools like StreamElements, Streamlabs, Botrix, Botisimo, etc.) to convert those points into Satoshis (sats) that can be awarded to their audience.

## Prerequisites

### Streamer Requirements:
- An established points system for your livestream.
- A custom command system with fetch enabled feature.
- An active Node.js server during the livestream.
- Node.js version 18+.
- A getAlby account and a Nostr Wallet Connect (NWC) key or Mutiny (NIP47). Access https://nwc.getalby.com/ to create the key.

### Audience Requirements:
- A Lightning Network enabled wallet (zbd, Bitcoin Lightning Wallet, Wallet of Satoshi, Breez Wallet, Zap Wallet, etc.)
- A Nostr account.
- The LN address should be listed in the user's profile.

## Installation

```bash
$ git clone https://github.com/eddieoz/nostr-blokitos-sats.git
$ cd nostr-blokitos-sats
$ yarn install
```

Then, create a `.env` file in the root directory with:
```
NWC_URL=<your_wallet_connect_key>
```

## Running the Server

```bash
$ yarn start
```
For production servers, running the server with pm2 is recommended.

## Local Testing

For localhost testing, navigate to the following link in your browser:
```
http://localhost:47673/withdraw?value=1&profile=<NIP05 or npub>
```

## Usage in Livestream

Create a custom command for the bot, like:

- Command Name: `!zap`
- Custom command: `Hey @$(sender): fetch[http://<SERVER>:43676/withdraw?value=<AMOUNT>&profile=$(v1)]`
- Permission: `Subscribers`
- Cost: `Customizable according to your preference`

This command allows subscribers to type `!zap <NIP05 or npub>` in the chat to trigger the bot, deduct a defined number of points, and receive a corresponding amount of Satoshis.

*Note: The command example above is formatted for Botrix custom commands. Please adapt the syntax as needed for your platform.*

# Working with Nostr NIPs
- NIP05
- NIP19
- NIP47
- NIP57