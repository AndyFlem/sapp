const { DateTime, Interval } = require("luxon")
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const fs = require('fs');

const market = 4

const cats=[5,18,19,5]
const prefs=['dam','fpm','fpw', 'idm']

const baseurl = 'https://www.sappmarket.com/Home/GetPriceAndTurnOverData' 
const outdir = '../input/monthly/' + prefs[market-1] + '/'

const MIN_DELAY = 1000          // ~15 requests/min; tune down only if the server tolerates it
const MAX_CONSECUTIVE_FAILS = 3
const DEFAULT_BLOCK_PAUSE = 30 * 60 // seconds to pause on 403/429 without a Retry-After header

const CHALLENGE_TIMEOUT = 2 * 60 * 1000 // ms to wait for a challenge to be solved manually

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function fetchJson(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const status = res ? res.status() : 0
  const isJson = (res?.headers()['content-type'] || '').includes('json')
  if (status === 200 && isJson) {
    return res.json()
  }

  // Not JSON: probably a challenge page. Give the user time to solve it in the
  // browser window; once solved, the site redirects to the JSON, rendered in a <pre>.
  console.log(`HTTP ${status}, waiting up to ${CHALLENGE_TIMEOUT / 60000} min for the challenge to be solved in the browser...`)
  try {
    await page.waitForSelector('pre', { timeout: CHALLENGE_TIMEOUT })
  } catch {
    const err = new Error(`HTTP ${status} (challenge not solved)`)
    err.status = status
    err.retryAfter = Number(res?.headers()['retry-after']) || null
    throw err
  }
  return JSON.parse(await page.$eval('pre', el => el.textContent))
}

// Find the latest month already saved as <pref>_yyyy_LL.json in the output folder
function lastSavedMonth() {
  const re = /^(\w+)_(\d{4})_(\d{2})\.json$/
  const months = fs.readdirSync(outdir)
    .map(f => f.match(re))
    .filter(m => m && m[1] === prefs[market-1])
    .map(m => m.slice(1))
    .map(m => DateTime.fromObject({year: parseInt(m[1]), month: parseInt(m[2]), day: 1}))
    .sort((a, b) => a - b)
  return months.length ? months[months.length - 1] : null
}

// Months from the one after the last saved file up to last month
function pendingMonths() {
  const last = lastSavedMonth()
  if (!last) {
    console.log('No existing json files found in ', outdir)
    return []
  }

  const startDate = last.plus({month: 1})
  const endDate = DateTime.now().startOf('month').minus({month: 1})

  console.log('Market: ', market)
  console.log('Last saved: ', last.toFormat('yyyy_LL'))

  if (startDate > endDate) {
    console.log('Up to date, nothing to fetch')
    return []
  }

  console.log('Start month: ', startDate.toFormat('yyyy_LL'))
  console.log('End month: ', endDate.toFormat('yyyy_LL'))

  const months = Interval.fromDateTimes(startDate, endDate.plus({month: 1})).splitBy({ months: 1 }).map((m) => m.start)
  console.log('Requests: ' + months.length)
  return months
}

async function runner(page, months) {
  // Months are fetched in order and a failed month is retried rather than skipped,
  // since resuming relies on the last saved file and a gap would never be filled.
  let no = 0
  for (const from of months) {
    no += 1
    console.log('No: ', no, ' of: ', months.length)

    const to = from.plus({month: 1}).minus({day: 1})
    const fil = outdir + prefs[market-1] + '_' + from.toFormat('yyyy_LL') + '.json'
    const url = baseurl + `?dateFrom=${from.toFormat('dd/LL/yyyy')}&dateTo=${to.toFormat('dd/LL/yyyy')}&aggPeriodId=1&areaId=0&currencyId=1&marketId=${market}`
    console.log(url)

    let fails = 0
    while (true) {
      try {
        const dat = await fetchJson(page, url)
        if (dat === null || typeof dat !== 'object' || typeof dat.data !== 'string') {
          throw new Error('Unexpected response payload')
        }
        console.log(fil)
        fs.writeFileSync(fil, dat.data)
        break
      } catch (e) {
        fails += 1
        console.error(`${url} -> ${e.message}`)
        if (fails >= MAX_CONSECUTIVE_FAILS) {
          console.log('Too many consecutive failures; stopping. Re-run later to resume.')
          return
        }
        if (e.status === 403 || e.status === 429) {
          const pauseMs = (e.retryAfter ?? DEFAULT_BLOCK_PAUSE) * 1000
          console.log(`Rate limited (${e.status}); pausing ${Math.round(pauseMs / 60000)} min`)
          await sleep(pauseMs)
        }
        await sleep(MIN_DELAY + Math.random() * MIN_DELAY)
      }
    }

    await sleep(MIN_DELAY + Math.random() * MIN_DELAY)
  }
}

const months = pendingMonths()

if (months.length) {
  puppeteer.launch({ headless: false }).then(async browser => {
    const page = await browser.newPage()

    try {
      await runner(page, months)
    } finally {
      await browser.close()
    }
  })
}
