const _ = require('lodash')
const axios = require('axios')
const { Script } = require("bitcore-lib-doge")
const { tonumber } = require('./utils')

const rpcuser = ''
const rpcpassword = ''
const rpcport = 9001; // default Dogecoin JSON-RPC port
const rpcurl = `` //localhost

const client = axios.create({
    baseURL: `http://${rpcuser}:${rpcpassword}@${rpcurl}:${rpcport}`,
    headers: { 'Content-Type': 'application/json' }
})

const utxourl = ""
const sendurl = ""

const getJsonmethod = (method, params) => {
    return {
        jsonrpc: '1.0',
        id: 'curltest',
        method,
        params,
    }
}

const getBlockhash = async (currentBlock) => {
    let hash = null
    try {
        const res = await client.post(
            '/',
            getJsonmethod('getblockhash', [currentBlock]),
        )
        return _.get(res, ['data', 'result'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return hash
}

const getBlock = async (blockhash) => {
    let blockdata = null
    try {
        const res = await client.post('/', getJsonmethod('getblock', [blockhash]))
        return _.get(res, ['data', 'result'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return blockdata
}

const getBlockCount = async () => {
    let blocks = null
    try {
        const res = await client.post('/', getJsonmethod('getblockcount', []))
        return _.get(res, ['data', 'result'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return blocks
}

const getTransaction = async (txid) => {
    let tx = null
    try {
        const res = await client.post(
            '/',
            getJsonmethod('getrawtransaction', [txid, true]),
        )
        return _.get(res, ['data', 'result'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return tx
}

const getRawTransaction = async (txid) => {
    let tx = null
    try {
        const res = await client.post(
            '/',
            getJsonmethod('getrawtransaction', [txid, true]),
        )
        return _.get(res, ['data'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return tx
}

const getCurrentBlock = async () => {
    let blockdata = null
    try {
        const res = await client.post('/', getJsonmethod('getblockcount', []))
        return _.get(res, ['data', 'result'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return blockdata
}

const decodescript = async (hex) => {
    let blockdata = null
    try {
        const res = await client.post('/', getJsonmethod('decodescript', [hex]))
        return _.get(res, ['data', 'result'], null)
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return blockdata
}

const transferUxtos = (address, uxtos) => {
    return uxtos.map(
        (v) => {
            return Object.assign({}, {
                address,
                txid: _.get(v, ["txid"]),
                outputIndex: _.get(v, ["outputIndex"]),
                script: _.get(v, ["script"], null) || Script.buildPublicKeyHashOut(address).toString(),
                satoshis: tonumber(_.get(v, ["satoshis"])),
                time: _.get(v, ["time"], Date.now()),
                confirmations: _.get(v, ["confirmations"]),
                height: _.get(v, ["height"], null),
            })
        }
    )
}

const getutxos = async (address) => {
    let utxos = []
    try {
        const res = await axios({
            method: 'get',
            url: utxourl,
            responseType: "json",
            params: {
                method: "utxo",
                address,
                height: 0
            }
        })
        if (res?.data) {
            const data = res.data
            const status = _.get(data, ["status"], "failed")
            if (status === "success") {
                utxos = _.get(data, ["data"], [])
            }
        }
    } catch (error) {
        console.error(`Error: ${error.message}`)
    }
    return transferUxtos(address, utxos)
}

const send_transaction = async (hex, address) => {
    let txid = null
    try {
        const res = await axios({
            method: 'post',
            url: sendurl,
            responseType: "json",
            data: {
                address,
                method: "push",
                txhash: hex
            }
        })
        if (res?.data) {
            const data = res.data
            const status = _.get(data, ["status"], "failed")
            if (status === "success") {
                txid = _.get(data, ["data", "txid"], null)
            } else {
                console.error(`Error in push transaction: ${_.get(data, ["error", "message"], null)}`)
            }
        }
    } catch (error) {
        console.error(error)
        console.error(`Error: ${error.message}`)
    }
    return txid
}

const getmultitx = async (
    txidary, maxqueue
) => {
    let result = []
    const mapper = {}
    try {
        let qary = []
        for (let i = 0; i < txidary.length; i++) {
            const txid = txidary[i]
            qary.push(getTransaction(txid))
            if (i % maxqueue === 0 && qary.length > 0) {
                result = _.concat(result, await Promise.all(qary))
                qary = []
            }
        }
        if (qary.length > 0) result = _.concat(result, await Promise.all(qary))
        for (const txobj of result) {
            const txid = _.get(txobj, ["txid"], null)
            if (txid) {
                mapper[txid] = { ...txobj }
            }
        }
    } catch (error) {
        console.log(error)
    }
    return mapper
}

module.exports = {
    getBlock,
    getBlockhash,
    getBlockCount,
    getTransaction,
    getCurrentBlock,
    getutxos,
    decodescript,
    getRawTransaction,
    send_transaction,
    getmultitx
}
