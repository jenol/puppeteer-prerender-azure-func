const lighthouse = require('lighthouse')

class LightHouseUtil {
  constructor (context, browser) {
    this.browser = browser
    this.context = context
  }

  static async withUtil (context, pool, action) {
    const browser = await pool.acquire()
    try {
      const util = new LightHouseUtil(context, browser)
      await action(util)
    } catch (e) {
      await pool.release(browser)
    }
  }

  async createReportWithBrowser (url, options = { output: 'html' }) {
    const endpoint = this.browser.wsEndpoint()
    const endpointURL = new URL(endpoint)
    const result = await lighthouse(
      url,
      Object.assign({}, {
        port: endpointURL.port
      }, options)
    )
    return result.report
  }
}

module.exports = LightHouseUtil
