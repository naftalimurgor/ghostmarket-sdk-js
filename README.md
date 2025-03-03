<p align="center">
  <img src="https://cdn.ghostmarket.io/brands/gm-light-logo-oneline.svg" />
</p>

# ghostmarket-sdk-js

[![https://badges.frapsoft.com/os/mit/mit.svg?v=102](https://badges.frapsoft.com/os/mit/mit.svg?v=102)](https://opensource.org/licenses/MIT)

Ghostmarket SDK offers a complete set of functionalities enabling access to GhostMarket as a full-fledged SDK written in TypeScript/Javascript.

Full support in a single SDK of all blockchains integrated with GhostMarket, currently six: Ethereum, BSC, Avalanche, Polygon, Phantasma, Neo N3.

Checkout the [Changelog](https://github.com/OnBlockIO/ghostmarket-sdk-js/blob/master/CHANGELOG.md)

Published on [GitHub](https://github.com/OnBlockIO/ghostmarket-sdk-js) and [npm](https://www.npmjs.com/package/ghostmarket-sdk-js)

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Common](#usage-common)
    - [Getting assets](#getting-assets)
    - [Getting events](#getting-events)
    - [Getting collections](#getting-collections)
    - [Getting offers](#getting-offers)
    - [Getting orders](#getting-orders)
    - [Getting NFT balances](#getting-nft-balances)
    - [Getting token balances](#getting-token-balances)
    - [Getting token approval](#getting-token-approval)
    - [Getting incentives](#getting-incentives)
    - [Set contract royalties](#set-contract-royalties)
    - [Approve token](#approve-token)
    - [Claiming incentives](#claiming-incentives)
    - [Getting LP stakes](#getting-lp-stakes)
    - [Getting LP rewards](#getting-lp-rewards)
    - [Claiming LP rewards](#claiming-lp-rewards)
    - [Stake LP tokens](#stake-lp-tokens)
    - [Signing Data](#signing-data)
- [Usage EVM](#usage-evm)
    - [Buying NFT](#buying-nft)
    - [Listing NFT fixed price](#listing-nft-fixed-price)
    - [Cancel listing](#cancel-listing)
    - [Edit listing price](#edit-listing-price)
    - [Place offer](#place-offer)
    - [Accept offer](#accept-offer)
    - [Getting contract approval](#getting-contract-approval)
    - [Wrap token](#wrap-token)
    - [Approve contract](#approve-contract)
    - [Getting native balance](#getting-native-balance)
    - [Transfer ERC20 token](#transfer-erc20-token)
    - [Transfer ERC721 NFT](#transfer-erc721-nft)
    - [Transfer ERC1155 NFT](#transfer-erc1155-nft)
    - [Burn ERC721 NFT](#burn-erc721-nft)
    - [Burn ERC1155 NFT](#burn-erc1155-nft)
    - [Mint ERC721 NFT](#mint-erc721-nft)
    - [Mint ERC1155 NFT](#mint-erc1155-nft)
- [Usage Neo N3](#usage-neo-n3)
    - [Buying NFT](#buying-nft)
    - [Listing NFT fixed price](#listing-nft-fixed-price)
    - [Listing NFT auction](#listing-nft-auction)
    - [Bid NFT auction](#bid-nft-auction)
    - [Claim NFT auction](#claim-nft-auction)
    - [Cancel listing](#cancel-listing)
    - [Edit listing price](#edit-listing-price)
    - [Place offer](#place-offer)
    - [Accept offer](#accept-offer)
    - [Cancel offer](#cancel-offer)
    - [Transfer NEP17 token](#transfer-nep17-token)
    - [Transfer NEP11 NFT](#transfer-nep11-nft)
    - [Burn NEP11 NFT](#burn-nep11-nft)
    - [Mint NEP11 NFT](#mint-nep11-nft)


- [Development](#development)


## Installation

We recommend using Node.js version 16.

```bash
yarn add ghostmarket-sdk-js
```
or if using npm
```bash
npm install --save ghostmarket-sdk-js
```

Install [web3](https://github.com/ethereum/web3.js) if you don't have it already.

## Getting started

### EVM quickstart

To get started on EVM, you can use either a read only provider, a web3 provider (ex metamask) or a private key (to be stored in `.env` file, see `.env.example` for a reference).

```js
import Web3 from 'web3'
import { GhostMarketSDK, Chain, TESTNET_API_URL, MAINNET_API_URL } from 'ghostmarket-sdk-js';
// if using EVM private key or mnemonic hdwallet-provider is required
// import HDWalletProvider from '@truffle/hdwallet-provider'


// Variables
const apiKey = process.env.GM_API_KEY // GhostMarket API KEY if you have one
const privateKey = process.env.PRIVATE_KEY // private key to use - only for private key provider
const rpcUrl = process.env.RPC_URL // RPC to use, ex 'https://mainnet.infura.io'
const environment = MAINNET_API_URL // GhostMarket Infrastructure - MAIN_ENVIRONMENT or TEST_ENVIRONMENT
const chainName = Chain.ETHEREUM // see below for chain values

/* chainName values : 
    Chain.ETHEREUM / Chain.ETHEREUM_TESTNET
    Chain.POLYGON / Chain.POLYGON_TESTNET
    Chain.BSC / Chain.BSC_TESTNET
    Chain.AVALANCHE / Chain.AVALANCHE_TESTNET
    */

// SDK config options.
const sdkConfig = {
    apiKey,
    rpcUrl,
    environment,
    chainName,
}

// Option 1 - readonly provider, only reads the network state. Can not sign transactions
const customProvider = new Web3.providers.HttpProvider(rpcUrl)
const address = ''
// Option 2 - metamask provider
const customProvider = window.ethereum
const address = await ethereum.request({
    method: 'eth_requestAccounts',
  })[0];
// Option 3 - private key
const customProvider = new HDWalletProvider(KEY, rpcUrl)
const address = customProvider.addresses[0]
// Create instance of GhostMarketSDK - EVM
const gmSDK = new GhostMarketSDK(customProvider, sdkConfig);
// Start and stop provider engine - when using HDWalletProvider
// customProvider.engine.start();
// your code here
// customProvider.engine.stop();

// All set - use the object gmSDK to access GhostMarket SDK
```

### Neo N3 quickstart

To get started on Neo N3, you can use either a NEP-12 provider (ex neoline or o3) or a private key (to be stored in `.env` file, see `.env.example` for a reference).

```js
import { GhostMarketN3SDK, Chain, TESTNET_API_URL, MAINNET_API_URL } from 'ghostmarket-sdk-js';

// Variables
const apiKey = process.env.GM_API_KEY // GhostMarket API KEY if you have one
const privateKey = process.env.PRIVATE_KEY // private key to use - only for Neo N3 private provider
const rpcUrl = process.env.RPC_URL // RPC to use instead of default ones
const environment = MAINNET_API_URL // GhostMarket Infrastructure - MAIN_ENVIRONMENT or TEST_ENVIRONMENT
const chainName = Chain.NEO3 // see below for chain values

/* chainName values : 
    Chain.NEO3 / Chain.NEO3_TESTNET
    */

// SDK config options.
const sdkConfig = {
    apiKey,
    rpcUrl,
    environment,
    chainName,
    privateKey
}

// Option 1 - neoline
const customProvider = 'neoline'
// Option 2 - o3
const customProvider = 'o3'
// Option 3 - private key
const customProvider = 'private'
// Create instance of GhostMarketN3SDK - Neo N3
const gmSDK = new GhostMarketN3SDK(customProvider, sdkConfig);
// Connected address (neoline / o3)
const address = (await gmSDK.getProvider().getAccount()).address

// All set - use the object gmSDK to access GhostMarket SDK
```

## Usage Common

### Getting assets

```js
// Fetch 10 GhostMarket assets.
const { assets } = await gmSDK.api.getAssetsV2({ size: 10 })
console.info(assets)
```

### Getting events

```js
// Fetch 10 GhostMarket events.
const { events } = await gmSDK.api.getEventsV2({ size: 10 })
console.info(events)
```

### Getting collections
```js
// Fetch 10 GhostMarket collections.
const { collections } = await gmSDK.api.getCollectionsV2({ size: 10 })
console.info(collections)
```

### Getting offers 
```js
// Fetch offers from asset.
const chain = '' // filter by chain.
const contractAddress = '' // filter for one contract.
const tokenId = '' // filter for one tokenId.
const { offers } = await gmSDK.api.getAssetOffersV2({ chain, contractAddress, tokenId })
console.info(offers)
```

### Getting orders 
```js
// Fetch orders from asset.
const chain = '' // filter by chain.
const contractAddress = '0x....' // filter for one contract.
const tokenId = '' // filter for one tokenId.
const { orders } = await gmSDK.api.getAssetOrdersV2({ chain, contractAddress, tokenId })
console.info(orders)
```

### Getting NFT balances
```js
const chain = '' // filter by chain.
const contractAddress =  '' // filter for one contract.
const owners = ['0x....'] // filter by one or more owner.
const balance = await gmSDK.api.getAssetsV2({ chain, contractAddress, owners })
console.info(balance)
```

### Getting token balances
```js
const contract =  '' 
const balance = await gmSDK.checkTokenBalance(contract, address)
console.info(balance)
```

### Getting token approval
```js
const contract = '0x....'
const approval = await gmSDK.checkTokenApproval(contract, address)
console.info(approval)
```

### Getting incentives
```js
const incentives = await gmSDK.checkIncentives(address)
const availableIncentives = incentives ? incentives.availableIncentives : 0 // EVM
const availableIncentives = incentives[5] ? incentives[5].value : 0 // Neo N3
console.info(availableIncentives)
```

### Set contract royalties
```js
const contractAddress = '0x....'
const royaltiesArray = [{address, value: 1000}] // array of recipient/value array (in bps).
const royalties = await gmSDK.setRoyaltiesForContract(contractAddress, royaltiesArray, {from: address})
console.info(royalties)
```

### Approve token
```js
const contract = '0x....'
const approve = await gmSDK.approveToken(contract, {from: address})
console.info(approve)
```

### Claiming incentives
```js
const claim = await gmSDK.claimIncentives({from: address})
console.info(claim)
```

### Getting LP stakes
```js
const stakes = await gmSDK.checkLPStakes(address)
console.info(stakesDetails)
```

### Getting LP rewards
```js
const rewards = await gmSDK.checkLPRewards(address)
console.info(rewards)
```

### Claiming LP rewards
```js
const claim = await gmSDK.claimLPRewards({from: address})
console.info(claim)
```

### Stake LP tokens
```js
const amount = '1' // in wei (evm) or biginteger format (n3).
const isStaking = true // set to false to unstake.
const stake = await gmSDK.stakeLPTokens(amount, isStaking, {from: address})
console.info(stake)
```

### Signing data
```js
const message = 'signing stuff'
const signed = await gmSDK.signData(message, address) // EVM
const signed = await gmSDK.signData(message) // N3
console.info(signed)
```

## Usage EVM

You can override automatic calculation of gas price if you add it to the last argument object on each transaction requiring signature.
Example when wrapping a token:

instead of `const wrap = await gmSDK.wrapToken(amount, isWrap, {from: address})` simply do `const wrap = await gmSDK.wrapToken(amount, isWrap, {from: address, gasPrice: 50000})` if you want to override gas price to `50000`.

All interfaces are documented here: [EVM interfaces](https://github.com/OnBlockIO/ghostmarket-sdk-js/blob/master/src/core/models/evm/index.ts)

### Buying NFT
```js
const orderDetails = { 
    baseContract: '0x....', // order maker base contract address.
    baseTokenId: '1', // order maker NFT tokenId - set to the one to offer for a collection offer.
    baseTokenAmount: 1, // order maker amount - optional - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order maker quote contract address - use 0x for native currency (ex. ETH).
    quotePrice: '1', // order maker price - in wei.
    makerAddress: '0x....', // order maker.
    type: 1, // order maker type 1 - listing, 2 - offer.
    startDate: 0, // order maker start date.
    endDate: 0, // order maker end date.
    salt: '0x....', // order maker salt.
    signature: '0x....', // order maker signature.
}
const buying = await gmSDK.matchOrders(orderDetails, {from: address})
console.info(buying)
```

### Listing NFT fixed price
```js
const startDate = parseInt((new Date().getTime() / 1000).toString())
const orderDetails = [{ 
    baseContract: '0x....', // order base contract address - nft contract for listing.
    baseTokenId: '1', // order NFT tokenId - token id for listing - set to empty for collection offer.
    baseTokenAmount: 1, // order amount - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order quote contract address - currency accepted for listing - use 0x for native currency (ex. ETH).
    quotePrice: '1', // order price - in wei.
    makerAddress: '0x....', // order maker.
    type: 1, // 1 - listing, 2 - offer, 3 - collection offer.
    startDate, // order start date.
    endDate: startDate + (3600 * 24) // order end date.
}]
const listing = await gmSDK.createOrder(orderDetails)
console.info(listing)
```

### Cancel Listing NFT
```js
const orderDetails = [{ 
    baseContract: '0x....', // order base contract address - nft contract for listing.
    baseTokenId: '1', // order NFT tokenId - token id for listing - set to empty for collection offer.
    baseTokenAmount: 1, // order amount - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order quote contract address - currency accepted for listing - use 0x for native currency (ex. ETH).
    quotePrice: '1', // order price - in wei.
    makerAddress: '0x....', // order maker.
    type: 1, // 1 - listing, 2 - offer, 3 - collection offer.
    startDate: 0, // order start date.
    endDate: 0, // order end date.
    salt: '0x....' // required for cancellation, use the salt from the order/offer.
}]
const cancel = await gmSDK.bulkCancelOrders(orderDetails, {from: address})
console.info(cancel)
```

### Edit listing price
Note: edit listing price does not cancel current order, it just hides it on API and exposes the new one only, but the old one can still be matched later. Only a true cancellation will make it un matcheable - only supported for ERC721.
```js
const orderDetails = [{ 
    baseContract: '0x....', // order base contract address - nft contract for listing.
    baseTokenId: '1', // order NFT tokenId - token id for listing - set to empty for collection offer.
    baseTokenAmount: 1, // order amount - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order quote contract address - currency accepted for listing - use 0x for native currency (ex. ETH).
    quotePrice: '1', // order new price - in wei - has to be lower than current price.
    makerAddress: '0x....', // order maker.
    type: 1, // 1 - listing, 2 - offer, 3 - collection offer.
    startDate: 0, // order start date.
    endDate: 0, // order end date.
    salt: '0x....' // required for edit, use the salt from the order/offer.
}]
const edit = await gmSDK.createOrder(orderDetails)
console.info(edit)
```

### Place offer
```js
const startDate = parseInt((new Date().getTime() / 1000).toString())
const orderDetails = [{ 
    baseContract: '0x....', // order base contract address - nft contract for listing.
    baseTokenId: '1', // order NFT tokenId - token id for listing - set to empty for collection offer.
    baseTokenAmount: 1, // order amount - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order quote contract address.
    quotePrice: '1', // order price - in wei.
    makerAddress: '0x....', // order maker.
    type: 2, // 1 - listing, 2 - offer, 3 - collection offer.
    startDate, // order start date.
    endDate: startDate + (3600 * 24) // order end date.
}]
const listing = await gmSDK.createOrder(orderDetails)
console.info(listing)
```

### Accept offer
```js
const orderDetails = [{ 
    baseContract: '0x....', // order maker base contract address.
    baseTokenId: '1', // order maker NFT tokenId - set to the one to offer for a collection offer.
    baseTokenAmount: 1, // order maker amount - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order maker quote contract address.
    quotePrice: '1', // order maker price - in wei.
    makerAddress: '0x....', // order maker.
    type: 2, // order maker type 1 - listing, 2 - offer, 3 - collection offer.
    startDate: 0, // order maker start date.
    endDate: 0, // order maker end date.
    salt: '0x....', // order maker salt.
    signature: '0x....', // order maker signature.
}]
const accept = await gmSDK.matchOrders(orderDetails, {from: address})
console.info(accept)
```

### Cancel offer
```js
const orderDetails = [{ 
    baseContract: '0x....', // order base contract address - nft contract for listing.
    baseTokenId: '1', // order NFT tokenId - token id for listing - set to empty for collection offer.
    baseTokenAmount: 1, // order amount - only needed for ERC1155 otherwise default to 1.
    quoteContract: '0x....', // order quote contract address.
    quotePrice: '1', // order price - in wei.
    makerAddress: '0x....', // order maker.
    type: 2, // 1 - listing, 2 - offer, 3 - collection offer.
    startDate: 0, // order start date.
    endDate: 0, // order end date.
    salt: '0x....'
}]
const cancel = await gmSDK.bulkCancelOrders(orderDetails, {from: address})
console.info(listing)
```

### Getting contract approval
```js
const contract = '0x....'
const approval = await gmSDK.checkContractApproval(contract, address)
console.info(approval)
```

### Wrap token
```js
const amount = '1' // in wei.
const isWrap = true // set to false to unwrap.
const wrap = await gmSDK.wrapToken(amount, isWrap, {from: address})
console.info(wrap)
```

### Approve contract
```js
const contract = '0x....'
const approval = await gmSDK.approveContract(contract, {from: address})
console.info(approval)
```

### Getting native balance
```js
const balance = await gmSDK.checkBalance(contract)
console.info(balance)
```

### Transfer ERC20 token
```js
const destination = '0x....'
const contract = '0x....'
const amount = '1' // in wei.
const transfer = await gmSDK.transferERC20(destination, contract, amount, {from: address})
console.info(transfer)
```

### Transfer ERC721 NFT
```js
const destination = '0x....'
const contract = '0x....'
const tokenId = '1'
const transfer = await gmSDK.transferERC721(destination, contract, tokenId, {from: address})
console.info(transfer)
```

### Transfer ERC1155 NFT
```js
const destination = '0x....'
const contract = '0x....'
const tokenId = '1'
const amount = 1
const transfer = await gmSDK.transferERC1155(destination, contract, [tokenId], [amount], {from: address})
console.info(transfer)
```

### Burn ERC721 NFT
```js
const contract = '0x....'
const tokenId = '1'
const burn = await gmSDK.burnERC721(contract, tokenId, {from: address})
console.info(burn)
```

### Burn ERC1155 NFT
```js
const contract = '0x....'
const tokenId = '1'
const amount = 1
const burn = await gmSDK.burnERC1155(contract, tokenId, amount, {from: address})
console.info(burn)
```

### Mint ERC721 NFT
```js
const royaltyRecipient = '0x....'
const mintDetails = {
    creatorAddress: '0x....',
    royalties: [{address: royaltyRecipient, value: 1000}], // royalties - optional - use bps.
    externalURI: 'ipfs://xxx'
}
const token = await gmSDK.mintERC721(mintDetails, {from: address})
console.info(token)
```

### Mint ERC1155 NFT
```js
const royaltyRecipient = '0x....'
const mintDetails = {
    creatorAddress: '0x....',
    royalties: [{address: royaltyRecipient, value: 1000}], // royalties - optional - use bps.
    externalURI: 'ipfs://xxx'
}
const amount = 1
const token = await gmSDK.mintERC1155(mintDetails, amount, {from: address})
console.info(token)
```

## Usage Neo N3

You can override automatic calculation of network fee and system fee if you add it to the last argument object on each transaction requiring signature.
Example when buying a NFT:

instead of `const buying = await gmSDK.buyMultiple(buyingDetails, {from: address})` simply do `const buying = await gmSDK.buyMultiple(buyingDetails, {from: address, systemFee: '0.2', networkFee: '0.2'})` if you want to override both with 0.2 GAS

All interfaces are documented here: [Neo N3 interfaces](https://github.com/OnBlockIO/ghostmarket-sdk-js/blob/master/src/core/models/n3/index.ts)

### Buying NFT
```js
const buyingDetails = [{ 
    contractAuctionId: '1', // on chain contract auction ID.
    price: '1', // order price - in biginteger format.
    quoteContract: '0x....', // order quote contract address.
}]
const buying = await gmSDK.buyMultiple(buyingDetails, {from: address})
console.info(buying)
```

### Listing NFT fixed price
```js
const startDate = new Date().getTime()
const listingDetails = [{ 
    tokenId: '1', // order NFT tokenId - token id for listing.
    baseContract: '0x....', // order base contract address - nft contract for listing.
    price: '1', // order price - in biginteger format.
    quoteContract: '0x....', // order quote contract address - currency accepted for listing.
    startDate, // order start date - set to custom one or it will default to right now.
    endDate: 0, // order end date - set to custom one or it will default to unexpiring.
}]
const listing = await gmSDK.sellMultiple(listingDetails, {from: address})
console.info(listing)
```

### Listing NFT auction
```js
const startDate = new Date().getTime()
const auctionDetails = { 
    auctionType: 1, // classic (1) reserve (2) dutch (3).
    tokenId: '1', // auction NFT tokenId.
    baseContract: '0x....', // auction base contract address.
    extensionPeriod: 600, // auction extension period - 600 for 10 min - max 1 hour.
    startDate, // auction start date.
    endDate: startDate + 600000, // auction end date. - startDate + 600000 for ten minutes.
    startPrice: '1', // auction start price in biginteger format.
    endPrice: 0, // auction end price - only used for dutch auctions.
    quoteContract: '0x....', // auction quote contract address.
}
const auction = await gmSDK.listAuction(auctionDetails, {from: address})
console.info(auction)
```

### Bid NFT auction
```js
const auctionDetails = { 
    contractAuctionId: '1', // on chain contract auction ID.
    bidPrice: '1', // bid price in biginteger format.
    quoteContract: '0x....', // auction quote contract address.
}
const bid = await gmSDK.bidAuction(auctionDetails, {from: address})
console.info(bid)
```

### Claim NFT auction
```js
const contractAuctionId = '1' // on chain contract auction ID.
const claim = await gmSDK.claimAuction(contractAuctionId, {from: address})
console.info(claim)
```

### Cancel listing
```js
const buyingDetails = [{ 
    contractAuctionId: '1', // on chain contract auction ID.
    quoteContract: '0x....', // order quote contract address.
    isCancellation: true, // is it a cancellation.
}]
const cancel = await gmSDK.buyMultiple(buyingDetails, {from: address})
console.info(cancel)
```

### Edit listing price
```js
const contractAuctionId = '1' // on chain contract auction ID.
const price = '1' // new price in biginteger format.
const edit = await gmSDK.editPrice(contractAuctionId, price, {from: address})
console.info(edit)
```

### Place offer
```js
const startDate = new Date().getTime()
const offerDetails = [{ 
    baseContract: '0x....', // offer base contract address - nft contract for offer.
    quoteContract: '0x....', // offer quote contract address - currency for offer - only GM supported for now.
    tokenId: '1', // offer NFT tokenId - token id for listing - leave empty for collection offer.
    price: '1', // offer price - in biginteger format.
    startDate, // offer start date - set to custom one or it will default to right now.
    endDate: 0, // offer end date - set to 0 for unexpiring - startDate + 604800 for one week.
}]
const offer = await gmSDK.placeOffer(offerDetails, {from: address})
console.info(offer)
```

### Accept offer
```js
const offerDetails = { 
    auctionId: '1', // on chain contract auction ID.
    quoteContract: '0x....', // offer quote contract address - currency for offer - only GM supported for now.
    tokenId: '1', // offer NFT tokenId - token id for listing - pass tokenId for collection offer.
    isCancellation: false, // is it an offer (true) or a cancellation (false).
}
const offer = await gmSDK.processOffer(offerDetails, {from: address})
console.info(offer)
```

### Cancel offer
```js
const offerDetails = { 
    auctionId: '1', // on chain contract auction ID.
    quoteContract: '0x....', // offer quote contract address - currency for offer - only GM supported for now.
    tokenId: '', // offer NFT tokenId - token id for listing - pass tokenId for collection offer.
    isCancellation: true, // is it an offer (true) or a cancellation (false).
}
const offer = await gmSDK.processOffer(offerDetails, {from: address})
console.info(offer)
```

### Transfer NEP17 token
```js
const destination = 'NLp9MRxBHH2YJrsF1D1VMXg3mvze3WSTqn'
const quoteContract = '0x....'
const amount = '1' // in biginteger format.
const transfer = await gmSDK.transferNEP17(destination, quoteContract, amount, {from: address})
console.info(transfer)
```

### Transfer NEP11 NFT
```js
const transferDetails = [{ 
    destination: 'NLp9MRxBHH2YJrsF1D1VMXg3mvze3WSTqn', // destination address.
    baseContract: '0x....', // contract address.
    tokenId: '1', // tokenId.
}]
const transfer = await gmSDK.transferNEP11(transferDetails, {from: address})
console.info(transfer)
```

### Burn NEP11 NFT
```js
const burnDetails = [{ 
    contractAddress: '0x....', // contract address.
    tokenId: '1', // tokenId.
}]
const burn = await gmSDK.burnNEP11(burnDetails, {from: address})
console.info(burn)
```

### Mint NEP11 NFT
```js
const royaltyRecipient = 'NLp9MRxBHH2YJrsF1D1VMXg3mvze3WSTqn'
const mintDetails = { 
    name: 'test name', // NFT name.
    description: 'test description', // NFT description.
    imageURL: 'ipfs://xxx', // image URL.
    royalties: [{address: royaltyRecipient, value: 1000}], // royalties - optional - use bps.
}
const token = await gmSDK.mintNEP11(mintDetails, {from: address})
console.info(token)
```


## Development

**Setup**

Clone this repo
```bash
git clone https://github.com/OnBlockIO/ghostmarket-sdk-js
```

Install 
```bash
cd ghostmarket-sdk-js/
yarn install
```

**Build**

To build
```bash
yarn build
```

**Test**

To run the tests
```bash
yarn test
```

**Contributing**

Contributions welcome! Please use [GitHub issues](https://github.com/OnBlockIO/ghostmarket-sdk-js/issues) for suggestions/issues.
