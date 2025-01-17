const BigNumber = require('bignumber.js')

const tonumber = (value) => {
  return new BigNumber(value).toNumber() || 0
}

const tofix = (value, p) => {
  return new BigNumber(value || 0).toFixed(p, BigNumber.ROUND_DOWN)
}

const bnminus = (a, b) => {
  return new BigNumber(a).minus(new BigNumber(b)).toNumber()
}

const bndiv = (a, b) => {
  return new BigNumber(a).div(new BigNumber(b)).toNumber()
}

const bnmult = (a, b) => {
  return new BigNumber(a).multipliedBy(new BigNumber(b)).toNumber()
}

const bnadd = (a, b) => {
  return new BigNumber(a).plus(new BigNumber(b)).toNumber()
}

const bnfix = (a, fix = 2) => {
  return new BigNumber(a).toFixed(fix)
}

const bncomp = (a, b) => {
  return new BigNumber(a).comparedTo(new BigNumber(b))
}

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms)) // Wait 10 seconds
}


module.exports = {
  tonumber,
  tofix,
  bnminus,
  bndiv,
  bnmult,
  bnadd,
  bncomp,
  sleep,
  bnfix,
}
