const { readFileSync } = require('fs');
const { Script, Transaction, PrivateKey, HDPrivateKey } = require('bitcore-lib-doge')
const dogecore = require('bitcore-lib-doge')
const { mnemonicToSeedSync } = require("bip39")
const _ = require('lodash')

const { getutxos, send_transaction } = require('./rpcutils')
const { sleep, tonumber, bnadd, bnmult } = require("./utils")
const { utxosnotin, bufferToChunk, opcodeToChunk, numberToChunk } = require('./inscriptions')

const sender_address = ""
const min_confirmations = 1
const fixed_fee = 0.1

const MAX_CHUNK_LEN = 240
const MAX_PAYLOAD_LEN = 1500
const satoshi2 = 0.1 * 1e8
Transaction.DUST_AMOUNT = bnmult(0.05, 1e8)

const get_useable_utxos = async () => {
    const utxos = await getutxos(sender_address)
    let useable_utxos = _.filter(utxos, (e) => { return e.confirmations >= min_confirmations })
    useable_utxos = useable_utxos.sort(function (a, b) { return a.height - b.height })
    const dust_utxos = _.filter(useable_utxos, (e) => { return e.satoshis <= 0.1 * 1e8 })
    return [useable_utxos, dust_utxos]
}

const getprivatekey = () => {
    const pooljson = JSON.parse(readFileSync('./pool.json'))
    const mnemonic = _.get(pooljson, ["seed"])
    const masterKey = HDPrivateKey.fromSeed(mnemonicToSeedSync(mnemonic).toString(`hex`))
    const accountKey = masterKey.deriveChild("m/44'/3'/0'/0/0")
    const privateKey = accountKey.privateKey.toString()
    return { privateKey, address: new PrivateKey(privateKey).toAddress().toString() }
}

const createScript = () => { return new Script() }

const goInscribe = (transaction, priKey, utxos, p2shInput) => {
    try {
        let amountTotal = tonumber(transaction.outputAmount) || 0
        amountTotal = bnadd(amountTotal, 1e8)
        const t_fees = fixed_fee * 1e8
        const used_utxos = []
        let curvalue = 0
        for (const u of utxos) {
            used_utxos.push(u)
            curvalue = bnadd(curvalue, u.satoshis)
            if (curvalue >= bnadd(amountTotal, t_fees)) {
                break
            }
        }
        if (curvalue < bnadd(amountTotal, t_fees)) {
            throw new Error(`not enough utxo`)
        }
        if (used_utxos && used_utxos.length > 0) {
            transaction
                .from(used_utxos)
                .fee(t_fees)
                .change(sender_address)
            if (p2shInput) {
                transaction.addInput(p2shInput)
            }
            transaction
                .sign(priKey)
            return [transaction, used_utxos]
        }
    } catch (error) {
        throw error
    }
    return [null, null]
}

const createTransactionB = async (dxid, _outputs, keystring = null) => {
    if (!keystring) throw new Error(`not found key.`)

    const [useable_utxos, _dust_utxos] = await get_useable_utxos()
    let temputxos = useable_utxos
    if (useable_utxos.length <= 0) {
        throw new Error(`not enough utxo for transaction.`)
    }

    let transferstr = "DX T T " + dxid
    if (!_outputs || _outputs.length < 1) {
        throw new Error(`not found outputs`)
    }
    _outputs.forEach((output) => {
        transferstr += `${output.amount}`;
        if (index < _outputs.length - 1) {
            transferstr += ' ';
        }
    })

    const txs = []
    const texthex = Buffer.from(transfobj, "utf8").toString("hex")
    let data = Buffer.from(texthex, "hex")


    const privateKey = new PrivateKey(keystring)
    const publicKey = privateKey.toPublicKey() // privateKey.toPublicKey()

    const dataparts = []
    while (data.length) {
        const part = data.slice(0, Math.min(MAX_CHUNK_LEN, data.length))
        data = data.slice(part.length)
        dataparts.push(part)
    }

    // write string date to script chunks
    const inscription = new Script()
    inscription.chunks.push(bufferToChunk('DX'))
    inscription.chunks.push(numberToChunk(dataparts.length))
    dataparts.forEach(
        (part, n) => {
            inscription.chunks.push(numberToChunk(dataparts.length - n - 1)) // 剩下的
            inscription.chunks.push(bufferToChunk(part))
        }
    )


    let p2shInput
    let lastLock
    let lastPartial

    const Hash = dogecore.crypto.Hash
    const Signature = dogecore.crypto.Signature

    while (inscription.chunks.length) {
        const partial = createScript()

        // if (txs.length == 0) {
        //     partial.chunks.push(inscription.chunks.shift()) // DX   
        //     partial.chunks.push(inscription.chunks.shift()) // number of pieces
        // }
        while (partial.toBuffer().length <= MAX_PAYLOAD_LEN && inscription.chunks.length) {
            partial.chunks.push(inscription.chunks.shift())
            partial.chunks.push(inscription.chunks.shift())
        }

        if (partial.toBuffer().length > MAX_PAYLOAD_LEN) {
            throw new Error(`payload too large`)
        }

        const _Opcode = dogecore.Opcode
        const lock = createScript()
        lock.chunks.push(bufferToChunk(publicKey.toBuffer()))
        lock.chunks.push(opcodeToChunk(_Opcode.OP_CHECKSIGVERIFY))
        partial.chunks.forEach(() => { lock.chunks.push(opcodeToChunk(_Opcode.OP_DROP)) })
        lock.chunks.push(opcodeToChunk(_Opcode.OP_TRUE))

        const lockhash = Hash.ripemd160(Hash.sha256(lock.toBuffer()))
        const p2sh = createScript()
        p2sh.chunks.push(opcodeToChunk(_Opcode.OP_HASH160))
        p2sh.chunks.push(bufferToChunk(lockhash))
        p2sh.chunks.push(opcodeToChunk(_Opcode.OP_EQUAL))

        const p2shOutput = new Transaction.Output({ script: p2sh, satoshis: satoshi2 })
        let tx = new Transaction().addOutput(p2shOutput)

        const [newtx, usedtxos] = goInscribe(tx, keystring, temputxos)
        if (!newtx || !usedtxos || usedtxos.length <= 0) {
            throw new Error(`process create transactino inscription error`)
        }
        tx = newtx
        txs.push([tx, usedtxos])
        temputxos = utxosnotin(temputxos, usedtxos)

        // eslint-disable-next-line @typescript-eslint/no-loop-func
        tx.outputs.forEach((output, vout) => {
            if (output.script.toAddress().toString() == sender_address) {
                temputxos.push({
                    address: sender_address,
                    txid: tx.hash,
                    outputIndex: vout,
                    script: output.script.toString(),
                    satoshis: output.satoshis,
                    confirmations: 0
                })
            }
        })

        p2shInput = new Transaction.Input({
            prevTxId: tx.hash,
            outputIndex: 0,
            output: tx.outputs[0],
            script: ''
        })

        p2shInput.clearSignatures = () => { }
        p2shInput.getSignatures = () => { }

        lastLock = lock
        lastPartial = partial
    }

    let tx = new Transaction()
    const tolist = []
    if (_outputs && _outputs.length > 0) {
        _outputs.forEach((output) => {
            tolist.push({ address: output.address, satoshis: satoshi2 })
        })
    }
    tolist.push({ address: sender_address, satoshis: satoshi2 })
    tx.to([{ address: sender_address, satoshis: satoshi2 }])

    const [newtx, usedtxos] = goInscribe(tx, keystring, temputxos, p2shInput)
    tx = newtx
    if (!newtx || !usedtxos || usedtxos.length <= 0) {
        throw new Error(`process create transactino inscription error`)
    }

    const p2shinput_index = tx.inputs.length - 1
    const signature = Transaction.sighash.sign(tx, privateKey, Signature.SIGHASH_ALL, p2shinput_index, lastLock)
    const txsignature = Buffer.concat([signature.toBuffer(), Buffer.from([Signature.SIGHASH_ALL])])

    const unlock = createScript()
    unlock.chunks = unlock.chunks.concat(lastPartial.chunks)
    unlock.chunks.push(bufferToChunk(txsignature))
    unlock.chunks.push(bufferToChunk(lastLock.toBuffer()))
    tx.inputs[p2shinput_index].setScript(unlock)

    txs.push([tx, usedtxos])
    temputxos = utxosnotin(temputxos, usedtxos)

    tx.outputs.forEach((output, vout) => {
        if (output.script.toAddress().toString() == sender_address) {
            temputxos.push({
                address: sender_address,
                txid: tx.hash,
                outputIndex: vout,
                script: output.script.toString(),
                satoshis: output.satoshis,
                confirmations: 0
            })
        }
    })

    return { txs, temputxos }
}

const sendmulti = async (dxid, receiver) => {
    const { privateKey } = getprivatekey()
    const { txs, _temputxos } = await createTransactionB(dxid, receiver, privateKey)
    if (!txs || txs.length <= 0) {
        throw new Error(`process swap a => b error in create transaction`)
    }
    for (_send_data of txs) {
        const [tx, _usedtxos] = _send_data
        let sendedTxid = null
        while (!sendedTxid) {
            console.info(`wait to process send token b transfer inscription `)
            sendedTxid = await send_transaction(tx.toString(), sender_address)
            if (sendedTxid) {
                console.log(`send transaction success ${sendedTxid}`)
            } else {
                console.log(`error in send transaction please try again`)
                break
            }
            await sleep(1000 * 5)
        }
    }
}

const main = async () => {
    const dxid = ""
    const receiver = [{ address: "", amount: 100000 }]
    sendmulti(dxid, receiver)
}

main()
