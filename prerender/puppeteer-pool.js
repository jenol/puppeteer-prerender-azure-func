const puppeteer = require('puppeteer')
const genericPool = require('generic-pool')

const DEFAULTS = {
  min: 10,
  max: 10,
  testOnBorrow: true,
  puppeteerLaunchArgs: [{ headless: true, args: ['--show-paint-rects'] }],
  validate: () => Promise.resolve(true)
}

function createFactory ({ puppeteerLaunchArgs, validate }) {
  const factory = {}

  factory.create = function createFn () {
    const browserInstance = puppeteer.launch(...puppeteerLaunchArgs)
    return browserInstance
  }

  factory.destroy = function destroyFn (browserInstance) {
    return browserInstance.close()
  }

  if (validate && typeof validate === 'function') {
    factory.validate = validate
  }

  return factory
}

function createPool (poolConfig) {
  const config = Object.assign({}, DEFAULTS, poolConfig)
  const factory = createFactory(Object.assign({}, config))

  delete config.validate
  delete config.puppeteerLaunchArgs
  const pool = genericPool.createPool(factory, config)

  return pool
}

module.exports = createPool
