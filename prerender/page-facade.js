const desktopUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/89.0.4389.82 Safari/537.36 Prerender (+https://github.com/prerender/prerender)'

class PageFacade {
  static async withPage (pool, url, action) {
    const browser = await pool.acquire()

    let page = null
    try {
      page = await browser.newPage()
      await page.setUserAgent(desktopUserAgent)
      await page.goto(url)
      const pageFacade = new PageFacade(page)
      pageFacade.poolstats.spareResourceCapacity = pool.spareResourceCapacity
      pageFacade.poolstats.size = pool.size
      pageFacade.poolstats.available = pool.available
      pageFacade.poolstats.borrowed = pool.borrowed
      pageFacade.poolstats.pending = pool.pending
      pageFacade.poolstats.max = pool.max
      pageFacade.poolstats.min = pool.min
      await action(pageFacade)
      await page.goto('about:blank')
    } finally {
      if (page) {
        await page.close()
      }
      await pool.release(browser)
    }
  }

  constructor (page) {
    this.page = page
    this.poolstats = {
      // How many many more resources can the pool manage/create
      spareResourceCapacity: 0,
      // returns number of resources in the pool regardless of
      // whether they are free or in use
      size: 0,
      // returns number of unused resources in the pool
      available: 0,
      // number of resources that are currently acquired by userland code
      borrowed: 0,
      // returns number of callers waiting to acquire a resource
      pending: 0,
      // returns number of maxixmum number of resources allowed by pool
      max: 0,
      // returns number of minimum number of resources allowed by pool
      min: 0
    }
  }

  async removeElementsByTagName (name) {
    await this.page.evaluate((n) => {
      const scripts = Array.from(document.getElementsByTagName(n))
      do {
        const script = scripts.shift()
        if (!script) {
          return
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        script.remove()
      } while (scripts.length > 0)
    }, name)
  }

  async getElementsByTagName (name) {
    return await this.page.evaluate(function () {
      return document.getElementsByTagName(name)
    })
  }

  async isPrerenderReady () {
    return await this.page.evaluate(function () {
      return window.prerenderReady
    })
  }

  async isFooterReady () {
    return (await this.getElementsByTagName('vn-responsive-footer')).length > 0
  }

  async waitForPrerender (maxWait) {
    await Promise.race([
      this.isPrerenderReady(),
      this.isFooterReady(),
      new Promise(resolve => setTimeout(resolve, maxWait))])
  }

  async content () {
    return this.page.content()
  }

  async addStats () {
    const scriptToInject = `window.poolStats = ${JSON.stringify(this.poolstats)}`
    await this.page.evaluate(scriptText => {
      const el = document.createElement('script')
      el.type = 'text/javascript'
      el.textContent = scriptText
      el.setAttribute('id', 'poolStats')
      document.body.parentElement.appendChild(el)
    }, scriptToInject)
  }
}

module.exports = PageFacade
