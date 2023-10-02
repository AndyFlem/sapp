const { DateTime, Interval } = require("luxon")
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const fs = require('fs');

const market = 4
const year = 2023
const month = '09'

const cats=[5,18,19,5]
const prefs=['dam','fpm','fpw', 'idm']

const baseurl = 'https://www.sappmarket.com/Home/GetPriceAndTurnOverData' 

function PromiseTimeout(delayms) {
  return new Promise(function (resolve, reject) {
      setTimeout(resolve, delayms);
  });
}


console.log('Market: ', market)
console.log('Month: ', year, ' ', month )

const from = DateTime.fromObject({year: year, month: parseInt(month), day: 1})
const to = from.plus({month:1}).minus({day:1})
const path = '../input/monthly/' + prefs[market-1] + '_' + from.toFormat('yyyy_LL') + '.json'
console.log('Dates: ', from, ' ', to)

puppeteer.launch({ headless: false }).then(async browser => {
  
  console.log('Browser')

  const page = await browser.newPage()

  const url = baseurl +  `?dateFrom=${from.toFormat('dd/LL/yyyy')}&dateTo=${to.toFormat('dd/LL/yyyy')}&aggPeriodId=1&areaId=0&currencyId=1&marketId=${market}`
  console.log(url)

  await page.goto(url)
  await page.waitForSelector('pre', {timeout: 300000})
  await page.waitForNetworkIdle()

  const content = await page.content()

  const pre = await page.$('pre') 
  const dat = JSON.parse(await (await pre.getProperty('textContent')).jsonValue())

  console.log(path)
  fs.writeFileSync(path, dat.data)

  const wait = 2000
  console.log('Waiting: ' + wait)
  await PromiseTimeout(wait)
  await page.close()  
  
  await browser.close()
})