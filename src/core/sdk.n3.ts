/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { numberToByteString, getScriptHashFromAddress, b64EncodeUnicode } from '../utils/n3/helpers'
import { u, wallet } from '@cityofzion/neon-js'
import { BigNumber } from '@ethersproject/bignumber'
import { N3PrivateProvider } from '../utils/n3/N3PrivateProvider'
import { MAINNET_API_URL, Chain, ChainFullName, AddressesByChain } from './constants'
import { MAX_INT_255, NULL_ADDRESS_N3 } from './constants/n3'
import {
    IBuyItem,
    ISellItem,
    IBidItem,
    ITransferItem,
    IBurnItem,
    IAuctionItem,
    IOfferItem,
    IProcessOfferItem,
    IMintItem,
    IRoyalties,
    IArgs,
    TxObject,
    Method,
    Standard,
} from '../core/models/n3'
import { GhostMarketApi, IGhostMarketApiOptions } from '../lib/api/'

export class GhostMarketN3SDK {
    private provider: string
    public readonly api: GhostMarketApi
    // Logger function to use when debugging.
    public logger: (arg: string) => void
    private _providerRPCUrl: string
    private _privateKey: string
    private _isMainNet: boolean
    private _chainName: Chain
    private _chainFullName: ChainFullName
    private _contractExchangeAddress: string
    private _contractIncentivesAddress: string
    private _contractLPStakingAddress: string
    private _contractLPTokenAddress: string
    private _contractNEP11Address: string
    private _contractManagementAddress: string

    /**
     * Your instance of GhostMarket.
     * Make API calls and GhostMarket Smart Contract method calls.
     * @param  {string} provider To use for creating an instance.
     * @param  {GhostMarketSDKConfig} options with options for accessing GhostMarket SDK.
     * @param  {(arg:string)=>void} logger? // Optional logger function for logging debug messages.
     */
    constructor(
        provider: string,
        options: {
            apiKey?: string
            environment?: string
            privateKey?: string
            rpcUrl?: string
            chainName?: Chain
        },
        logger?: (arg: string) => void,
    ) {
        options.apiKey = options.apiKey || ''
        options.environment = options.environment || MAINNET_API_URL
        this._isMainNet = options.chainName === Chain.NEO3
        options.privateKey = options.privateKey || ''
        options.rpcUrl = options.rpcUrl || ''
        this._providerRPCUrl = options.rpcUrl
        options.chainName = options.chainName || Chain.NEO3
        this._chainName = options.chainName
        this._chainFullName = ChainFullName[this._chainName as keyof typeof ChainFullName]
        this._contractExchangeAddress = this._getExchangeContractAddress(this._chainName)
        this._contractIncentivesAddress = this._getIncentivesContractAddress(this._chainName)
        this._contractLPStakingAddress = this._getLPStakingContractAddress(this._chainName)
        this._contractLPTokenAddress = this._getLPTokenContractAddress(this._chainName)
        this._contractNEP11Address = this._getNEP11GhostContractAddress(this._chainName)
        this._contractManagementAddress = this._getManagementContractAddress(this._chainName)
        this._privateKey = options.privateKey
        this.provider = provider || 'private'
        const apiConfig = {
            apiKey: options.apiKey,
            baseUrl: options.environment,
        } as IGhostMarketApiOptions
        this.api = new GhostMarketApi(apiConfig)
        // Logger: Default to nothing.
        this.logger = logger || ((arg: string) => arg)
        if (provider === 'private' && !options.privateKey) {
            throw new Error('Please set a private key!')
        }
    }

    /** Buy or cancel one or more NFT(s)
     * @param {IBuyItem[]} items details.
     * @param {TxObject} txObject transaction object to send when calling `buyMultiple`.
     */
    public async buyMultiple(items: IBuyItem[], txObject: TxObject): Promise<any> {
        const allowedContracts = [this._contractExchangeAddress.substring(2)]
        const argsBuyMultiple = []

        for (let i = 0; i < items.length; i++) {
            const item = items[i]

            console.log(
                `buyMultiple: ${item.isCancellation ? 'cancelling' : 'buying'} nft on ${
                    this._chainFullName
                }`,
            )

            const priceNFTFormatted = item.price

            if (item.isCancellation) {
                argsBuyMultiple.push({
                    scriptHash: this._contractExchangeAddress,
                    operation: Method.CANCEL_SALE,
                    args: [
                        {
                            type: 'ByteArray', // ByteString auctionId
                            value: numberToByteString(item.contractAuctionId.toString()),
                        },
                    ] as IArgs[],
                })
            } else {
                const quoteContract = item.quoteContract.substring(2)
                if (!allowedContracts.includes(quoteContract)) {
                    allowedContracts.push(quoteContract)
                }

                const balance = await this.checkTokenBalance(item.quoteContract, txObject.from)

                const amountDiff = BigNumber.from(priceNFTFormatted)
                const balanceDiff = BigNumber.from(balance.toString())
                const diff = amountDiff.sub(balanceDiff)
                if (diff.gt(BigNumber.from(0))) {
                    throw new Error(`Not enough balance to buy NFT, missing: ${diff}`)
                }

                argsBuyMultiple.push({
                    scriptHash: this._contractExchangeAddress,
                    operation: Method.BID_TOKEN,
                    args: [
                        {
                            type: 'Hash160', // UInt160 from
                            value: getScriptHashFromAddress(txObject.from),
                        },
                        {
                            type: 'ByteArray', // ByteString auctionId
                            value: numberToByteString(item.contractAuctionId.toString()),
                        },
                        {
                            type: 'Integer', // BigInteger price
                            value: priceNFTFormatted,
                        },
                    ] as IArgs[],
                })
            }
        }

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: this.provider === 'private' ? 128 : 16,
                allowedContracts,
            },
        ]
        const invokeParamsMultiple = {
            invokeArgs: argsBuyMultiple,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invokeMultiple(invokeParamsMultiple)
        } catch (e) {
            throw new Error(
                `buyMultiple: failed to execute ${
                    items[0].isCancellation ? Method.CANCEL_SALE : Method.BID_TOKEN
                } on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Create one or more sell order(s)
     * @param {ISellItem[]} items details.
     * @param {TxObject} txObject transaction object to send when calling `sellMultiple`.
     */
    public async sellMultiple(items: ISellItem[], txObject: TxObject): Promise<any> {
        const isListBatch = items.length > 1

        console.log(
            `sellMultiple: selling ${isListBatch ? 'bulk' : 'single'} nft on ${
                this._chainFullName
            }`,
        )

        const allowedContracts = [this._contractExchangeAddress.substring(2)]

        const argsListTokenMultiple = []

        for (let i = 0; i < items.length; i++) {
            const item = items[i]

            const supportsNEP11 = await this._supportsStandard(
                item.baseContract,
                txObject.from,
                Standard.NEP_11,
            )

            if (!supportsNEP11)
                throw new Error(`contract: ${item.baseContract} does not support NEP-11`)

            const supportsNEP17 = await this._supportsStandard(
                item.quoteContract,
                txObject.from,
                Standard.NEP_17,
            )

            if (!supportsNEP17)
                throw new Error(`contract: ${item.quoteContract} does not support NEP-17`)

            const owner = await this._ownerOf(item.baseContract, txObject.from, item.tokenId)

            if (owner.toLowerCase() !== txObject.from.toLowerCase())
                throw new Error(`owner: ${owner} does not match tx.sender: ${txObject.from}`)

            const currentDateFormatted =
                item.startDate === null || !item.startDate
                    ? new Date().getTime()
                    : new Date(item.startDate).getTime()
            const endDateFormatted =
                item.endDate === null || !item.endDate ? 0 : new Date(item.endDate).getTime()

            const maxAllowedDate = new Date().getTime() + 2592000000 * 6 // MSECONDS_PER_180_DAYS

            if (endDateFormatted > maxAllowedDate) {
                throw new Error(
                    `Listings must have an end date, with a maximum of 180 days from now`,
                )
            }

            const baseContract = item.baseContract.substring(2)
            if (!allowedContracts.includes(baseContract)) {
                allowedContracts.push(baseContract)
            }

            argsListTokenMultiple.push({
                scriptHash: this._contractExchangeAddress,
                operation: Method.LIST_TOKEN,
                args: [
                    {
                        type: 'Hash160', // UInt160 baseScriptHash
                        value: item.baseContract,
                    },
                    {
                        type: 'Hash160', // UInt160 from
                        value: getScriptHashFromAddress(txObject.from),
                    },
                    {
                        type: 'Hash160', // UInt160 quoteScriptHash
                        value: item.quoteContract,
                    },
                    {
                        type: 'ByteArray', // ByteString tokenId
                        value: item.tokenId,
                    },
                    {
                        type: 'Integer', // BigInteger price
                        value: item.price,
                    },
                    {
                        type: 'Integer', // BigInteger endPrice
                        value: 0,
                    },
                    {
                        type: 'Integer', // BigInteger startDate
                        value: currentDateFormatted,
                    },
                    {
                        type: 'Integer', // BigInteger endDate
                        value: endDateFormatted,
                    },
                    {
                        type: 'Integer', // BigInteger extensionPeriod
                        value: 0,
                    },
                    {
                        type: 'Integer', // BigInteger auctionType
                        value: 0, // auction type fixed listing
                    },
                ] as IArgs[],
            })
        }

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: this.provider === 'private' ? 128 : 16,
                allowedContracts,
            },
        ]
        const invokeParamsMultiple = {
            invokeArgs: argsListTokenMultiple,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invokeMultiple(invokeParamsMultiple)
        } catch (e) {
            throw new Error(
                `sellMultiple: failed to execute ${Method.LIST_TOKEN} on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Place Bid on NFT Auction
     * @param {IBidItem} item details.
     * @param {TxObject} txObject transaction object to send when calling `buyAuction`.
     */
    public async bidAuction(item: IBidItem, txObject: TxObject): Promise<any> {
        console.log(`bidAuction: bidding on nft on ${this._chainFullName}`)

        const currentBidFormatted = item.bidPrice || 0

        const balance = await this.checkTokenBalance(item.quoteContract, txObject.from)

        const amountDiff = BigNumber.from(currentBidFormatted.toString())
        const balanceDiff = BigNumber.from(balance.toString())
        const diff = amountDiff.sub(balanceDiff)
        if (diff.gt(BigNumber.from(0))) {
            throw new Error(`Not enough balance to bid on NFT, missing: ${diff}`)
        }

        const argsBidToken = [
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'ByteArray', // ByteString auctionId
                value: numberToByteString(item.contractAuctionId.toString()),
            },
            {
                type: 'Integer', // BigInteger price
                value: currentBidFormatted,
            },
        ] as IArgs[]

        const allowedContracts = [
            this._contractExchangeAddress.substring(2),
            item.quoteContract.substring(2),
        ]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: this.provider === 'private' ? 128 : 16,
                allowedContracts,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractExchangeAddress,
            operation: Method.BID_TOKEN,
            args: argsBidToken,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `bidAuction: failed to execute ${Method.BID_TOKEN} on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Put NFT on Auction
     * @param {IAuctionItem} item details.
     * @param {TxObject} txObject transaction object to send when calling `listAuction`.
     */
    public async listAuction(item: IAuctionItem, txObject: TxObject): Promise<any> {
        console.log(`listAuction: auction nft on ${this._chainFullName}`)

        const supportsNEP11 = await this._supportsStandard(
            item.baseContract,
            txObject.from,
            Standard.NEP_11,
        )

        if (!supportsNEP11)
            throw new Error(`contract: ${item.baseContract} does not support NEP-11`)

        const supportsNEP17 = await this._supportsStandard(
            item.quoteContract,
            txObject.from,
            Standard.NEP_17,
        )

        if (!supportsNEP17)
            throw new Error(`contract: ${item.quoteContract} does not support NEP-17`)

        let extensionPeriod = item.extensionPeriod ? item.extensionPeriod : 0 // min 0 - max 1h (3600)
        switch (item.auctionType) {
            case 1: // classic
                break
            case 2: // reserve
                break
            case 3: // dutch
                extensionPeriod = 0
                break
            case 0: // fixed
                extensionPeriod = 0
                break
        }

        const priceNFTFormatted = item.startPrice ?? 0
        const endPriceNFTFormatted = item.endPrice ?? 0

        const currentDateFormatted =
            item.startDate === null || !item.startDate
                ? new Date().getTime()
                : new Date(item.startDate).getTime()
        const endDateFormatted =
            item.endDate === null || !item.endDate ? 0 : new Date(item.endDate).getTime()

        const maxAllowedDate = new Date().getTime() + 2592000000 * 6 // MSECONDS_PER_180_DAYS

        if (item.auctionType !== 2 && endDateFormatted > maxAllowedDate) {
            throw new Error(`Auctions must have an end date, with a maximum of 180 days from now`)
        }

        const argsListToken = [
            {
                type: 'Hash160', // UInt160 baseScriptHash
                value: item.baseContract,
            },
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'Hash160', // UInt160 quoteScriptHash
                value: item.quoteContract,
            },
            {
                type: 'ByteArray', // ByteString tokenId
                value: item.tokenId,
            },
            {
                type: 'Integer', // BigInteger price
                value: priceNFTFormatted,
            },
            {
                type: 'Integer', // BigInteger endPrice
                value: endPriceNFTFormatted,
            },
            {
                type: 'Integer', // BigInteger startDate
                value: currentDateFormatted,
            },
            {
                type: 'Integer', // BigInteger endDate
                value: endDateFormatted,
            },
            {
                type: 'Integer', // BigInteger extensionPeriod
                value: extensionPeriod,
            },
            {
                type: 'Integer', // BigInteger auctionType
                value: item.auctionType,
            },
        ] as IArgs[]

        const allowedContracts = [this._contractExchangeAddress.substring(2)]
        const baseContract = item.baseContract.substring(2)
        if (!allowedContracts.includes(baseContract)) {
            allowedContracts.push(baseContract)
        }

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: this.provider === 'private' ? 128 : 16,
                allowedContracts,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractExchangeAddress,
            operation: Method.LIST_TOKEN,
            args: argsListToken,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `listAuction: failed to execute ${Method.LIST_TOKEN} on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Claim ended NFT Auction
     * @param {string} contractAuctionId on chain contract auction ID.
     * @param {TxObject} txObject transaction object to send when calling `claimAuction`.
     */
    public async claimAuction(contractAuctionId: string, txObject: TxObject): Promise<any> {
        console.log(`claimAuction: claiming nft auction on ${this._chainFullName}`)

        const argsBidToken = [
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'ByteArray', // ByteString auctionId
                value: numberToByteString(contractAuctionId),
            },
            {
                type: 'Integer', // BigInteger price
                value: 0,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractExchangeAddress,
            operation: Method.BID_TOKEN,
            args: argsBidToken,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `claimAuction: failed to execute ${Method.BID_TOKEN} on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Create one or more single nft offer or collection offer
     * @param {IOfferItem[]} items details.
     * @param {TxObject} txObject transaction object to send when calling `placeOffer`.
     */
    public async placeOffer(items: IOfferItem[], txObject: TxObject): Promise<any> {
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            console.log(
                `placeOffer: placing ${item.tokenId ? '' : 'collection '}offer on nft on ${
                    this._chainFullName
                }`,
            )

            const supportsNEP11 = await this._supportsStandard(
                item.baseContract,
                txObject.from,
                Standard.NEP_11,
            )

            if (!supportsNEP11)
                throw new Error(`contract: ${item.baseContract} does not support NEP-11`)

            const supportsNEP17 = await this._supportsStandard(
                item.quoteContract,
                txObject.from,
                Standard.NEP_17,
            )

            if (!supportsNEP17)
                throw new Error(`contract: ${item.quoteContract} does not support NEP-17`)

            const supportsNEP17Extension = await this._supportsStandard(
                item.quoteContract,
                txObject.from,
                Standard.NEP_17_1,
            )

            if (!supportsNEP17Extension)
                throw new Error(`contract: ${item.quoteContract} does not support NEP-17 Extension`)

            const balance = await this.checkTokenBalance(item.quoteContract, txObject.from)

            const amountDiff = BigNumber.from(item.price)
            const balanceDiff = BigNumber.from(balance.toString())
            const diff = amountDiff.sub(balanceDiff)
            if (diff.gt(BigNumber.from(0))) {
                throw new Error(`Not enough balance to place offer on NFT, missing: ${diff}`)
            }

            const currentDateFormatted =
                item.startDate === null || !item.startDate
                    ? new Date().getTime()
                    : new Date(item.startDate).getTime()
            const endDateFormatted =
                item.endDate === null || !item.endDate ? 0 : new Date(item.endDate).getTime()

            const maxAllowedDate = new Date().getTime() + 2592000000 * 6 // MSECONDS_PER_180_DAYS

            if (endDateFormatted > maxAllowedDate) {
                throw new Error(`Offers must have an end date, with a maximum of 180 days from now`)
            }

            const argsPlaceOffer = [
                {
                    type: 'Hash160', // UInt160 baseScriptHash
                    value: item.baseContract,
                },
                {
                    type: 'Hash160', // UInt160 from
                    value: getScriptHashFromAddress(txObject.from),
                },
                {
                    type: 'Hash160', // UInt160 quoteScriptHash
                    value: item.quoteContract,
                },
                {
                    type: 'ByteArray', // ByteString tokenId
                    value: item.tokenId ? item.tokenId : '', // set to null for collection offer
                },
                {
                    type: 'Integer', // BigInteger price
                    value: item.price,
                },
                {
                    type: 'Integer', // BigInteger startDate
                    value: currentDateFormatted,
                },
                {
                    type: 'Integer', // BigInteger endDate
                    value: endDateFormatted,
                },
            ]

            const signers = [
                {
                    account: getScriptHashFromAddress(txObject.from),
                    scopes: 1,
                },
            ]
            const invokeParams = {
                scriptHash: this._contractExchangeAddress,
                operation: Method.PLACE_OFFER,
                args: argsPlaceOffer,
                signers,
                networkFee: txObject.networkFee,
                systemFee: txObject.systemFee,
            }

            try {
                return this.invoke(invokeParams)
            } catch (e) {
                throw new Error(
                    `placeOffer: failed to execute ${Method.PLACE_OFFER} on ${this._contractExchangeAddress} with error: ${e}`,
                )
            }
        }
    }

    /** Accept or cancel a single nft offer or a collection offer
     * @param {IProcessOfferItem} item details.
     * @param {TxObject} txObject transaction object to send when calling `processOffer`.
     */
    public async processOffer(item: IProcessOfferItem, txObject: TxObject): Promise<any> {
        console.log(
            `processOffer: ${item.isCancellation ? 'cancel offer' : 'accept offer'} on nft on ${
                this._chainFullName
            }`,
        )

        const argsAcceptOffer = [
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'ByteArray', // ByteString auctionId
                value: numberToByteString(item.contractAuctionId),
            },
            {
                type: 'ByteArray', // ByteString tokenId
                value: item.tokenId ? item.tokenId : '',
            },
        ]

        const argsCancelOffer = [
            {
                type: 'ByteArray', // ByteString auctionId
                value: numberToByteString(item.contractAuctionId),
            },
        ]

        const allowedContracts = [this._contractExchangeAddress, item.quoteContract]

        const signers = item.isCancellation
            ? [
                  {
                      account: getScriptHashFromAddress(txObject.from),
                      scopes: 1,
                  },
              ]
            : [
                  {
                      account: getScriptHashFromAddress(txObject.from),
                      scopes: this.provider === 'private' ? 128 : 16,
                      allowedContracts,
                  },
              ]
        const invokeParams = {
            scriptHash: this._contractExchangeAddress,
            operation: item.isCancellation ? Method.CANCEL_OFFER : Method.ACCEPT_OFFER,
            args: item.isCancellation ? argsCancelOffer : argsAcceptOffer,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `processOffer: failed to execute ${
                    item.isCancellation ? Method.CANCEL_OFFER : Method.ACCEPT_OFFER
                } on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Edit NFT Listing - fixed price only
     * @param {string} contractAuctionId on chain contract auction ID.
     * @param {string} price new price to use for the listing.
     * @param {TxObject} txObject transaction object to send when calling `editPrice`.
     */
    public async editPrice(
        contractAuctionId: string,
        price: string,
        txObject: TxObject,
    ): Promise<any> {
        console.log(
            `editPrice: edit auction ${contractAuctionId} listing price on ${this._chainFullName}`,
        )

        const argsEditSale = [
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'ByteArray', // ByteString auctionId
                value: numberToByteString(contractAuctionId.toString()),
            },
            {
                type: 'Integer', // BigInteger price
                value: price,
            },
            {
                type: 'Integer', // BigInteger endPrice
                value: 0,
            },
            {
                type: 'Integer', // BigInteger startDate
                value: 0, // set to 0 - re use current one
            },
            {
                type: 'Integer', // BigInteger endDate
                value: 0, // set to 0 - re use current one
            },
            {
                type: 'Integer', // BigInteger extensionPeriod
                value: 0,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractExchangeAddress,
            operation: Method.EDIT_SALE,
            args: argsEditSale,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `editPrice: failed to execute ${Method.EDIT_SALE} on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Set royalties for contract
     * @param {string} contractAddress contract address to set royalties for.
     * @param {IRoyalties[]} royalties royalties settings to use for the contract.
     * @param {TxObject} txObject transaction object to send when calling `setRoyaltiesForContract`.
     */
    public async setRoyaltiesForContract(
        contractAddress: string,
        royalties: IRoyalties[],
        txObject: TxObject,
    ): Promise<any> {
        console.log(`setRoyaltiesForContract: edit collection royalties on ${this._chainFullName}`)

        if (this.provider === 'private') throw new Error('Only supported on Neoline / O3 for now.')

        const supportsNEP11 = await this._supportsStandard(
            contractAddress,
            txObject.from,
            Standard.NEP_11,
        )

        if (!supportsNEP11) throw new Error(`contract: ${contractAddress} does not support NEP-11`)

        /* const owner = await this._getOwner(contractAddress)

        if (owner.toLowerCase() !== txObject.from.toLowerCase())
            throw new Error(`owner: ${owner} does not match tx.sender: ${txObject.from}`) */

        // force empty if no royalties
        let argsSetCollectionRoyalties = [
            {
                type: 'Hash160', // UInt160 contract
                value: contractAddress,
            },
            {
                type: 'Array', // Array
                value: [],
            },
        ] as IArgs[]

        // otherwise add all royalties
        if (royalties.length > 0) {
            const royaltyArray = []
            for (let i = 0; i < royalties.length; i++) {
                royaltyArray.push(
                    {
                        type: 'Hash160', // UInt160 address
                        value: getScriptHashFromAddress(royalties[i].address),
                    },
                    {
                        type: 'Integer', // BigInteger value
                        value: royalties[i].value,
                    },
                )
            }
            argsSetCollectionRoyalties = [
                {
                    type: 'Hash160', // UInt160 contract
                    value: contractAddress,
                },
                {
                    type: 'Array', // Array
                    value: [
                        {
                            type: 'Array',
                            value: royaltyArray as IArgs[],
                        },
                    ],
                },
            ]
        }

        const allowedContracts = [contractAddress.substring(2), this._contractExchangeAddress]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: this.provider === 'private' ? 128 : 16,
                allowedContracts,
            },
            {
                account: contractAddress,
                scopes: this.provider === 'private' ? 128 : 16,
                allowedContracts,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractExchangeAddress,
            operation: Method.SET_ROYALTIES_FOR_CONTRACT,
            args: argsSetCollectionRoyalties,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `setRoyaltiesForContract: Failed to execute ${Method.SET_ROYALTIES_FOR_CONTRACT} on ${this._contractExchangeAddress} with error: ${e}`,
            )
        }
    }

    /** Approve Token Contract
     * @param {string} contractAddress contract to approve.
     * @param {TxObject} txObject transaction object to send when calling `approveToken`.
     */
    public async approveToken(contractAddress: string, txObject: TxObject): Promise<any> {
        console.log(
            `approveToken: approve ${contractAddress} for ${txObject.from} on ${this._chainFullName}`,
        )

        const supportsNEP17 = await this._supportsStandard(
            contractAddress,
            txObject.from,
            Standard.NEP_17,
        )

        if (!supportsNEP17) throw new Error(`contract: ${contractAddress} does not support NEP-17`)

        const supportsNEP17Extension = await this._supportsStandard(
            contractAddress,
            txObject.from,
            Standard.NEP_17_1,
        )

        if (!supportsNEP17Extension)
            throw new Error(`contract: ${contractAddress} does not support NEP-17 Extension`)

        const argsApproveToken = [
            {
                type: 'Hash160', // UInt160 from_address
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'Hash160', // UInt160 spender
                value: this._contractExchangeAddress,
            },
            {
                type: 'Integer', // BigInteger amount
                value: MAX_INT_255,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]
        const invokeParams = {
            scriptHash: contractAddress,
            operation: Method.APPROVE,
            args: argsApproveToken,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `approveToken: failed to execute ${Method.APPROVE} on ${contractAddress} with error: ${e}`,
            )
        }
    }

    /** Check NEP-17 Token Contract Approval
     * @param {string} contractAddress token contract to check approval.
     * @param {string} address address used to check.
     */
    public async checkTokenApproval(contractAddress: string, address: string): Promise<any> {
        console.log(
            `checkTokenApproval: reading ${contractAddress} approval for ${address} on N3 ${this._chainFullName}`,
        )

        const argsCheckAllowance = [
            {
                type: 'Hash160',
                value: getScriptHashFromAddress(address),
            },
            {
                type: 'Hash160',
                value: this._contractExchangeAddress,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(address),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: contractAddress,
            operation: Method.ALLOWANCE,
            args: argsCheckAllowance,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `checkTokenApproval exception: ${response.exception}`
            return response.stack && response.stack[0] && response.stack[0].value
        } catch (e) {
            throw new Error(
                `checkTokenApproval: failed to execute ${Method.ALLOWANCE} on ${contractAddress} with error: ${e}`,
            )
        }
    }

    /** Transfer NEP-17 Token
     * @param {string} destination destination address.
     * @param {string} quoteContract contract of token to transfer.
     * @param {string} amount amount to transfer.
     * @param {TxObject} txObject transaction object to send when calling `transferNEP17`.
     */
    public async transferNEP17(
        destination: string,
        quoteContract: string,
        amount: string,
        txObject: TxObject,
    ): Promise<any> {
        console.log(`transferNEP17: transfer token on ${this._chainFullName}`)

        const supportsNEP17 = await this._supportsStandard(
            quoteContract,
            txObject.from,
            Standard.NEP_17,
        )

        if (!supportsNEP17) throw new Error(`contract: ${quoteContract} does not support NEP-17`)

        const balance = await this.checkTokenBalance(quoteContract, txObject.from)

        const amountDiff = BigNumber.from(amount)
        const balanceDiff = BigNumber.from(balance.toString())
        const diff = amountDiff.sub(balanceDiff)
        if (diff.gt(BigNumber.from(0))) {
            throw new Error(`Not enough balance to transfer NEP-17, missing: ${diff}`)
        }

        const argsTransfer = [
            {
                type: 'Hash160', // frm
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'Hash160', // to
                value: getScriptHashFromAddress(destination),
            },
            {
                type: 'Integer', // amount
                value: amount,
            },
            {
                type: 'String', // data
                value: '',
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: quoteContract,
            operation: Method.TRANSFER,
            args: argsTransfer,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `transferNEP17: failed to execute ${Method.TRANSFER} on ${quoteContract} with error: ${e}`,
            )
        }
    }

    /** Transfer one or more NEP-11 NFT(s)
     * @param {ITransferItem[]} items details.
     * @param {TxObject} txObject transaction object to send when calling `transferNEP11`.
     */
    public async transferNEP11(items: ITransferItem[], txObject: TxObject): Promise<any> {
        const isTransferBatch = items.length > 1

        console.log(
            `transferNEP11: transfer ${isTransferBatch ? 'bulk' : 'single'} nft on ${
                this._chainFullName
            }`,
        )

        const argsTransferMultiple = []

        for (let i = 0; i < items.length; i++) {
            const item = items[i]

            const owner = await this._ownerOf(item.baseContract, txObject.from, item.tokenId)

            if (owner.toLowerCase() !== txObject.from.toLowerCase())
                throw new Error(`owner: ${owner} does not match tx.sender: ${txObject.from}`)

            argsTransferMultiple.push({
                scriptHash: item.baseContract,
                operation: Method.TRANSFER,
                args: [
                    {
                        type: 'Hash160', // UInt160 address
                        value: getScriptHashFromAddress(item.destination),
                    },
                    {
                        type: 'ByteArray', // ByteArray tokenId
                        value: item.tokenId,
                    },
                    {
                        type: 'String', // data
                        value: '',
                    },
                ] as IArgs[],
            })
        }

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]

        const invokeParamsMultiple = {
            invokeArgs: argsTransferMultiple,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invokeMultiple(invokeParamsMultiple)
        } catch (e) {
            throw new Error(
                `transferNEP11: failed to execute ${Method.TRANSFER} on ${items[0].baseContract} with error: ${e}`,
            )
        }
    }

    /** Burn one or more NEP-11 NFT(s)
     * @param {IBurnItem[]} items details.
     * @param {TxObject} txObject transaction object to send when calling `burnNEP11`.
     */
    public async burnNEP11(items: IBurnItem[], txObject: TxObject): Promise<any> {
        const isBurnBatch = items.length > 1

        console.log(
            `burnNEP11: burn ${isBurnBatch ? 'bulk' : 'single'} nft on ${this._chainFullName}`,
        )

        const argsBurnMultiple = []

        for (let i = 0; i < items.length; i++) {
            const item = items[i]

            const owner = await this._ownerOf(item.contractAddress, txObject.from, item.tokenId)

            if (owner.toLowerCase() !== txObject.from.toLowerCase())
                throw new Error(`owner: ${owner} does not match tx.sender: ${txObject.from}`)

            argsBurnMultiple.push({
                scriptHash: item.contractAddress,
                operation: Method.BURN,
                args: [
                    {
                        type: 'ByteArray', // ByteArray tokenId
                        value: item.tokenId,
                    },
                ] as IArgs[],
            })
        }

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]
        const invokeParamsMultiple = {
            invokeArgs: argsBurnMultiple,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invokeMultiple(invokeParamsMultiple)
        } catch (e) {
            throw new Error(
                `burnNEP11: failed to execute ${Method.BURN} on ${items[0].contractAddress} with error: ${e}`,
            )
        }
    }

    /** Mint one or more NEP-11 NFT(s)
     * @param {IMintItem} item details.
     * @param {TxObject} txObject transaction object to send when calling `mintNEP11`.
     */
    public async mintNEP11(item: IMintItem, txObject: TxObject): Promise<any> {
        const quantity = item.quantity ?? 1
        if (quantity > 10) throw new Error(`You can only mint 10 NFT at once maximum.`)
        const isMintBatch = quantity > 1

        console.log(
            `mintNEP11: minting ${isMintBatch ? 'bulk' : 'single'} nft on ${this._chainFullName}`,
        )

        const isOnChainMetadata = true

        const creatorAddress = txObject.from
        const type = item.type ?? 1
        const hasLocked = false
        const attributes: {
            trait_type: string | number | undefined
            value: string | number | undefined
            display_type?: string
        }[] = []

        // display_type unused for now
        if (item.attrT1 !== '') {
            attributes.push({ trait_type: item.attrT1, value: item.attrV1 })
        }
        if (item.attrT2 !== '') {
            attributes.push({ trait_type: item.attrT2, value: item.attrV2 })
        }
        if (item.attrT3 !== '') {
            attributes.push({ trait_type: item.attrT3, value: item.attrV3 })
        }

        let jsonMetadata = JSON.stringify({
            name: item.name,
            description: item.description,
            image: item.imageURL,
            tokenURI: '',
            attributes,
            properties: {
                has_locked: hasLocked,
                type,
            },
        })

        if (!isOnChainMetadata) {
            jsonMetadata = JSON.stringify({
                name: item.name,
                tokenURI: item.externalURI,
            })
        }

        let contractRoyalties = ''
        if (item.royalties) {
            const arrayRoyalties = []
            for (let i = 0; i < item.royalties.length; i++) {
                arrayRoyalties.push({
                    address: item.royalties[i].address,
                    value: item.royalties[i].value.toString(),
                })
            }
            contractRoyalties = JSON.stringify(arrayRoyalties)
        }

        let argsMint = [
            {
                type: 'Hash160', // account
                value: getScriptHashFromAddress(creatorAddress),
            },
            {
                type: 'ByteArray', // meta
                value: b64EncodeUnicode(jsonMetadata),
            },
            {
                type: 'ByteArray', // lockedContent
                value: '', // lock content not available at the moment on SDK
            },
            {
                type: 'ByteArray', // royalties
                value: contractRoyalties ? btoa(contractRoyalties.toString()) : '',
            },
        ] as IArgs[]

        if (isMintBatch) {
            const tokensMeta = []
            const tokensLock = []
            const tokensRoya = []
            for (let i = 0; i < quantity; i++) {
                tokensMeta.push({
                    type: 'ByteArray',
                    value: b64EncodeUnicode(jsonMetadata),
                })
                tokensLock.push({
                    type: 'ByteArray',
                    value: '', // lock content not available at the moment on SDK
                })
                tokensRoya.push({
                    type: 'ByteArray',
                    value: btoa(contractRoyalties.toString()),
                })
            }
            argsMint = [
                {
                    type: 'Hash160',
                    value: getScriptHashFromAddress(creatorAddress),
                },
                {
                    type: 'Array',
                    value: tokensMeta,
                },
                {
                    type: 'Array',
                    value: '', // lock content not available at the moment on SDK
                },
                {
                    type: 'Array',
                    value: tokensRoya,
                },
            ] as IArgs[]
        }

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: this._contractNEP11Address,
            operation: isMintBatch ? Method.MULTI_MINT : Method.MINT,
            args: argsMint,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `mintNEP11: failed to execute ${isMintBatch ? Method.MULTI_MINT : Method.MINT} on ${
                    this._contractNEP11Address
                } with error: ${e}`,
            )
        }
    }

    /** Check one token balance for address
     * @param {string} contractAddress token contract to check approval.
     * @param {string} address address used to check.
     */
    public async checkTokenBalance(contractAddress: string, address: string): Promise<any> {
        console.log(
            `checkTokenBalance: checking ${contractAddress} balance for ${address} on ${this._chainFullName}`,
        )

        const argsCheckTokenBalance = [
            {
                type: 'Hash160', // UInt160 address
                value: getScriptHashFromAddress(address),
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(address),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: contractAddress,
            operation: Method.BALANCE_OF,
            args: argsCheckTokenBalance,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `checkTokenBalance exception: ${response.exception}`
            return response.stack && response.stack[0] && response.stack[0].value
        } catch (e) {
            throw new Error(
                `checkTokenBalance: failed to execute ${Method.BALANCE_OF} on ${contractAddress} with error: ${e}`,
            )
        }
    }

    /** Check incentives for address
     * @param {string} address address used to check.
     */
    public async checkIncentives(address: string): Promise<any> {
        console.log(`checkIncentives: reading incentives on ${this._chainFullName}`)

        const argsCheckIncentives = [
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(address),
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(address),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: this._contractIncentivesAddress,
            operation: Method.GET_INCENTIVE,
            args: argsCheckIncentives,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `checkIncentives exception: ${response.exception}`
            return response.stack && response.stack[0] && response.stack[0].value
        } catch (e) {
            throw new Error(
                `checkIncentives: failed to execute ${Method.GET_INCENTIVE} on ${this._contractIncentivesAddress} with error: ${e}`,
            )
        }
    }

    /** Claim incentives for address
     * @param {TxObject} txObject transaction object to send when calling `claimIncentives`.
     */
    public async claimIncentives(txObject: TxObject): Promise<any> {
        console.log(`claimIncentives: claiming incentives on ${this._chainFullName}`)

        const balance = await this.checkIncentives(txObject.from)
        if (parseInt(balance[5]?.value) === 0) {
            throw new Error(`nothing to claim on incentives contract`)
        }

        const argsClaimIncentives = [
            {
                type: 'Hash160', // UInt160 from
                value: getScriptHashFromAddress(txObject.from),
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: this._contractIncentivesAddress,
            operation: Method.CLAIM,
            args: argsClaimIncentives,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `claimIncentives: failed to execute ${Method.CLAIM} on ${this._contractIncentivesAddress} with error: ${e}`,
            )
        }
    }

    /** Check stakes on LP staking contract for address
     * @param {string} accountAddress address used to check.
     */
    public async checkLPStakes(address: string): Promise<any> {
        console.log(
            `checkLPStakes: checking LP stakes for address ${address} on ${this._chainFullName}`,
        )

        const argsCheckLPStakes = [
            {
                type: 'Hash160',
                value: getScriptHashFromAddress(address),
            },
            {
                type: 'Hash160',
                value: this._contractLPTokenAddress,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(address),
                scopes: 1,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractLPStakingAddress,
            operation: Method.READ_LP_STAKES,
            args: argsCheckLPStakes,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `checkLPStakes exception: ${response.exception}`
            return (
                response.stack &&
                response.stack[0] &&
                response.stack[0].value &&
                response.stack[0].value / Math.pow(10, 8)
            )
        } catch (e) {
            throw new Error(
                `checkLPStakes: failed to execute ${Method.READ_LP_STAKES} on ${this._contractLPStakingAddress} with error: ${e}`,
            )
        }
    }

    /** Check rewards on LP staking contract for address
     * @param {string} accountAddress address used to check.
     */
    public async checkLPRewards(accountAddress: string): Promise<any> {
        console.log(
            `checkLPRewards: checking LP rewards for address ${accountAddress} on ${this._chainFullName}`,
        )

        const argsCheckLPRewards = [
            {
                type: 'Hash160',
                value: getScriptHashFromAddress(accountAddress),
            },
            {
                type: 'Hash160',
                value: this._contractLPTokenAddress,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(accountAddress),
                scopes: 1,
            },
        ]
        const invokeParams = {
            scriptHash: this._contractLPStakingAddress,
            operation: Method.READ_LP_REWARDS,
            args: argsCheckLPRewards,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `checkLPRewards exception: ${response.exception}`
            return response.stack && response.stack[0] && response.stack[0].value
        } catch (e) {
            throw new Error(
                `checkLPRewards: failed to execute ${Method.READ_LP_REWARDS} on ${this._contractLPStakingAddress} with error: ${e}`,
            )
        }
    }

    /** Claim LP rewards on LP staking contract for address
     * @param {TxObject} txObject transaction object to send when calling `claimLPRewards`.
     */
    public async claimLPRewards(txObject: TxObject): Promise<any> {
        console.log(`claimLPRewards: claiming LP Rewards on ${this._chainFullName}`)

        const balance = await this.checkLPRewards(txObject.from)
        if (parseInt(balance) === 0) {
            throw new Error(`nothing to claim on LP staking contract`)
        }

        const argsClaimLPRewards = [
            {
                type: 'Hash160', // UInt160 sender
                value: txObject.from,
            },
            {
                type: 'Hash160', // UInt160 token
                value: this._contractLPTokenAddress,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(txObject.from),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: this._contractLPStakingAddress,
            operation: Method.CLAIM_LP_INCENTIVES,
            args: argsClaimLPRewards,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `claimLPRewards: failed to execute ${Method.CLAIM_LP_INCENTIVES} on ${this._contractLPStakingAddress} with error: ${e}`,
            )
        }
    }

    /** Stake/Unstake LP tokens on LP staking contract for address
     * @param {string} amount value to stake or unstake.
     * @param {boolean} isStaking true if staking, or false if unstaking.
     * @param {TxObject} txObject transaction object to send when calling `stakeLPTokens`.
     */
    public async stakeLPTokens(
        amount: string,
        isStaking: boolean,
        txObject: TxObject,
    ): Promise<any> {
        console.log(
            `stakeLPTokens: ${isStaking ? '' : 'un'}staking LP tokens on ${this._chainFullName}`,
        )

        const argsStakeLP = [
            {
                type: 'Hash160', // UInt160 sender
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'Hash160', // UInt160 token
                value: this._contractLPStakingAddress,
            },
            {
                type: 'Integer', // Integer amount
                value: (parseInt(amount) / Math.pow(10, 10)).toString(),
            },
            {
                type: 'Any', // Any
                value: '',
            },
        ] as IArgs[]

        const argsUnstakeLP = [
            {
                type: 'Hash160', // UInt160 sender
                value: getScriptHashFromAddress(txObject.from),
            },
            {
                type: 'Integer', // Integer amount
                value: (parseInt(amount) / Math.pow(10, 10)).toString(),
            },
            {
                type: 'Hash160', // UInt160 token
                value: this._contractLPTokenAddress,
            },
        ] as IArgs[]

        const allowedContracts = [this._contractLPStakingAddress, this._contractLPTokenAddress]

        const signers = isStaking
            ? [
                  {
                      account: getScriptHashFromAddress(txObject.from),
                      scopes: 16,
                      allowedContracts,
                  },
              ]
            : [
                  {
                      account: getScriptHashFromAddress(txObject.from),
                      scopes: 1,
                  },
              ]

        const invokeParams = {
            scriptHash: isStaking ? this._contractLPTokenAddress : this._contractLPStakingAddress,
            operation: isStaking ? Method.STAKE_LP : Method.UNSTAKE_LP,
            args: isStaking ? argsStakeLP : argsUnstakeLP,
            signers,
            networkFee: txObject.networkFee,
            systemFee: txObject.systemFee,
        }

        try {
            return this.invoke(invokeParams)
        } catch (e) {
            throw new Error(
                `stakeLPTokens: failed to execute ${
                    isStaking ? Method.STAKE_LP : Method.UNSTAKE_LP
                } on ${
                    isStaking ? this._contractLPTokenAddress : this._contractLPStakingAddress
                } with error: ${e}`,
            )
        }
    }

    /** Sign Data
     * @param {string} dataToSign data to sign.
     */
    public async signData(dataToSign: string): Promise<any> {
        console.log(`signData: signing data on ${this._chainFullName}`)

        if (this.provider === 'private') throw new Error('Only supported on Neoline / O3 for now.')

        try {
            const signedMessage = await this.getProvider().signMessage({ message: dataToSign })

            const { publicKey, message, salt, data } = signedMessage

            console.log('Public key used to sign:', publicKey)
            console.log('Original message:', message)
            console.log('Salt added to message:', salt)
            console.log('Signed data:', data)

            return { signature: data, random: salt, pub_key: publicKey }
        } catch ({ type, description, data }: any) {
            switch (type) {
                case 'NO_PROVIDER':
                    throw new Error('No provider available.')
                case 'RPC_ERROR':
                    throw new Error(
                        'There was an error when broadcasting this transaction to the network.',
                    )
                case 'CANCELLED':
                case 'CANCELED':
                    throw new Error('The user has canceled this transaction.')
                default:
                    throw new Error(description as string)
            }
        }
    }

    /** Get Incentives contract address
     * @param {string} chainName chain name to check.
     */
    private _getIncentivesContractAddress(chainName: string): string {
        return AddressesByChain[chainName as keyof typeof AddressesByChain].INCENTIVES
    }

    /** Get LP Staking contract address
     * @param {string} chainName chain name to check.
     */
    private _getLPStakingContractAddress(chainName: string): string {
        return AddressesByChain[chainName as keyof typeof AddressesByChain].LP_STAKING!
    }

    /** Get LP Token contract address
     * @param {string} chainName chain name to check.
     */
    private _getLPTokenContractAddress(chainName: string): string {
        return AddressesByChain[chainName as keyof typeof AddressesByChain].LP_TOKEN!
    }

    /** Get NEP-11 Ghost contract address
     * @param {string} chainName chain name to check.
     */
    private _getNEP11GhostContractAddress(chainName: string): string {
        return AddressesByChain[chainName as keyof typeof AddressesByChain].GHOST_NEP11!
    }

    /** Get Exchange contract address
     * @param {string} chainName chain name to check.
     */
    private _getExchangeContractAddress(chainName: string): string {
        return AddressesByChain[chainName as keyof typeof AddressesByChain].EXCHANGE
    }

    /** Get Management contract address
     * @param {string} chainName chain name to check.
     */
    private _getManagementContractAddress(chainName: string): string {
        return AddressesByChain[chainName as keyof typeof AddressesByChain].CONTRACT_MANAGEMENT!
    }

    /** Get owner of a contract
     * @param {string} contractAddress contract address.
     */
    /* private _getOwner(contractAddress: string): Promise<string> {
        console.log(
            `_getOwner: checking contract ownership for contract ${contractAddress} on ${this._chainFullName}`,
        )

        throw new Error('Feature not available on Neo N3 yet!')
    } */

    /** Get owner of an NEP-11 NFT
     * @param {string} contractAddress contract address of NFT.
     * @param {string} address address used to check.
     * @param {string} tokenId tokenId of NFT.
     */
    private async _ownerOf(
        contractAddress: string,
        address: string,
        tokenId: string,
    ): Promise<string> {
        console.log(
            `_ownerOf: checking NEP-11 owner for contract ${contractAddress} for token id ${tokenId} on ${this._chainFullName}`,
        )

        const argsCheckOwnerOf = [
            {
                type: 'ByteArray', // ByteArray tokenId
                value: tokenId,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(address),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: contractAddress,
            operation: Method.OWNER_OF,
            args: argsCheckOwnerOf,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `_ownerOf exception: ${response.exception}`
            const owner = response.stack[0]?.value
            console.log(
                `NFT ${tokenId} from contract ${contractAddress} current owner: ${wallet.getAddressFromScriptHash(
                    u.reverseHex(u.HexString.fromBase64(owner).toString()),
                )}`,
            )
            return wallet.getAddressFromScriptHash(
                u.reverseHex(u.HexString.fromBase64(owner).toString()),
            )
        } catch (e) {
            console.log(e)
            return NULL_ADDRESS_N3
        }
    }

    /** Get contract support for one particular standard
     * @param {string} contractAddress contract address to check.
     * @param {string} address address used to check.
     * @param {string} standard standard to check.
     */
    private async _supportsStandard(
        contractAddress: string,
        address: string,
        standard: string,
    ): Promise<any> {
        console.log(
            `_supportsStandard: checking support for ${standard} for contract ${contractAddress} on ${this._chainFullName}`,
        )

        const argsGetContract = [
            {
                type: 'Hash160', // UInt160 contract
                value: contractAddress,
            },
        ] as IArgs[]

        const signers = [
            {
                account: getScriptHashFromAddress(address),
                scopes: 1,
            },
        ]

        const invokeParams = {
            scriptHash: this._contractManagementAddress,
            operation: Method.GET_CONTRACT,
            args: argsGetContract,
            signers,
        }

        try {
            const response = await this.invokeRead(invokeParams)
            if (response.exception) return `_supportsStandard exception: ${response.exception}`
            const supportedStandards = response.stack[0]?.value[4]?.value[3]?.value
            let supportsStandard = false
            for (let i = 0; i < supportedStandards.length; i++) {
                if (atob(supportedStandards[i]?.value) === standard) supportsStandard = true
            }
            console.log(`${standard} support: ${supportsStandard}`)
            return supportsStandard
        } catch (e) {
            throw new Error(
                `_supportsStandard: failed to execute ${Method.GET_CONTRACT} on ${this._contractManagementAddress} with error: ${e}`,
            )
        }
    }

    /** Get Provider
     */
    public getProvider() {
        switch (this.provider) {
            case 'private': {
                return new N3PrivateProvider(
                    this._providerRPCUrl,
                    this._privateKey,
                    this._isMainNet,
                )
            }
            case 'neoline': {
                const win = window as any
                if (!win.NEOLineN3) {
                    throw new Error('Neoline not installed. Please install it and try again.')
                }
                return new win.NEOLineN3.Init()
            }
            case 'o3':
            default:
                // eslint-disable-next-line no-case-declarations
                const win = window as any
                if (!win.neo3Dapi) {
                    throw new Error('O3 not installed. Please install it and try again.')
                }
                return win.neo3Dapi
        }
    }

    invoke(invokeParams: any): Promise<string> {
        if (invokeParams.networkFee && (this.provider === 'neoline' || this.provider === 'o3')) {
            invokeParams.fee = invokeParams.networkFee
        }
        if (invokeParams.systemFee && this.provider === 'neoline') {
            invokeParams.overrideSystemFee = invokeParams.systemFee
        }
        if (invokeParams.systemFee && this.provider === 'o3') {
            invokeParams.extraSystemFee = invokeParams.systemFee
        }
        return new Promise((resolve, reject) => {
            this.getProvider()
                .invoke(invokeParams)
                .then((result: any) => {
                    console.log('Invoke transaction success!')
                    console.log('--- Transaction hash ---')
                    console.log(result.txid)
                    resolve(result.txid)
                })
                .catch(({ type, description }: any) => {
                    let errMsg = 'Unknown error'
                    switch (type) {
                        case 'NO_PROVIDER':
                            errMsg = 'No provider available.'
                            break
                        case 'RPC_ERROR':
                            errMsg =
                                'There was an error when broadcasting this transaction to the network.'
                            if (description.exception) {
                                errMsg = description.exception
                            }
                            break
                        case 'CANCELLED':
                        case 'CANCELED':
                            errMsg = 'The user has cancelled this transaction.'
                            break
                        default:
                            if (description) {
                                errMsg = description
                            }
                            if (description && description.msg) {
                                errMsg = description.msg
                            }
                    }
                    reject(new Error(errMsg))
                })
        })
    }

    invokeMultiple(invokeParams: any): Promise<string> {
        if (invokeParams.networkFee && (this.provider === 'neoline' || this.provider === 'o3')) {
            invokeParams.fee = invokeParams.networkFee
        }
        if (invokeParams.systemFee && this.provider === 'neoline') {
            invokeParams.overrideSystemFee = invokeParams.systemFee
        }
        if (invokeParams.systemFee && this.provider === 'o3') {
            invokeParams.extraSystemFee = invokeParams.systemFee
        }
        return new Promise((resolve, reject) => {
            ;(this.provider === 'o3'
                ? this.getProvider().invokeMulti(invokeParams)
                : this.getProvider().invokeMultiple(invokeParams)
            )
                .then((result: any) => {
                    console.log('Invoke multiple transaction success!')
                    console.log('--- Transaction hash ---')
                    console.log(result.txid)
                    resolve(result.txid)
                })
                .catch(({ type, description }: any) => {
                    let errMsg = 'Unknown error'
                    switch (type) {
                        case 'NO_PROVIDER':
                            errMsg = 'No provider available.'
                            break
                        case 'RPC_ERROR':
                            errMsg =
                                'There was an error when broadcasting this transaction to the network.'
                            if (description.exception) {
                                errMsg = description.exception
                            }
                            break
                        case 'CANCELLED':
                        case 'CANCELED':
                            errMsg = 'The user has cancelled this transaction.'
                            break
                        default:
                            if (description) {
                                errMsg = description
                            }
                            if (description && description.msg) {
                                errMsg = description.msg
                            }
                    }
                    reject(new Error(errMsg))
                })
        })
    }

    invokeRead(invokeParams: any): Promise<any> {
        // console.log('invokeRead', invokeParams)
        return new Promise((resolve, reject) => {
            this.getProvider()
                .invokeRead(invokeParams)
                .then((result: any) => {
                    console.log('InvokeRead success!')
                    resolve(result)
                })
                .catch(({ type, description }: any) => {
                    let errMsg = 'Unknown error'
                    switch (type) {
                        case 'NO_PROVIDER':
                            errMsg = 'No provider available.'
                            break
                        case 'Remote rpc error':
                        case 'RPC_ERROR':
                            errMsg =
                                'There was an error when broadcasting this transaction to the network.'
                            if (description.exception) {
                                errMsg = description.exception
                            }
                            break
                        case 'User rejected':
                        case 'CANCELLED':
                        case 'CANCELED':
                            errMsg = 'The user has cancelled this transaction.'
                            break
                        default:
                            if (description) {
                                errMsg = description
                            }
                            if (description && description.msg) {
                                errMsg = description.msg
                            }
                    }
                    reject(new Error(errMsg))
                })
        })
    }

    invokeReadMultiple(invokeParams: any): Promise<any> {
        // console.log('invokeRead', invokeParams)
        return new Promise((resolve, reject) => {
            this.getProvider()
            ;(this.provider === 'o3'
                ? this.getProvider().invokeReadMulti(invokeParams)
                : this.getProvider().invokeReadMultiple(invokeParams)
            )
                .then((result: any) => {
                    console.log('InvokeRead success!')
                    resolve(result)
                })
                .catch(({ type, description }: any) => {
                    let errMsg = 'Unknown error'
                    switch (type) {
                        case 'NO_PROVIDER':
                            errMsg = 'No provider available.'
                            break
                        case 'Remote rpc error':
                        case 'RPC_ERROR':
                            errMsg =
                                'There was an error when broadcasting this transaction to the network.'
                            if (description.exception) {
                                errMsg = description.exception
                            }
                            break
                        case 'User rejected':
                        case 'CANCELLED':
                        case 'CANCELED':
                            errMsg = 'The user has cancelled this transaction.'
                            break
                        default:
                            if (description) {
                                errMsg = description
                            }
                            if (description && description.msg) {
                                errMsg = description.msg
                            }
                    }
                    reject(new Error(errMsg))
                })
        })
    }
}
