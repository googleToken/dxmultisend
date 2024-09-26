function chunkToNumber(chunk) {
    if (chunk.opcodenum == 0) return 0
    if (chunk.opcodenum == 1) return chunk.buf[0]
    if (chunk.opcodenum == 2) return chunk.buf[1] * 255 + chunk.buf[0]
    if (chunk.opcodenum > 80 && chunk.opcodenum <= 96) return chunk.opcodenum - 80
    return undefined
}

function bufferToChunk(b, type) {
    b = Buffer.from(b, type)
    return {
        buf: b.length ? b : undefined,
        len: b.length,
        opcodenum: b.length <= 75 ? b.length : b.length <= 255 ? 76 : 77
    }
}

function numberToChunk(n) {
    return {
        buf: n <= 16 ? undefined : n < 128 ? Buffer.from([n]) : Buffer.from([n % 256, n / 256]),
        len: n <= 16 ? 0 : n < 128 ? 1 : 2,
        opcodenum: n == 0 ? 0 : n <= 16 ? 80 + n : n < 128 ? 1 : 2
    }
}

function opcodeToChunk(op) {
    return { opcodenum: op }
}

function utxosnotin(utxos, compareUtxos) {
    let newutxos = []
    try {
        const cmputxos = {}
        for (const ou of compareUtxos) {
            const xkey = `${ou.txid}-${String(ou.outputIndex)}`
            if (!Object.hasOwn(cmputxos, xkey) && ou?.satoshis > 0) {
                cmputxos[xkey] = ou
            }
        }

        for (const newo of utxos) {
            const xkey = `${newo.txid}-${String(newo.outputIndex)}`
            if (!Object.hasOwn(cmputxos, xkey) && newo?.satoshis > 0) {
                newutxos.push(newo)
            }
        }
    } catch (error) {
        newutxos = utxos
    }
    return newutxos
}

function uniqutxos(utxos) {
    let newutxos = []
    try {
        if (!utxos || utxos.length < 1) {
            return utxos
        }

        // 按区块高度升序排列
        const keyPairs = {}
        for (let index = 0; index < utxos.length; index++) {
            const u = utxos[index]
            const txid = _.get(u, ["txid"], null)
            const outputIndex = _.get(u, ["outputIndex"], -1)

            if (txid && Number(outputIndex) >= 0) {
                const k = `${txid}-${outputIndex}`
                if (!_.get(keyPairs, k, null)) {
                    newutxos.push(u)
                    _.set(keyPairs, k, u)
                }
            }
        }

    } catch (error) {
        newutxos = utxos
    }
    return newutxos
}

module.exports = { chunkToNumber, bufferToChunk, numberToChunk, opcodeToChunk, utxosnotin, uniqutxos }
