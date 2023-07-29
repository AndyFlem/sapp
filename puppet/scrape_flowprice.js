const { DateTime, Interval } = require("luxon")
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const fs = require('fs');
const cats=[5,18,19,5]

// const market = 1
const types = ['flow','price']
const markets = [1,2,3,4]

function PromiseTimeout(delayms) {
  return new Promise(function (resolve, reject) {
      setTimeout(resolve, delayms);
  });
}

async function runner(browser, type, market) {
  const folder = '../input/raw_' + type
  const baseurl = 'https://www.sappmarket.com/Home/' // ?deliveryDate=2023/05/01&periodId=13&categoryId=5&marketId=1'
  // const baseurl = 'http://localhost:3000/GetFlow' //?deliveryDate=2023/05/01&periodId=13&categoryId=5&marketId=1'

  startDate = DateTime.fromISO('2023-05-01')
  endDate = DateTime.now().minus({day: 1})

  console.log('Type: ', type)
  console.log('Market: ', market)
  console.log('Start date: ', startDate.toISODate())
  console.log('End date: ', endDate.toISODate())

  let requests = []
  const days = Interval.fromDateTimes(startDate, endDate.plus({day: 1})).splitBy({ days: 1 }).map((d) => d.start)
  days.map(v => {
    const rdir = folder + '/' + market + '/' + v.toFormat('yyyy_LL')
    if (!fs.existsSync(rdir)){
      fs.mkdirSync(rdir);
    }

    const dir = rdir + '/' +  v.toISODate()
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
    
    Array.from({ length: 24 }, (_v, i) => {
      if (!fs.existsSync(dir + '/' + i + '.json')) {
        requests.push([Math.random(), v, i + 11])
      }
    })
  })

  requests.sort((a,b) => a[0]-b[0])
  console.log('Requests: ' + requests.length)
  
  let no = 0
  for (const req of requests) {
    no += 1
    console.log('No: ', no, ' of: ' , requests.length)

    const page = await browser.newPage()
 
    let url
    if (type=='flow') {
      url = baseurl + `GetFlow?x=${Math.random()}&deliveryDate=${req[1].toFormat('yyyy/LL/dd')}&periodId=${req[2]}&categoryId=${cats[market-1]}&marketId=${market}`
    } else {
      url = baseurl + `GetAreaPrice?x=${Math.random()}&deliveryDate=${req[1].toFormat('yyyy/LL/dd')}&periodId=${req[2]}&currencyId=1&marketId=${market}`
    }
    
    console.log(url)

    await page.goto(url)
    await page.waitForSelector('pre', {timeout: 300000})
    await page.waitForNetworkIdle()
  
    const content = await page.content()  
    const pre = await page.$('pre') 
    
    const data = JSON.parse(await (await pre.getProperty('textContent')).jsonValue())
  
    const fil = folder + '/' + market + '/' + req[1].toFormat('yyyy_LL') + '/' +  req[1].toISODate() + '/' + (req[2]-11) + '.json'
    console.log(fil)
    fs.writeFileSync(fil, JSON.stringify(data))

    const wait = 300 + Math.random()*500
    await PromiseTimeout(wait)
    await page.close()  
  }
}

puppeteer.launch({ headless: false }).then(async browser => {

  for (const type of types) {
    for (const market of markets) {
      await runner(browser, type, market)
    }  
  }

  await browser.close()
})