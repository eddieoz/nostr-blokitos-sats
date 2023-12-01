import { LightningAddress } from "alby-tools";
import { webln } from "alby-js-sdk";
import 'websocket-polyfill';
import * as crypto from "crypto";
import { finishEvent, getPublicKey, nip05, nip19, relayInit, SimplePool } from "nostr-tools";
import 'dotenv/config';
import { sendMsg } from './sendMsg.js'
import { zapArgs } from "../models/models.js";

import Web3 from "web3";
// import { HDWalletProvider } from "@truffle/hdwallet-provider";
import HDWalletProvider from '@truffle/hdwallet-provider';
// const { HDWalletProvider } = pkg;
import { abi } from "../models/abi.js";
// const Web3 = require('web3');
// const HDWalletProvider = require("@truffle/hdwallet-provider");
// const abi = require('../models/abi');

globalThis.crypto = crypto;

// from .env
const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
    throw new Error("Please set .env variables");
}

export async function transferNFT(req, res){
    
    const apiKey = String(req.query.apikey).trim();
    const MNEMONIC = process.env.MNEMONIC;
    const NODE_API_KEY = process.env.INFURA_KEY
    const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;
    // const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
    const NETWORK = process.env.NETWORK;
    const TOKEN_ID = String(req.query.token_id).trim();
    const destWallet = String(req.query.dest_wallet).trim();

    const ADDRESS_INDEX = 0;

    if (apiKey != process.env.API_KEY || ! apiKey){
        return res.status(200).send('api key needed')
    }

    if (!destWallet) {
        return res.status(200).send('no destination wallet')
    }

    if (!TOKEN_ID) {
        return res.status(200).send('invalid token id')
    }

    if (!MNEMONIC || !NODE_API_KEY || !NETWORK) {
        console.error(
          "Please set a mnemonic, Alchemy/Infura key, owner, network, API key, nft contract, and factory contract address."
        );
        return;
      }
      
      if (!NFT_CONTRACT_ADDRESS) {
        console.error("Please either set a factory or NFT contract address.");
        return;
      }
      
      let provider = new HDWalletProvider({
          mnemonic: MNEMONIC,
          providerOrUrl: `https://${NETWORK}.infura.io/v3/${NODE_API_KEY}`,
          addressIndex: ADDRESS_INDEX
      });
      const OWNER_ADDRESS = provider.getAddress(0);
      console.log("OWNER_ADDRESS: ", OWNER_ADDRESS);
      
      var web3 = new Web3(provider);
      
      var nftContract = new web3.eth.Contract(abi().openseaAbi, NFT_CONTRACT_ADDRESS);

      //   console.log(destWallet)
      let qtyOwner = await nftContract.methods.balanceOf(OWNER_ADDRESS, TOKEN_ID).call()
      let qtyDest = await nftContract.methods.balanceOf(destWallet, TOKEN_ID).call()
      console.log(`Wallet ${OWNER_ADDRESS} qty ${qtyOwner}`)
      console.log(`Wallet ${destWallet} qty ${qtyDest}`)
      
      if (qtyOwner > 0 && qtyDest == 0){
          try{
              //let nftMessage = web3.utils.hexToBytes('0x01');;
              let gasPrice = await web3.eth.getGasPrice();
              let gas = await nftContract.methods
              .safeTransferFrom(OWNER_ADDRESS, destWallet, TOKEN_ID, 1, [])
              .estimateGas({ from: OWNER_ADDRESS });

              var encodeAbi = await nftContract.methods
              .safeTransferFrom(OWNER_ADDRESS, destWallet, TOKEN_ID, 1, [])
              .encodeABI({ from: OWNER_ADDRESS })
              
              await web3.eth.sendTransaction({from: OWNER_ADDRESS, to: NFT_CONTRACT_ADDRESS ,value: 0, gas: gas, gasPrice: gasPrice, data: encodeAbi})
                .then(function(tx){
                    console.log("TX: ", tx);
                    return res.status(200).send(`sent to ${destWallet}`)
                }
                )

          } 
          catch(e){
              console.log(e)
              return res.status(200).send(`something really bad happened when sending to ${destWallet}`);
          }
      } else {
          console.log(`Can't transfer. qtyOwner ${qtyOwner} destWallet ${destWallet} qtyDest ${qtyDest}`)
          return res.status(200).send(`Can't transfer. ${destWallet} already has the NFT`)
      }

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
