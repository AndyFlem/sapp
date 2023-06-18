const axios = require('axios').default
const { DateTime } = require("luxon")
const fs = require('fs');
const market = 1
const cats=[5,18,19,5]
const prefs=['dam','fpm','fpw', 'idm']

const folder = '../input/flows/' + prefs[market-1] + '/'

const config = { headers : {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-GB,en;q=0.5',
  'Connection': 'keep-alive',
  'Cache-Control':'no-cache',
  'Host':'www.sappmarket.com',
  'Pragma':'no-cache',
  'DNT':'1',
  'Sec-Fetch-Dest':'document',
  'TE':'trailers',
  'Upgrade-Insecure-Requests':'1',
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0',
  'Cookie':"aws-waf-token=7b4d7877-45cc-4002-b6f8-5a66cc05497a:CgoAZpVHS54BAAAA:9WSo/OOQ+c4aZp/3IWzPrkKvVB7BaeBoMqWkHtiznuN/W320cBRt7T20mMYjx9iBKL6VW1WhsL7fsuL2D0eLyyAK0gV+0jDFPDLBRj6kgv3tYCq1K2tCX70RBZDMiwUh1IwoFXei+eSpVraRI6Bn/u46V4c+HcCS3m+rsmJuF4IJz27ppgZN5A=="
}}

function PromiseTimeout(delayms) {
  return new Promise(function (resolve, reject) {
      setTimeout(resolve, delayms);
  });
}

getFlows().then(() => {
  console.log('OK')
})

async function getFlows() {
  let curDate
  let lastDate
  curDate = DateTime.fromISO('2020-01-01')
  
  let files=fs.readdirSync('../input/flows/' + prefs[market-1])
  if (files.length>0) {
    const lastFile=files.sort()[files.length-1]
    console.log("Last file: " + lastFile)
    const lastData=JSON.parse(fs.readFileSync(folder + lastFile))
    console.log(lastData)
    if (lastData.length==0) {
      const dte = lastFile.split('.')[0]
      lastDate=dte.split('_')[1] + '-' + dte.split('_')[2] + '-01'
      lastHour=10
      curDate=DateTime.fromISO(lastDate).plus({month:1})
    } else {
      lastDate=lastData[lastData.length-1].date
      lastHour=lastData[lastData.length-1].hour + 10
      curDate=DateTime.fromISO(lastDate).plus({day:1})
    }
  }
  console.log("Start date:", curDate.toISODate())
  console.log("Start hour:", lastHour + 1)
  
  
  let csvData=[]

  while (curDate <= DateTime.now()) 
  {
    let period = lastHour + 1

    while (period < 35) {
      const url=`https://www.sappmarket.com/Home/GetFlow?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&categoryId=${cats[market-1]}&marketId=${market}`
      // const url=`http://www.sappmarket.com/Home/GetAreaPrice?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&currencyId=1&marketId=${market}`
      
      await PromiseTimeout(5000*Math.random()+ 2000)
      console.log(url)
      let response = await axios.get(url, config)
     
      //console.log(response.request)
      
      response.data.data.forEach(e => {
        if (e.FlowResult>0) {
          const oIns = {date: curDate.toISODate(),  hour: period-11, flow: e.FlowResult,from: e.FromAreaName, to: e.ToAreaName}
          csvData.push(oIns)
        }
      })
      period++
      fs.writeFileSync(folder + prefs[market-1] + '_' + curDate.toFormat('yyyy_LL') + '.json', JSON.stringify(csvData))
    }
    // console.log(csvData)
    

    curDate=curDate.plus({ days: 1 })
    if (curDate.day==1) {
      csvData=[]
    }
  } 
  
  return Promise.resolve()

}