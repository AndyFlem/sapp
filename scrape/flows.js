const axios = require('axios').default
const { DateTime } = require("luxon")

const cats=[5,18,19,22]

getFlows().then(() => {
  console.log('OK')
})

async function getFlows() {
  let curDate
  
  curDate = DateTime.fromISO( '2016-01-01')

  let files=fs.readdirSync('../input/monthly')

  console.log(curDate)

  while (curDate <= DateTime.fromISO( '2021-04-30')) 
  {
    let market = 1
    let period = 1
    let csvData=[]

    const oDel = {flowdate: curDate.toISODate(), market: market}
    console.log(oDel) 

    while (period < 25) {
      const url=`http://www.sappmarket.com/Home/GetFlow?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&categoryId=${cats[market-1]}&marketId=${market}`
      console.log(url)
    
      let response = await axios.get(url)
      //console.log(response.data.excelData)      

      response.data.data.forEach(e => {
        if (e.FlowResult>0) {
          const oIns = {date: curDate.toISODate(),  hour: period-1, flow: e.FlowResult,from: e.FromAreaName, to: e.ToAreaName}
          csvData.push(oIns)
        } 
      })
      period++
    }
    curDate=curDate.plus({ days: 1 })
    if (curDate.day==1) {
      console.log(csvData)
      fs.writeFileSync('../input/flows/dam_' + curDate.minus({ days: 1 }).toFormat('yyyy_LL') + '.json', JSON.stringify(csvData))
      csvData=[]
    }
  } 
  
  return Promise.resolve()

}