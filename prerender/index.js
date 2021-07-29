const createPool = require('./puppeteer-pool')
const LightHouseUtil = require('./lighthouse-util')
const PageFacade = require('./page-facade')
const validUrl = require('valid-url')
const os = require('os')

const pool = createPool({
  min: 0,
  max: 30,
  puppeteerLaunchArgs: [{ headless: true }],
  evictionRunIntervalMillis: 5000
})

function stringifyError (err, filter, space) {
  const plainObject = {}
  Object.getOwnPropertyNames(err).forEach(function (key) {
    plainObject[key] = err[key]
  })
  return JSON.stringify(plainObject, filter, space)
};

module.exports = async function (context, req) {
  if (req.query.poolstats) {
    context.res = {
      headers: { 'Content-Type': 'text/json' },
      status: 200,
      body: JSON.stringify({
        hostname: os.hostname(),
        poolstats: {
          spareResourceCapacity: pool.spareResourceCapacity,
          size: pool.size,
          available: pool.available,
          borrowed: pool.borrowed,
          pending: pool.pending,
          max: pool.max,
          min: pool.min
        }
      })
    }
    return
  }
  try {
    const url = req.query.url
    if (!url || !validUrl.isUri(url)) {
      context.res = {
        headers: { 'Content-Type': 'text/html' },
        status: 404,
        body: 'Not Found'
      }

      return
    }

    if (req.query.lighthouse) {
      const output = req.query.html ? 'html' : 'json'
      await LightHouseUtil.withUtil(context, pool, async (util) => {
        const report = await util.createReportWithBrowser(url, {
          output: output,
          disableDeviceEmulation: true,
          chromeFlags: ['--disable-mobile-emulation', '--disable-storage-reset']
        })
        context.res = {
          headers: { 'Content-Type': `text/${output}` },
          status: 200,
          body: report
        }
      })
      return
    }

    await PageFacade.withPage(pool, url, async (pageFacade) => {
      if (req.query.isMobile) {
        await pageFacade.page.setViewport({ width: 480, height: 320 })
      } else {
        await pageFacade.page.setViewport({ width: 1920, height: 1200 })
      }
      await pageFacade.waitForPrerender(5000)

      if (req.query.screenshot) {
        const screenshotBuffer = await pageFacade.page.screenshot({ type: 'jpeg', quality: 100 })
        context.res = {
          body: screenshotBuffer,
          headers: {
            'content-type': 'image/jpeg'
          }
        }

        return
      }

      await pageFacade.addStats()
      const html = await pageFacade.content()
      context.res = {
        headers: { 'Content-Type': 'text/html' },
        status: 200,
        body: html
      }
    })
  } catch (e) {
    context.res = {
      headers: { 'Content-Type': 'text/json' },
      status: 500,
      body: stringifyError(e)
    }
  } finally {
    context.done()
  }
}
